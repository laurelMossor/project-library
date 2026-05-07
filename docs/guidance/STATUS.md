# Project Library — Status

> Live tracker for where we are on the road to **closed beta release**. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-05-06
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
| 2 | **Spats Launch** — Pages as microsite, pinned posts, photo captions, profile picture, expanded fields, map view, group admin tools | 🚧 **in progress** |
| 3 | Testing and Polish — test coverage, error messaging, P0/P1 design features, analytics | ⏳ pending |
| 4 | User Feedback — landing experience, tooltips, research plan, 5–10 people | ⏳ pending |

---

## In flight (Milestone 2 — Spats Launch)

Sourced from `docs/scratch/SPATS_LAUNCH.md` + the [Spats Launch Notion ticket](https://www.notion.so/2e1453d029b0801c9790fa897a7332eb). PR1, PR2, and PR3 are all merged. M2 is nearly complete — two items remain.

- [ ] **Task 1 — Page roles**: decide if Pages need an ultimate Owner (vs current ADMIN/EDITOR/MEMBER). Currently leaning toward "not yet."
- [x] **Task 2 — Microsite features**: `ProfileElement` table (LINK + TEXT kinds), `aboutContent` field, per-element WYSIWYG inline editing, platform auto-detection for links — shipped 2026-05-05.
- [x] **Task 2a — About subpage**: `/[handle]/about` route + `AboutPageClient` inline editor. Entry point added to `AddElementButton` dropdown 2026-05-06.
- [x] **Task 3 — Pinned posts** — schema + UI + max-3 enforcement shipped 2026-04-03
- [x] **Task 4 — Profile pictures** — upload/remove modal + brown ring shipped 2026-04-03
- [x] **Task 5 — Photo captions** — backend + display shipped 2026-04-03; inline caption editing UI in `ImageCarousel` shipped 2026-05-06.
- [x] **Task 6 — Map view** — `CollectionMap` component shipped 2026-04-03
- [ ] **Map View polish** — square map, search-area limit, viewport counts (P0, Bundle F — not started)
- [x] **Admin tools — Group member management** — `ProfileSearchDropdown` with debounced user search, wired into ManageAdmins flow. Shipped 2026-05-06.

---

## Not yet started — gates on closed beta (M3 + M4)

From the Beta Plan's Work Estimates table. These are not optional for release; they're just not Spats.

**Testing & polish (M3):**
- [ ] P0 & P1 design features — several POLISH items closed 2026-05-06 (NavProfileTag mobile/fixed-width, settings header avatar, RSVP autofill/dedup); remaining items in Notion POLISH epic
- [x] P0 & P1 bugs — three BUGS-epic tickets closed 2026-05-06: search filtering, empty message thread, empty posts guard
- [x] N+1 refactor sweep — systematic pass shipped 2026-05-06; three API routes consolidated, dead exports removed, shared field selectors extended. Follow-on: `FollowStats` still fetches full arrays for `.length` (should use `_count`)
- [ ] Non-offset pagination on collections
- [x] Edit posts after posting (Bundle E — needs design call)
- [x] Draft post/event behavior (Bundle E — needs design call)
- [x] Share Event/Post (Bundle I — standalone, not started)
- [ ] Event form required-field hints on Publish

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

- **2026-05-06 ** — Big orchestrator session: five bundles dispatched and completed (G, D, B, C, H). PostPageClient brought to parity with EventPageClient (DropdownProfileSelector, ShareButton, Message button). Seed fix: all posts now correctly `PUBLISHED`. Lint cleanup: ESLint `no-console` suppression for server paths, unused-var fixes. E2E tests updated for new seed data.
- **2026-05-06** — Bundle H: `ProfileSearchDropdown` component (debounced autocomplete, `GET /api/users/search`), wired into ManageAdmins. Display name bug fixed at the root (`createUser` now computes `displayName`).
- **2026-05-06** — Bundle C: About Page entry point via `AddElementButton` dropdown. Settings header avatar on `ProfileSettingsBase`. NavProfileTag fixed width (desktop `w-[200px]`, mobile avatar-only). Inline caption editing in `ImageCarousel`.
- **2026-05-06** — Bundle B: RSVP autofill (name/email from session) + existing-RSVP detection on page load via `getRsvpByEmail`.
- **2026-05-06** — Bundle D + G: N+1 sweep (three API routes consolidated, dead exports removed). Bug sweep (search filtering, empty DM thread seed fix, empty-post publish guard).
- **2026-05-06** — Component org cleanup: `profile-element/` dissolved, `TabbedPanel` moved to `layout/`, barrel exports removed, dead `cards/` directory deleted, stale `ImageUploadModal`/`FollowButton` stubs deleted.
- **2026-05-05 ** — Profile UX overhaul: `ProfileEditClient` (unified user+page), headline/location in header, WYSIWYG inline element editors, preview toggle. Dev DB re-migrated and re-seeded.
- **2026-05-05** — PR2 follow-up: `/profile`, `/settings`, `/connections` moved to session-scoped top-level routes.
- **2026-04-26** — PR2 URL flattening complete (all 17 tasks). Unified `/[handle]/` route tree.

---

## Blockers / open questions

- **Task 1 decision.** Page ownership model (ultimate Owner role vs current ADMIN) needs a call before microsite work touches permissions.
- **Bundle E design call.** Edit-after-post and draft post/event behavior both need a design decision before code.
- **FollowStats `_count`.** Follow-on from the N+1 sweep — `FollowStats` still fetches full follower/following arrays just for `.length`. Should add `_count` to `publicUserFields`/`publicPageFields`.

---

## How to use this doc

- **Claude reads this at session start** (configured in `.claude/CLAUDE.md`). 
- When something ships, move it from "In flight" to "Recently closed" with a date.
- When a blocker lifts, delete it — don't keep "solved in 04/03" historical notes here. This is *status*, not *history*. History lives in `JOURNAL.md`.
- When scope changes, edit the milestone section. Don't accumulate cruft.
