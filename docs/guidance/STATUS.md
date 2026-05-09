# Project Library — Status

> Live tracker for where we are on the road to **closed beta release**. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-05-09
**Overall goal:** Closed beta release — invite-only site
**Usership**: There are NO real users, all data is mocked. 
**Authoritative plan (only access if prompted):** [Closed Beta – Project Plan (Google Doc)](https://docs.google.com/document/d/1Zjz7i0VSmv1Twy9otR_oq6KHtPexHettzY183VB9zLw/edit) · mirrored work estimates table is the ground truth for what's left.
**Ticket board (only access if prompted):** [ProLib Tickets (Notion)](https://www.notion.so/2d6453d029b080e99ebffce9169b18c6). 



---

## Milestones toward closed beta

| # | Milestone | Status |
|---|---|---|
| 0 | Auth, basic posts/events, 1:1 messaging | ✅ done |
| 1 | Pages Launch (fm. "Orgs") — Pages replacing Orgs/Projects, admin-manageable, follow/followers | ✅ done |
| 2 | **Spats Launch** — Pages as microsite, pinned posts, photo captions, profile picture, expanded fields, map view, group admin tools | ✅ done |
| 3 | Testing and Polish — test coverage, error messaging, P0/P1 design features, analytics | ✅ done |
| 4 | User Feedback — landing experience, tooltips, research plan, 5–10 people | ⏳ wrapping up |

---

## In flight (M4 wrap-up)

**Remaining M4 items (3):**
- [ ] PL About page — site-level (placeholder exists at `/about`, needs real content)
- [ ] Community guidelines — current `/about` has placeholder guidelines copy, needs Laurel's real version
- [ ] "Something wrong?" escape hatch — feedback link/button somewhere persistent


---

## Not yet started — gates on closed beta (M3 + M4)

From the Beta Plan's Work Estimates table. These are not optional for release; they're just not Spats.

**Testing & polish (M3):** ✅ complete
- All P0/P1 design features and bugs shipped
- Remaining minor items (non-offset pagination, FollowStats `_count`) deferred to post-beta

**Beta details (M4):**
- [x] Clear onboarding — welcome banner on explore with action links, shipped 2026-05-08
- [x] Beta flag + notes — InviteCTA updated, beta note in footer, welcome banner, shipped 2026-05-08
- [x] Landing page — clickable images + headers, shipped 2026-05-08
- [x] Global search — `/search` page with profile cards (avatar, name, headline, interests), shipped 2026-05-08
- [ ] Community guidelines page — placeholder exists, needs real content
- [ ] About page (site-level) — needs real content
- [ ] "Something wrong?" escape hatch
- [ ] Research plan + first 5–10 user sessions (post-launch, not code)

---

## Recently closed (last ~2 weeks)

Most recent first. See `JOURNAL.md` for full entries.

- **2026-05-08** — Event timezone support: `eventTimezone` field added to schema, seed uses human-readable split format, `InlineDateTimePicker` gained timezone dropdown.
- **2026-05-08** — Settings/profile UX rework: `/profile` route deleted, `/settings` renders profile directly, expanded personal info form with InlineEditSession for both users and pages, own-profile defaults to readonly with Edit pencil button + Preview toggle.
- **2026-05-08** — Bundle C+F (Search, Landing & Beta UX): Global `/search` page with profile cards. Landing page headers. Welcome banner on explore (dismissible, localStorage-gated). Beta messaging in InviteCTA + footer. Empty draft auto-delete fixed to preserve drafts with content.
- **2026-05-08** — Bundle B+E (Form, Edit & About Polish): About Page delete. Publish validation hints. Image auto-compression. Edit Personal Info form.
- **2026-05-08** — Bundle A (Collection UX Polish): Bidirectional URL params. Breadcrumb back-link persistence. Pin icon hover. Filter-aware empty states.
- **2026-05-07** — Map View polish, seed system rewrite, connections view rework, edit mode gating.
- **2026-05-06** — Big orchestrator session: N+1 sweep, bug fixes, RSVP polish, About Page entry point, photo captions, ManageAdmins.

---

## Blockers / open questions

- **FollowStats `_count`.** Follow-on from the N+1 sweep — `FollowStats` still fetches full follower/following arrays just for `.length`. Should add `_count` to `publicUserFields`/`publicPageFields`.

---

## How to use this doc

- **Claude reads this at session start** (configured in `.claude/CLAUDE.md`). 
- When something ships, move it from "In flight" to "Recently closed" with a date.
- When a blocker lifts, delete it — don't keep "solved in 04/03" historical notes here. This is *status*, not *history*. History lives in `JOURNAL.md`.
- When scope changes, edit the milestone section. Don't accumulate cruft.
