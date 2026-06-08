# Project Library — Status

> Live tracker for where we are. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-06-08
**Current phase:** Open Beta — Netwerk milestone in progress. Visibility + transactional email shipped.
**Usership**: Small group of real closed-beta users. Some data is still mocked. DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Open Beta — in progress

### Netwerk Release — in progress

- **2026-06-08** — **Transactional email foundation shipped.** Resend sender service, React Email templates, account verification (login gated), password reset. 18 new unit + 3 new E2E tests; all green. `RESEND_API_KEY` in Vercel; `EMAIL_FROM` defaults to sandbox until domain verified. -- NEED PROD MIGRATION (email verification token tables + emailVerified backfill)!
- **2026-06-05** — **Visibility model (P0) shipped.** Three-tier Public/Unlisted/Private enum on User, Page, Event, Post. Centralized enforcement layer (`visibility.ts`) with viewer-aware list filters and detail gates. `User.isPublic` replaced by unified `Visibility` enum. Cascade-sync keeps Post.visibility in step with parent. Public→Private page flip converts followers to MEMBER permissions. VisibilitySelector UI wired into profile and page settings. 155 unit tests, 43 E2E tests all green. -- NEED PROD MIGRATION!
- **Pending (P1):** Request-to-Follow / Request-to-Join approval flows — [filed in ProLib Tickets](https://app.notion.com/p/376453d029b0813498f3cee9de603a74)
- **Pending (Backlog):** Activity notifications dispatcher + in-app bell — [filed in ProLib Tickets](https://app.notion.com/p/379453d029b081239c83fdb6ae1a39a4); [domain verification for sending](https://app.notion.com/p/379453d029b08124a6f3eb13a438795f)

### Meatup Release — not started

### Open Source Launch — not started

## Recent work

Most recent first. See `JOURNAL.md` for full entries.

- **2026-06-08** — Transactional email (Netwerk): Resend sender service, React Email templates, account verification + login gate, password reset, 18 unit + 3 E2E tests.
- **2026-06-05** — Visibility model (P0, Netwerk): unified Public/Unlisted/Private enforcement across all entity types. Schema migration, enforcement layer, cascade sync, UI selector, 30 new unit tests, 11 new E2E tests.
- **2026-05-09** — Prod sync: applied final missing migration, reseeded prod, uploaded missing images. Fixed e2e tests referencing old `/profile` route. Fixed page-owned events appearing on creator's personal profile.
- **2026-05-09** — M4 polish: custom 404 page, `/about` rewrite, `/guidelines` route, footer link split, WelcomeBanner cleanup, NavProfileTag sizing fix.
- **2026-05-08** — Event timezone support: `eventTimezone` field added to schema, seed uses human-readable split format, `InlineDateTimePicker` gained timezone dropdown.
- **2026-05-08** — Settings/profile UX rework: `/profile` route deleted, `/settings` renders profile directly, expanded personal info form with InlineEditSession for both users and pages, own-profile defaults to readonly with Edit pencil button + Preview toggle.

---

## How to use this doc

- **Claude reads this at session start** (configured in `.claude/CLAUDE.md`). 
- When something ships, move it from "In flight" to "Recently closed" with a date.
- When a blocker lifts, delete it — don't keep "solved in 04/03" historical notes here. This is *status*, not *history*. History lives in `JOURNAL.md`.
- When scope changes, edit the milestone section. Don't accumulate cruft.
