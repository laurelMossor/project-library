# Project Library — Status

> Live tracker for where we are. Brevity is the feature — the high-level "where are we right now?" doc Claude reads at session start. Full history lives in `JOURNAL.md`.

**Last updated:** 2026-07-12
**Current phase:** Open Beta — Netwerk. Visibility, email, membership, uptime, and schema-invariant work is merged to `develop`; commenting is in review. The gating step is the prod-migration cutover to `main`.
**Usership:** Small group of real closed-beta users. Some data is still mocked. DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Open Beta — in progress

### Netwerk Release

- 🚨 **Prod migration is the release blocker.** The Netwerk stack on `develop` adds schema prod doesn't have — including **breaking** changes (the `visibility`→`contentVisibility` rename, email-token tables, `User.tokenVersion`). Apply expand/contract **before** `develop` merges to `main`, or the live site 500s (the 04/19 outage). Additive pieces (`pg_trgm` search indexes, `access_requests`, `comments`) are safe in the same window. Runbook + commands: [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md). *(Mitigation: the build runs `migrate deploy` and `/api/health` + the uptime workflow alert on breakage — but apply destructive changes deliberately, not via auto-apply.)*
- **In review:** commenting (`netwerk-5-comments`).

### Meatup Release — not started

- Filed follow-ups: [authenticated member RSVP (`Rsvp.userId`)](https://app.notion.com/p/38d453d029b081c092c6fb5c85536720) and [wire `emitActivity()` into the dispatcher](https://app.notion.com/p/38d453d029b08159b29cef84711e9a75) — commenting now emits into that same seam.

### Open Source Launch — not started

## Recent work

Most recent first. Full detail in `JOURNAL.md`.

- **2026-07-12** — Comments on Posts/Events: dedicated model, guarded API, compose/edit/delete, comment-as-page, explore count. Plus shared-helper + palette cleanups. In review (`netwerk-5-comments`).
- **2026-07-11** — Hardened the `health-check` branch: `/api/health` 503 stops leaking errors, `migrate deploy` guarded to prod, endpoint rate-limited.
- **2026-07-06** — Schema-invariant fixes: added the missing DB CHECK constraints, converged post creation on one guarded `createPost`, replies inherit parent visibility.
- **2026-07-03–05** — Visibility rework: two-field model (`profileVisibility` / `contentVisibility`), centralized enforcement, draft/view gates, messaging scoped to the active identity.
- **2026-07-01** — Uptime + deploy safety: `/api/health` exercises the real read paths, a scheduled prod ping emails on failure, the build runs `migrate deploy`. (Manual: enable GitHub → Actions email.)
- **2026-06-28** — Membership era (`netwerk-4`): MEMBER role + management UI, Request-to-Follow/Join, self-leave, private-profile locked preview.

---

## How to use this doc

- Claude reads this at session start (see `.claude/CLAUDE.md`).
- When something ships, move it into "Recent work" with a date; trim entries older than ~2 weeks.
- When a blocker lifts, delete it — this is *status*, not *history* (that's `JOURNAL.md`). Don't accumulate cruft.
