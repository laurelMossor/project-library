# Project Library — Status

> Live tracker for where we are. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-05-26
**Current phase:** Between milestones — closed beta complete, Open Beta planning finalized, no Open Beta work started yet.
**Usership**: Small group of real closed-beta users. Some data is still mocked. DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Closed beta — complete

All four milestones shipped: Auth & core features (M0) → Pages Launch (M1) → Spats Launch (M2) → Testing & Polish (M3/M4). Site is live and invite-gated.

## What's next

Three Open Beta milestones are scoped in Notion with full definitions. No work has started on any of them yet.

- **Meatup Release** — event-focused features
- **Netwerk Release** — social/communication infrastructure
- **Open Source Launch** — open the codebase and project collaboration

Next step: pick which milestone to start and begin execution.

## Recent work

Most recent first. See `JOURNAL.md` for full entries.

- **2026-05-09** — Prod sync: applied final missing migration, reseeded prod, uploaded missing images. Fixed e2e tests referencing old `/profile` route. Fixed page-owned events appearing on creator's personal profile.
- **2026-05-09** — M4 polish: custom 404 page, `/about` rewrite, `/guidelines` route, footer link split, WelcomeBanner cleanup, NavProfileTag sizing fix.
- **2026-05-08** — Event timezone support: `eventTimezone` field added to schema, seed uses human-readable split format, `InlineDateTimePicker` gained timezone dropdown.
- **2026-05-08** — Settings/profile UX rework: `/profile` route deleted, `/settings` renders profile directly, expanded personal info form with InlineEditSession for both users and pages, own-profile defaults to readonly with Edit pencil button + Preview toggle.
- **2026-05-08** — Bundle C+F (Search, Landing & Beta UX): Global `/search` page with profile cards. Landing page headers. Welcome banner on explore (dismissible, localStorage-gated). Beta messaging in InviteCTA + footer. Empty draft auto-delete fixed to preserve drafts with content.
- **2026-05-08** — Bundle B+E (Form, Edit & About Polish): About Page delete. Publish validation hints. Image auto-compression. Edit Personal Info form.
- **2026-05-08** — Bundle A (Collection UX Polish): Bidirectional URL params. Breadcrumb back-link persistence. Pin icon hover. Filter-aware empty states.

---

## How to use this doc

- **Claude reads this at session start** (configured in `.claude/CLAUDE.md`). 
- When something ships, move it from "In flight" to "Recently closed" with a date.
- When a blocker lifts, delete it — don't keep "solved in 04/03" historical notes here. This is *status*, not *history*. History lives in `JOURNAL.md`.
- When scope changes, edit the milestone section. Don't accumulate cruft.
