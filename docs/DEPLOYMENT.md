# Deployment Guide

How to ship code + database migrations to production safely.

> **The one rule that bit us before:** migrations do **not** run automatically on
> `git push`. If new code goes live expecting a column that hasn't been migrated
> yet, the app throws 500s — and without alerting, that can sit broken unnoticed.
> The runbook below exists to make that failure impossible to reach by accident.

---

## Release runbook (the safe path)

Follow this order every time. The golden rule: **the schema a build depends on
must exist before that build serves traffic.**

1. **Write & test the migration locally.**
   ```bash
   npm run db:migrate      # creates + applies the migration on the local DB
   npm run validate        # lint, typecheck, unit, e2e, build — must be green
   ```
2. **Keep migrations backward-compatible (expand, then contract).** A deploy is
   safe when the *old* running code tolerates the *new* schema. So:
   - **Additive** (new nullable column, new table, new index — e.g. `emailVerified`,
     `tokenVersion`): safe. Old code ignores it; new code needs it.
   - **Destructive** (drop/rename a column, NOT NULL without a default, data
     backfill): do it in **two** deploys — first add the new shape and migrate
     reads/writes to it, then remove the old shape in a later release once nothing
     uses it. Never drop-and-deploy in one step.
3. **Commit the migration files** (`prisma/migrations/**`) together with the code
   that depends on them, and merge to `main` (CI must be green — see below).
4. **Deploy.** The Vercel build runs `prisma migrate deploy` **before** it
   builds/serves (see "Automated" section below), so the schema is always in place
   first. If you ever deploy outside that pipeline, run the migration **before**
   promoting the new code:
   ```bash
   npm run db:migrate:deploy   # applies pending migrations to prod (.env.production)
   ```
5. **Verify** (next section). Don't assume green = working.

---

## After deploying: verify (don't trust silence)

The week-long outage happened because nothing *told us* it was down. After every
deploy:

- [ ] Load the production site and click through one logged-in flow (e.g. log in,
      open a profile). A blank/500 page here = the deploy is broken; roll back or
      fix-forward now, not later.
- [ ] Check `prisma migrate status` against prod shows **no pending** migrations:
   ```bash
   NODE_ENV=production npx prisma migrate status
   ```
- [ ] Skim the Vercel runtime logs for a burst of 500s right after the deploy.

> Uptime alerting is now automated (see **Monitoring** below), so a broken deploy
> pages you instead of waiting to be discovered — but the manual post-deploy glance
> above is still worth 30 seconds.

---

## Monitoring (uptime + health)

The silent-outage class (site up, but content/DB broken — as on 04/19) is now
covered without any third-party account:

- **Health endpoint — `GET /api/health`** ([src/app/api/health/route.ts](../src/app/api/health/route.ts)).
  Public, uncached. Runs the **real** read paths, not just connectivity: a
  `SELECT 1` gate, then the actual Post/Event collection queries (same selects as
  `/explore`) and a User/auth-data query, plus a required-env presence check.
  Returns `200 {"status":"ok", checks:{…}}` when all pass, `503` otherwise. Because
  it exercises the live schema, a missing/renamed column (the 04/19 failure mode)
  surfaces as a 503 — a bare `SELECT 1` would not have caught it.
  - Deliberately *excluded* (side-effectful/peripheral): real login, sending a test
    email, image storage / map tiles. Add a separate "deep" check later if wanted.

- **Uptime pinger — `.github/workflows/uptime.yml`.** A scheduled GitHub Actions
  job curls `https://theprojectlibrary.com/api/health` every ~15 min (plus manual
  `workflow_dispatch`). If it doesn't get `200` + `"status":"ok"`, the run fails and
  GitHub emails the workflow author.
  - **You must enable the email:** GitHub → Settings → Notifications → Actions →
    email. Without it, a failed run is silent.
  - Caveats: scheduled runs can lag under GitHub load (treat as ~15–30 min
    detection); GitHub auto-disables the schedule after 60 days of repo inactivity.

- **Error tracking (individual 4xx/5xx anomalies)** is *not* wired up yet — see the
  deferred "Anomaly / error reporting for 400s/500s" ticket. Until then, Vercel
  runtime logs capture 500s if you need to dig in.

---

## Automated: `migrate deploy` runs in the build ✅ (implemented)

This removes the "I forgot to run migrations" failure mode entirely — the Vercel
**production** build applies pending migrations before it serves. The `package.json`
build script is now:

