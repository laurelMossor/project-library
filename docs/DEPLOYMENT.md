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

## Maintenance mode (for destructive cutovers)

`src/proxy.ts` (Next 16's `proxy.ts` replaces the old `middleware.ts`) carries a
maintenance gate. When `MAINTENANCE_MODE=1`, every **page** request is answered with a
self-contained 503 page straight from the edge — the Next render pipeline never runs, so
the pause holds even while a migration is mid-flight and the app itself would 500. `/api`
is intentionally **not** gated (the proxy matcher excludes it), so `/api/health` stays
reachable for uptime monitoring during the window.

**Env vars** (Vercel → Settings → Environment Variables → **Production**):
- `MAINTENANCE_MODE` — `1` = pause on; anything else = off.
- `MAINTENANCE_BYPASS_TOKEN` — a secret. Load any URL once with `?maint_bypass=<token>` to
  set an httpOnly cookie; you then browse the **real** (new) site to verify the deploy while
  the public still sees the pause.

**Flipping it — Vercel env-var changes only take effect on the next deploy, so always
redeploy after changing the value:**
1. Set `MAINTENANCE_MODE=1` → **Redeploy** (Deployments → ⋯ → Redeploy). Public now sees the pause.
2. …do the work…
3. Set `MAINTENANCE_MODE=0` → **Redeploy**. Site live again.

> For an *instant* toggle with no redeploy, move the flag to Vercel **Edge Config** and read
> it from the proxy. Not set up today; env-var + redeploy is fine for a planned cutover.

**Practice locally:** put `MAINTENANCE_MODE` + `MAINTENANCE_BYPASS_TOKEN` in `.env.local`
(gitignored). Set `MAINTENANCE_MODE=1`, restart `npm run dev`, load any page → pause; append
`?maint_bypass=<token>` → slip past it.

### Destructive-migration cutover playbook

Use this when a release includes **destructive** migrations (drops / renames / backfills) —
where the auto-migrate-in-build would otherwise flip the schema while the old deploy is still
serving (the window that produces 500s). The maintenance page converts that window into a
controlled pause.

**Prereq:** the maintenance gate in `src/proxy.ts` must already be live on `main` **and**
present on `develop`, so the cutover merge doesn't remove it.

1. **Back up prod** — the free Supabase tier has **no** automated backups or PITR, so this is
   the only restore point:
   ```bash
   pg_dump "$DIRECT_URL" --no-owner --no-privileges -Fc \
     -f ~/prolib-backups/prod-$(date +%Y%m%d-%H%M).dump
   ```
   (Use `DIRECT_URL`, not the pooled `DATABASE_URL` — `pg_dump` can't run through pgbouncer,
   and `pg_dump` must be ≥ the server's major version.)
2. **Clear any drift** — for a migration whose objects already exist in prod (e.g. a column
   applied by hand and never recorded), mark it applied so `migrate deploy` skips its SQL:
   ```bash
   NODE_ENV=production npx prisma migrate resolve --applied <migration_name>
   ```
3. **Pause the site:** set `MAINTENANCE_MODE=1` in Vercel → Redeploy. Public sees the pause;
   the old code stops serving real queries.
4. **Apply migrations manually:** `npm run db:migrate:deploy`. Watch every migration apply.
   (State now: new schema, old code — but the pause is up, so nothing hits it.)
5. **Deploy the new code:** merge `develop` → `main`. Vercel builds the new code; its
   build-time `migrate deploy` is now a **no-op** (all applied in step 4). Keep
   `MAINTENANCE_MODE=1` through this deploy.
6. **Verify behind the pause:** load the site with `?maint_bypass=<token>` — new code on the
   new schema. Click one logged-in flow.
7. **Lift the pause:** set `MAINTENANCE_MODE=0` → Redeploy.
8. **Post-deploy checks:** `/api/health` = 200, `NODE_ENV=production npx prisma migrate status`
   clean, skim Vercel logs. Keep the backup dump until you're confident.

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

### Keep the auto-migrate, or remove it? (decision, 2026-07-25)

**Keep it.** Running `migrate deploy` before serving is exactly right for **additive**
migrations (new nullable column / table / index) — the common case, and the very gap it was
built to close (a migration once sat unapplied for a week → silent outage). Removing it would
reintroduce "forgot to migrate → new code serves against old schema → 500s" on *every*
routine deploy.

It is a hazard only for **destructive** migrations, where it would flip the schema mid-build
while the old deploy still serves. That case is handled by the **maintenance-mode cutover
playbook** above: you apply the migration manually *before* merging, so the build's
`migrate deploy` is a harmless no-op. The two coexist — auto-migrate protects routine additive
deploys; the maintenance flow owns the rare destructive cutover.

> Future hardening (not built): a build-step guard that scans pending migrations for
> destructive SQL (`DROP` / `RENAME` / `NOT NULL`) and fails the build unless an explicit flag
> is set — forcing destructive changes through the maintenance path instead of auto-applying.

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
