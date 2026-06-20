# Project Library — Status

> Live tracker for where we are. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-06-18
**Current phase:** Open Beta — Netwerk milestone in progress. Visibility + transactional email shipped. Bug fix pass (`netwerk-3-bug-fixes`) complete — two rounds of fixes + inline-editable refactor, and a QA acceptance pass (8 tickets verified → Done).
**Usership**: Small group of real closed-beta users. Some data is still mocked. DB operations require approval.
**Authoritative plan (only access if prompted):** [Open Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1FTW9_Ny-DWrPzHlO1BGGrfQFqOu4JBxZX2j-F_G5OMI/edit)
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6)

## Open Beta — in progress

### Netwerk Release — in progress

- **Pending (P1):** Request-to-Follow / Request-to-Join approval flows — [filed in ProLib Tickets](https://app.notion.com/p/376453d029b0813498f3cee9de603a74)
- **Pending (Backlog):** Activity notifications dispatcher + in-app bell — [filed in ProLib Tickets](https://app.notion.com/p/379453d029b081239c83fdb6ae1a39a4); [domain verification for sending](https://app.notion.com/p/379453d029b08124a6f3eb13a438795f)
- **NEED PROD MIGRATION:** email verification token tables + emailVerified backfill; visibility model schema changes; `pg_trgm` extension + profile-search GIN indexes (`20260620000000_add_trgm_search_indexes`)

### Meatup Release — not started

### Open Source Launch — not started

## Recent work

Most recent first. See `JOURNAL.md` for full entries.

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
