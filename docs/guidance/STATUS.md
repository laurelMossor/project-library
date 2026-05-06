# Project Library — Status

> Live tracker for where we are on the road to **closed beta release**. Update as things move; brevity is the feature. This is the single "where are we right now?" doc Claude reads at the start of every session.

**Last updated:** 2026-05-05 (evening)
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

Sourced from `docs/scratch/SPATS_LAUNCH.md` + the [Spats Launch Notion ticket](https://www.notion.so/2e1453d029b0801c9790fa897a7332eb). Check marks reflect the journal and in-repo notes.

PR1 (authoring unification) and PR2 (URL flattening) are both merged. PR3 (microsite) is now unblocked.

- [ ] **Task 1 — Page roles**: decide if Pages need an ultimate Owner (vs current ADMIN/EDITOR/MEMBER). Currently leaning toward "not yet."
- [x] **Task 2 — Microsite features**: `ProfileElement` table (LINK + TEXT kinds), `aboutContent` field, per-element WYSIWYG inline editing, platform auto-detection for links — shipped 2026-05-05.
- [ ] **Task 2a — About subpage**: `aboutContent` field exists and seeds correctly; no dedicated `/[handle]/about` route yet.
- [x] **Task 3 — Pinned posts** — schema + UI + max-3 enforcement shipped 2026-04-03
- [x] **Task 4 — Profile pictures** — upload/remove modal + brown ring shipped 2026-04-03
- [ ] **Task 5 — Photo captions** — implementation done, **no entry point to add captions yet**
- [x] **Task 6 — Map view** — `CollectionMap` component shipped 2026-04-03
- [ ] **Admin tools — Group member management** — not started (existing Notion ticket)

---

## Not yet started — gates on closed beta (M3 + M4)

From the Beta Plan's Work Estimates table. These are not optional for release; they're just not Spats.

**Testing & polish (M3):**
- [ ] P0 & P1 design features — triaged and ranked in the Notion POLISH epic
- [ ] P0 & P1 bugs — triaged and ranked in the Notion BUGS epic
- [ ] N+1 refactor sweep — partial work done 2026-03-23; no systematic pass yet
- [ ] Non-offset pagination on collections

**Beta details (M4):**
- [ ] Clear onboarding / "what is this?" / "how to"
- [ ] Beta flag + notes at login/signup
- [ ] Community guidelines page
- [ ] About page
- [ ] Landing page with images, links, and headers
- [ ] Research plan + first 5–10 user sessions

**Narrative gaps in the plan itself** (decisions needed, not just tickets):
- Moderation posture for the beta (lack thereof, flags, disclaimers)
- User expectations: data retention, what breaks, how to report
- What does the "something wrong?" escape hatch look like

---

## Recently closed (last ~2 weeks)

Most recent first. See `JOURNAL.md` for full entries.

- **2026-05-05** — PR2 follow-up: `/profile`, `/settings`, `/connections` moved to session-scoped top-level routes. Old handle-keyed manage routes (`/[handle]/profile`, `/[handle]/connections`, etc.) deleted. Three new thin client wrappers (`ProfilePageView`, `SettingsPageView`, `ConnectionsPageClient`) read `useActiveProfile()` from context. `HamburgerMenu` simplified; `"connections"` added to reserved handles.
- **2026-04-26** — PR2 URL flattening complete (all 17 tasks). `Handle` table as source of truth; `User.username` → `handle`, `Page.slug` → `handle`; unified `/[handle]/` route tree; all route constants replaced; `src/app/u/` and `src/app/p/` deleted; Playwright + Vitest tests updated throughout. `tsc`, `eslint`, and all tests clean.
- **2026-04-19** — PR1 authoring unification merged: `InlineEditSession` batched-save context, `PostStatus` DRAFT/PUBLISHED, simplified `/posts/new` + `/pages/new` create-and-redirect, dedicated edit routes deleted, new `PostPageClient`/`PageProfileClient`/`UserProfileClient`.

---

## Blockers / open questions

- **Caption entry point.** Image captions work but there's no UI to add them yet (Task 5).
- **Task 1 decision.** Page ownership model (ultimate Owner role vs current ADMIN) needs a call before microsite work touches permissions.

---

## How to use this doc

- **Claude reads this at session start** (configured in `.claude/CLAUDE.md`). 
- When something ships, move it from "In flight" to "Recently closed" with a date.
- When a blocker lifts, delete it — don't keep "solved in 04/03" historical notes here. This is *status*, not *history*. History lives in `JOURNAL.md`.
- When scope changes, edit the milestone section. Don't accumulate cruft.
