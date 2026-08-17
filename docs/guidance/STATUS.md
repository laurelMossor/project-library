# Project Library — Status

> Live tracker for where we are. Brevity is the feature — the high-level "where are we right now?" doc Claude reads at session start. Full history lives in `JOURNAL.md`.

**Last updated:** 2026-08-16
**Current phase:** Open Beta. **Netwerk (`v0.4.0`) is shipped to production** — the whole stack (two-field visibility, membership flag, in-app + email notifications, comments, transactional email, post photos, BUGS epic) went live on `main`/prod in the 2026-07-25 migration cutover, the project's first major prod schema migration. Follow-ups `v0.4.1` and `v0.4.2` shipped since. **v0.5.0 (Meatup)** — RSVP deepening + Poster Catcher — is staged on `develop` / in final review; next: ship it, then Open Source Launch.
**Usership:** A growing base of real users in open beta — treat prod as live (real data, real accounts). DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Open Beta

### Netwerk — shipped ✅ (2026-07-25)

Live on prod. First major prod migration: 17 migrations applied behind a maintenance-mode pause, no data loss. Deploy model now: auto `migrate deploy` on build for additive changes; the `proxy.ts` maintenance gate + manual migrate for destructive cutovers. Runbook: [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md).

### Meatup — in progress

- **meatup-1 (RSVP)** — merged to `develop`: plus-one guests (`RsvpGuest`) and server-authoritative [authenticated member identity (`Rsvp.userId`)](https://app.notion.com/p/38d453d029b081c092c6fb5c85536720), which lit up the previously-inert RSVP-actor guard. Migration pending prod deploy.
- **meatup-2 (Poster Catcher)** — in code review on `meatup-2-superadmin-event-submissions`: Telegram intake -> LLM extraction -> superadmin `/admin/submissions` review -> publish via the existing event write path. Submissions migration already applied to prod.

### Open Source Launch — not started

## Recent work

Most recent first. Full detail in `JOURNAL.md`.

- **2026-08-16** — meatup-2 Poster Catcher: Telegram intake, LLM extraction, superadmin `/admin/submissions`; prod hardening (Open Graph links, anti-hallucination, draft tags); rebased onto develop; prolib-review fixes (SSRF guard, idempotent approve). v0.5.0 release notes updated.
- **2026-08-15** — meatup-1 merged to `develop`: member RSVPs (`Rsvp.userId`) + plus-one guests; map/collection P0s (phantom SF pin, past events off map, posted dates, `LocalDate`); RSVP spoofing + headcount fixes from review.
- **2026-08-09** — `v0.4.2`: notification-email delivery fix (cron targets `www`), avatar-sync fix, Settings consolidation onto `/settings/profile`.

---

## How to use this doc

- Claude reads this at session start (see `.claude/CLAUDE.md`).
- When something ships, move it into "Recent work" with a date; trim entries older than ~2 weeks.
- When a blocker lifts, delete it — this is *status*, not *history* (that's `JOURNAL.md`). Don't accumulate cruft.
