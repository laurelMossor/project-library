# Project Library — Status

> Live tracker for where we are. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-06-28
**Current phase:** Open Beta — Netwerk nearly done. Visibility + email shipped. Membership era (Pages-have-Members, Request-to-Follow/Join, self-leave) landed on `netwerk-4`, in QA awaiting `npm run validate` + prod migration.
**Usership**: Small group of real closed-beta users. Some data is still mocked. DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Open Beta — in progress

### Netwerk Release — in progress

- **In QA (`netwerk-4`):** Pages-have-Members ([P0](https://app.notion.com/p/36d453d029b0815db9c0d534ca0645e6)), Request-to-Follow/Join ([P1](https://app.notion.com/p/376453d029b0813498f3cee9de603a74)), self-leave ([SPATS P0](https://app.notion.com/p/336453d029b080c2aa91ca4d2efefc6a)). Awaiting `npm run validate`.
- 🚨 **NEED PROD MIGRATION — apply BEFORE `develop` merges to `main`/prod, or the live site 500s.** The Netwerk stack adds **breaking** schema prod doesn't have yet: visibility model columns, email-verification token tables + `emailVerified` backfill, `User.tokenVersion`. Migrate first, expand-then-contract (see `docs/DEPLOYMENT.md`). Non-breaking (additive, same window): `pg_trgm` + profile-search GIN indexes (`20260620000000`) and the `access_requests` table (`20260628000000`). This is the exact gap that took prod down on 04/19 — do not merge `develop`→`main` until prod is migrated. *(Mitigation now in place: the Vercel build runs `prisma migrate deploy` before serving, and `/api/health` + the uptime workflow will alert if content breaks — but still apply these **breaking** changes deliberately via expand/contract; don't rely on the auto-apply for destructive migrations.)*

### Meatup Release — not started

- Follow-ups filed during the membership work: [authenticated member RSVP (`Rsvp.userId`)](https://app.notion.com/p/38d453d029b081c092c6fb5c85536720) and [wire `emitActivity()` into the dispatcher](https://app.notion.com/p/38d453d029b08159b29cef84711e9a75).

### Open Source Launch — not started

## Recent work

Most recent first. See `JOURNAL.md` for full entries.

- **2026-07-01** — Uptime + deploy safety (no new accounts): `GET /api/health` exercises the real Post/Event/User read paths (catches schema drift, not just connectivity), a scheduled GitHub Actions workflow pings prod every ~15 min and emails on failure, and the build now runs `prisma migrate deploy` before serving. Closes the silent-outage gap from 04/19. Error tracking (400/500 anomalies) deferred to its own Backlog ticket. **Manual step: enable GitHub → Notifications → Actions email.**
- **2026-06-28** — Membership era (`netwerk-4`): MEMBER activation + management UI, Request-to-Follow/Join (`AccessRequest`), self-leave, private-profile locked preview. In QA; pending validate + prod migration.
- **2026-06-20** — `/prolib-review` of `netwerk-3` + fixes: 3 silent data-loss bugs (avatar no-op, cover-edit loss, page-visibility drop), profile routes converged on shared `saveMyProfile`, visibility componentized, email moved behind `server-only`, `pg_trgm` index added. tsc + 192 unit green. Pending: `npm run validate`. **Carries breaking prod migrations — see 🚨 flag above before shipping to `main`.**
- **2026-06-18** — First `/prolib-qa` run: 8 QA tickets verified PASS → Done (20 criteria checked off). Two fixes landed mid-run: visibility selector moved to `/settings/personal-info`; edit/preview mode now URL-driven (`?edit=true`) in `ProfileEditClient`. Skill hardened — per-ticket write-back, corrected `setup.md` (only alice/sam are QA actors; `laurel` is off-limits) + new `preview-tools.md`. **Not yet committed; QA tickets #7 (cover/banner) and #10 (session→login) still un-QA'd.**
- **2026-06-14** — Round 2 bug fixes: inline-editable refactor (`useInlineField` hook, batched save/publish bar, date picker + cover image folded into batch, blur-loses-changes fixed, profile stuck-edit + published-post-editable fixed).
- **2026-06-14** — Round 1 bug fixes: event authorship PATCH, page avatar endpoint, cover replace, image delete in carousel, date year cap, search `startsWith`→`contains`, session cookie prefix hardening.
- **2026-06-08** — Transactional email: Resend sender, React Email templates, account verification + login gate, password reset.
- **2026-06-05** — Visibility model: unified Public/Unlisted/Private across all entity types, enforcement layer, cascade sync, VisibilitySelector UI.

---

## How to use this doc

- **Claude reads this at session start** (configured in `.claude/CLAUDE.md`). 
- When something ships, move it from "In flight" to "Recently closed" with a date.
- When a blocker lifts, delete it — don't keep "solved in 04/03" historical notes here. This is *status*, not *history*. History lives in `JOURNAL.md`.
- When scope changes, edit the milestone section. Don't accumulate cruft.
