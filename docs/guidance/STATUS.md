# Project Library — Status

> Live tracker for where we are. Brevity is the feature — the high-level "where are we right now?" doc Claude reads at session start. Full history lives in `JOURNAL.md`.

**Last updated:** 2026-08-09
**Current phase:** Open Beta. **Netwerk (`v0.4.0`) is shipped to production** — the whole stack (two-field visibility, membership flag, in-app + email notifications, comments, transactional email, post photos, BUGS epic) went live on `main`/prod in the 2026-07-25 migration cutover, the project's first major prod schema migration. Two follow-up releases have landed since: `v0.4.1` (beta-invite CLI + prod email-link fixes) and `v0.4.2` (notification-email delivery fix + Settings polish, currently unreleased). Next: start Meatup.
**Usership:** Small group of real closed-beta users. Some data is still mocked. DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Open Beta

### Netwerk — shipped ✅ (2026-07-25)

Live on prod. First major prod migration: 17 migrations applied behind a maintenance-mode pause, no data loss. Deploy model now: auto `migrate deploy` on build for additive changes; the `proxy.ts` maintenance gate + manual migrate for destructive cutovers. Runbook: [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md).

### Meatup — not started

Follow-up: [authenticated member RSVP (`Rsvp.userId`)](https://app.notion.com/p/38d453d029b081c092c6fb5c85536720), which lights up the currently-inert RSVP-actor guard.

### Open Source Launch — not started

## Recent work

Most recent first. Full detail in `JOURNAL.md`.

- **2026-08-09** — `v0.4.2` polish (unreleased): notification-email delivery fix (cron targets the `www` host), avatar-sync fix, and a Settings consolidation onto `/settings/profile`.
- **2026-07-26** — `v0.4.1`: beta-invite CLI (`npm run invite`) and fixes for prod email links that resolved to `localhost`.
- **2026-07-25** — `v0.4.0` "Netwerk" shipped: first prod migration behind a new maintenance-mode gate (`proxy.ts` edge 503), 17 migrations, no data loss.

---

## How to use this doc

- Claude reads this at session start (see `.claude/CLAUDE.md`).
- When something ships, move it into "Recent work" with a date; trim entries older than ~2 weeks.
- When a blocker lifts, delete it — this is *status*, not *history* (that's `JOURNAL.md`). Don't accumulate cruft.