```json
{
  "scripts": {
    "build": "prisma generate && npm run build:migrate && next build",
    "build:migrate": "sh -c 'if [ \"$VERCEL_ENV\" = production ]; then npx prisma migrate deploy; else echo \"Skipping migrate deploy (VERCEL_ENV=${VERCEL_ENV:-unset})\"; fi'"
  }
}
```

**Production-only by design.** The guard keys on `VERCEL_ENV` (`production` |
`preview` | `development`) — *not* `NODE_ENV`, which Vercel sets to `production` for
preview builds too. So only production builds run `migrate deploy`; preview/branch and
local builds print a skip line and continue straight to `next build`. This makes it
impossible for a preview build to mutate a database schema — fail-safe by construction,
independent of how each environment's `DATABASE_URL`/`DIRECT_URL` is scoped.

Requires `DIRECT_URL` to be set in the Vercel project env vars (it is). If the
migration fails on a production build, `sh` exits non-zero, the `&&` chain breaks, the
build fails, and the **old** deploy keeps serving — a safe, fail-closed outcome.

Trade-offs:
- Every **production** deploy runs `migrate deploy`. That's exactly what you want for
  additive migrations. For a **destructive** migration, follow the two-deploy
  expand/contract pattern above so an automated apply is still safe.
- **Preview builds do *not* auto-apply migrations.** A schema change reaches a live DB
  only via a deliberate production deploy (or a manual `npm run db:migrate:deploy`). If
  you ever need a preview to exercise a brand-new migration, apply it to that preview's
  DB by hand.

---

## Migration commands

### Development (local database)
```bash
npm run db:migrate          # create + apply a migration locally (.env.development)
```

### Production (remote database)
```bash
npm run db:migrate:deploy   # apply existing migrations only (.env.production)
```

### `prisma migrate dev` vs `prisma migrate deploy`
- **`migrate dev`** — creates new migration files AND applies them to the local
  DB. Development only; **never run against production.**
- **`migrate deploy`** — applies existing migration files, never creates them.
  This is the production-safe command.

---

## Resolving a failed migration (P3009)

If a migration fails in production, you must resolve it before applying new ones.

### 1. Check status
```bash
NODE_ENV=production npx prisma migrate status
```
Shows which migrations are applied, failed, or pending.

### 2. See what actually happened
Inspect whether the migration applied partially, and the error:
```sql
SELECT migration_name, finished_at, applied_steps_count, logs
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 5;
```

### 3. Resolve it
- **Failed completely (no tables created)** → mark rolled back, fix the SQL, re-deploy:
  ```bash
  NODE_ENV=production npx prisma migrate resolve --rolled-back <migration_name>
  ```
- **Partially applied** → mark applied, then write a *new* migration for the missing pieces:
  ```bash
  NODE_ENV=production npx prisma migrate resolve --applied <migration_name>
  ```
  ⚠️ Only use `--applied` if you're sure those changes are really in the DB, or you'll get schema drift.

### 4. Verify
```bash
NODE_ENV=production npx prisma migrate status
NODE_ENV=production npx prisma db pull   # what's actually in the DB
```

---

## Rollback plan

1. **Don't panic** — the previous deploy's code is still what's running until the new one is promoted.
2. Read the migration error logs.
3. Fix-forward (new migration) or roll back the failed migration per the section above.
4. Re-run the migration once fixed.

For destructive changes, the expand/contract pattern is the rollback safety net: because the old column/shape still exists, you can revert the code deploy without losing data.

---

## Environment variables

`.env.production` must define both connection strings:
```bash
DIRECT_URL="postgresql://postgres:password@host:5432/dbname"   # direct — used for migrations
DATABASE_URL="postgresql://postgres:password@host:5432/dbname" # pooled — used by the app at runtime
```
`prisma.config.ts` uses **`DIRECT_URL`** for migrations, so it must be set wherever you run `migrate deploy`.

---

## Pre-deploy checklist

- [ ] Migration tested locally (`npm run db:migrate`)
- [ ] `npm run validate` green locally **and** CI green on the PR
- [ ] Migration is additive — or, if destructive, split into expand/contract deploys
- [ ] Migration files (`prisma/migrations/`) committed with the dependent code
- [ ] `.env.production` has correct `DIRECT_URL` + `DATABASE_URL`
- [ ] Production database backed up (if it holds real data)
- [ ] Plan to verify after deploy (load the site, check `migrate status`, skim logs)
