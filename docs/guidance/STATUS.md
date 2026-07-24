# Project Library — Status

> Live tracker for where we are. Brevity is the feature — the high-level "where are we right now?" doc Claude reads at session start. Full history lives in `JOURNAL.md`.

**Last updated:** 2026-07-24
**Current phase:** Open Beta — Netwerk. Visibility, email (`netwerk-7`, PR #37), uptime, schema-invariant, and commenting work is merged to `develop`; Activity Notifications is in review and the membership feature-flag is built on `netwerk-8`. The gating step is the prod-migration cutover to `main`.
**Usership:** Small group of real closed-beta users. Some data is still mocked. DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Open Beta — in progress

### Netwerk Release

- 🚨 **Prod migration is the release blocker.** The Netwerk stack on `develop` adds schema prod doesn't have — including **breaking** changes (the `visibility`→`contentVisibility` rename, email-token tables, `User.tokenVersion`). Apply expand/contract **before** `develop` merges to `main`, or the live site 500s (the 04/19 outage). Additive pieces (`pg_trgm` search indexes, `access_requests`, `comments`) are safe in the same window. Runbook + commands: [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md). *(Mitigation: the build runs `migrate deploy` and `/api/health` + the uptime workflow alert on breakage — but apply destructive changes deliberately, not via auto-apply.)*
- **In review:** Activity Notifications (`netwerk-6-activity-notifications`, PR #36) — `/prolib-review` complete, title-gate hardening pushed.
- **Built, pre-PR:** Membership feature-flag (`netwerk-8-membership-flag`) — self-service Join/membership hidden behind a `FEATURES` constant (Follow is the single beta relationship). Bundled a permission-layer tightening onto a shared role module, an ADMIN-only fix for page-privacy changes (editors could flip it), and a seed cleanup (seeded members → followers). 384 unit green, flag verified live. Covers 3 held NETWERK tickets. Additive schema only (the EVENT-seam comment); safe in the cutover.
- **Merged:** Email Notifications (`netwerk-7-email-notifs`, PR #37) — enqueue→~15-min flush that coalesces + read-suppresses, per-(user,context) preferences with per-context master + one-click unsubscribe, settings UI. Its migration is additive. **Prod config is a P0 prereq:** [FLUSH_SECRET + unsubscribe secret + migration](https://app.notion.com/p/3a5453d029b0811098f6c5d562620177) — the flush endpoint fails closed without `FLUSH_SECRET` (set in Vercel *and* as a GitHub Actions secret).

### Meatup Release — not started

- The [`emitActivity()` dispatcher](https://app.notion.com/p/38d453d029b08159b29cef84711e9a75) now ships in-app notifications (netwerk-6) and email (netwerk-7). Remaining follow-up: [authenticated member RSVP (`Rsvp.userId`)](https://app.notion.com/p/38d453d029b081c092c6fb5c85536720), which lights up the currently-inert RSVP-actor guard.

### Open Source Launch — not started

## Recent work

Most recent first. Full detail in `JOURNAL.md`.

- **2026-07-24** — Membership feature-flag (`netwerk-8`): hid self-service Join/membership behind a `FEATURES` constant (Follow is the single beta relationship), tightened the permission layer onto a shared role module, made page-privacy changes ADMIN-only (an editor could flip them), and converted seeded members to followers. Kept `ResourceType.EVENT` as a documented co-host seam. 384 unit green.
- **2026-07-22** — Email Notifications (`netwerk-7`): enqueue→windowed flush (coalesce + read-suppress) over an `EmailOutbox`, per-(user,context) preferences with per-context master + one-click unsubscribe, profile-grouped email, settings UI. Reshaped the pref model mid-build and practiced a clean migration rollback. P0 prod-config prereq ticket filed.
- **2026-07-21** — `/prolib-review` of Activity Notifications: no bugs; gated the bell's object-title read through `canViewPost`/`canViewEvent` so a future non-owner emitter can't leak a private title, with a regression test.
- **2026-07-20** — Activity Notifications (`netwerk-6`): evolved the `emitActivity` seam into a real Activity-Streams dispatcher (actor·verb·object, per-recipient fan-out, admin-only request targeting) plus an identity-scoped in-app bell; shared the unread-count poll into one hook.
- **2026-07-12** — Comments on Posts/Events: dedicated model, guarded API, compose/edit/delete, comment-as-page, explore count. Merged to `develop` (PR #34).
- **2026-07-11** — Hardened the `health-check` branch: `/api/health` 503 stops leaking errors, `migrate deploy` guarded to prod, endpoint rate-limited.
- **2026-07-06** — Schema-invariant fixes: added the missing DB CHECK constraints, converged post creation on one guarded `createPost`, replies inherit parent visibility.

---

## How to use this doc

- Claude reads this at session start (see `.claude/CLAUDE.md`).
- When something ships, move it into "Recent work" with a date; trim entries older than ~2 weeks.
- When a blocker lifts, delete it — this is *status*, not *history* (that's `JOURNAL.md`). Don't accumulate cruft.
