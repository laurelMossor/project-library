# Project Library — Status

> Live tracker for where we are on the road to **closed beta release**. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-05-07
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
| 3 | Testing and Polish — test coverage, error messaging, P0/P1 design features, analytics | ⏳ pending |
| 4 | User Feedback — landing experience, tooltips, research plan, 5–10 people | ⏳ pending |

---

## In flight (Polish Launch)
- TODO, list current tasks and tickets grouped into chunks


---

## Not yet started — gates on closed beta (M3 + M4)

From the Beta Plan's Work Estimates table. These are not optional for release; they're just not Spats.

**Testing & polish (M3):**
- [ ] P0 & P1 design features — remaining items in Notion POLISH epic
- [x] P0 & P1 bugs — three BUGS-epic tickets closed 2026-05-06
- [x] N+1 refactor sweep — shipped 2026-05-06. Follow-on: `FollowStats` `_count` still pending
- [ ] Non-offset pagination on collections
- [x] Edit posts after posting — edit mode gating shipped 2026-05-07 (read-only default + Edit/Done toggle for owners)
- [x] Draft post/event behavior — shipped 2026-05-07 (published = read-only, draft = editable)
- [x] Share Event/Post — `ShareButton` shipped 2026-05-06
- [ ] Event form required-field hints on Publish
- [x] Seed system rewrite — per-user/page JSON packets, `$env:` password support, Playwright globalSetup auto-seeds — shipped 2026-05-07
- [x] Explore page sorting — events intermixed by `createdAt`, Events tab sorts upcoming-first, past events greyed out — shipped 2026-05-07

**Beta details (M4):**
- [ ] Clear onboarding / "what is this?" / "how to"
- [ ] Beta flag + notes at login/signup
- [ ] Community guidelines page
- [ ] About page (site-level, not profile about)
- [ ] Landing page with images, links, and headers
- [ ] "Something wrong?" escape hatch
- [ ] Research plan + first 5–10 user sessions

**Narrative gaps in the plan itself** (decisions needed, not just tickets):
- Moderation posture for the beta (lack thereof, flags, disclaimers)
- User expectations: data retention, what breaks, how to report

---

## Recently closed (last ~2 weeks)

Most recent first. See `JOURNAL.md` for full entries.

- **2026-05-07** — Map View polish: `MapControls` with Nominatim geocoding + radius pills, Haversine client-side filtering, viewport-aware count, `LeafletMap` base component, shared `LocationSearchInput` for event forms + map. Leaflet CSS race condition fixed. Seed auto-geocoding added.
- **2026-05-07** — Seed system rewrite: per-user/page JSON packets, `$env:` password support, Playwright globalSetup auto-seeds. Explore sorting reworked (upcoming-first, past events greyed out).
- **2026-05-07** — Connections view rework (Bundle H2): expandable inline actions (Remove Follower, Unfollow, Leave Group, Remove from group + last-admin guard), Add Members via `ProfileSearchDropdown`. Edit mode gating on posts/events (read-only default + Edit/Done toggle). Back-to-Explore breadcrumb.
- **2026-05-06** — Big orchestrator session: Bundles G, D, B, C, H all shipped. N+1 sweep, bug fixes (search/empty messages/empty posts), RSVP autofill/dedup, About Page entry point, NavProfileTag sizing, photo caption editing, ProfileSearchDropdown + ManageAdmins. PostPageClient parity with EventPageClient. Seed + lint + E2E fixes.
- **2026-05-05** — Profile UX overhaul + session-scoped route refactor.
- **2026-04-26** — PR2 URL flattening complete. Unified `/[handle]/` route tree.

---

## Blockers / open questions

- **FollowStats `_count`.** Follow-on from the N+1 sweep — `FollowStats` still fetches full follower/following arrays just for `.length`. Should add `_count` to `publicUserFields`/`publicPageFields`.

---

## How to use this doc

- **Claude reads this at session start** (configured in `.claude/CLAUDE.md`). 
- When something ships, move it from "In flight" to "Recently closed" with a date.
- When a blocker lifts, delete it — don't keep "solved in 04/03" historical notes here. This is *status*, not *history*. History lives in `JOURNAL.md`.
- When scope changes, edit the milestone section. Don't accumulate cruft.
