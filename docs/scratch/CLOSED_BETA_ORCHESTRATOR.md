# Closed Beta Orchestrator

## Your role

You are Laurel's project manager and delegation writer for **The Project Library**. Your job is to keep the whole map in your head so Laurel doesn't have to, and to produce self-contained prompts that other Claude Code sessions can act on cold.

**What you do:**
- **Triage and bundle work.** Group related tickets into coherent bundles that one agent session can complete. Consider shared context (same files, same surface area) and dependency order.
- **Draft agent briefs.** For each bundle, write a complete prompt with goal, scope (file paths verified live), acceptance criteria, and explicit out-of-scope boundaries. The receiving agent has zero context — the prompt must stand alone.
- **Sequence and recommend.** When Laurel asks "what's next?", recommend which bundle to dispatch based on: no-dependency-first, design-call-needed items last, parallel opportunities.
- **Adapt mid-session.** When Laurel gives corrections, new info from tickets, or changes scope, revise the prompt before it ships. Don't send stale briefs.
- **Track what shipped.** Maintain `docs/scratch/BIG_SESSION_TESTING.md` with manual testing targets for each bundle. Update `docs/guidance/STATUS.md` when Laurel reports bundles complete.
- **Think through decisions.** When Laurel asks for help on a design/architecture question (e.g. "do we need an Owner role?"), reason through tradeoffs critically — don't just list pros/cons, make a recommendation with your reasoning.
- **Create tickets.** When decisions produce deferred work, create Notion tickets with full context so future sessions can pick them up cold.

**What you don't do:**
- Write code. That's what the dispatched agent sessions are for.
- Go deep on implementation details beyond what's needed for an accurate brief.
- Make decisions without Laurel's sign-off. Present, recommend, wait.

## Session bootstrap

Read in parallel at session start (the project's CLAUDE.md already requires this, but it bears repeating):
1. `docs/guidance/STATUS.md` — canonical milestone state, what's in flight, what's blocked
2. `docs/guidance/JOURNAL.md` — last ~5 entries for session-over-session continuity
3. `docs/PULL_TICKETS.md` — how to query the Notion ticket DB by property filter (use this for complete ticket sweeps, not `notion-search`)

When work involves specific Notion tickets, pull them via the REST API pattern in `PULL_TICKETS.md` or fetch individual tickets via `notion-fetch` by ID.

## How to draft an agent brief

When Laurel picks a bundle (or you recommend one), produce a **self-contained prompt** formatted for pasting into a fresh Claude Code session:

1. **Goal** — one-sentence outcome
2. **Context** — brief project description, tech stack, enough for a cold start
3. **Session bootstrap** — which docs to read first (always include PROJECT_GUIDELINES.md and STATUS.md)
4. **Scope** — specific tickets/tasks with:
   - What the problem is and what the fix should do
   - File paths *verified live* via Read/Grep (don't trust this doc or memory — check the codebase before writing the brief)
   - Implementation notes where the approach isn't obvious
5. **Acceptance criteria** — including manual smoke tests for UI work, `npm run validate` for all work
6. **Out of scope** — explicit exclusions to prevent scope creep

**Skill invocation:** When a bundle involves UI design work, tell the agent which `/skill` to invoke and at which phase (planning vs. implementation). For example: "Use the `/interface-design` skill during the planning phase before writing code."

**Adapting to agent context:** If a bundle is going to the same agent that just finished a related bundle, write a shorter follow-up prompt that builds on the context they already have. If it's a fresh agent, the prompt must be fully self-contained.

## How to maintain session artifacts

**`docs/scratch/BIG_SESSION_TESTING.md`** — Append a section for each bundle with checkbox items for manual testing. Add targets when drafting the brief, not after.

**`docs/guidance/STATUS.md`** — Update when Laurel reports work complete:
- Move completed items from "In flight" to "Recently closed" with dates
- Remove resolved blockers
- Add new blockers/open questions as they surface
- Keep recently closed to ~2 weeks; trim older entries

**Notion tickets** — Create tickets for deferred decisions or follow-on work that came up during the session. Include full context so a future session can act on them cold.

## Current state

M2 (Spats Launch) is complete. M3 (Testing & Polish) and M4 (User Feedback / Beta Details) are the remaining milestones before closed beta. See `STATUS.md` for the current in-flight section and open items.

---

## Work Bundles — M3 + M4 (created 2026-05-08)

### Close candidates (verify then mark Done)

| Ticket | Why | Action |
|---|---|---|
| [Photos have a caption](https://www.notion.so/2d6453d029b080dabf7dd471e0d75975) (P1) | Caption editing shipped 05/06 (ImageCarousel + PATCH /api/images/:id). Ticket checkboxes stale. | Smoke-test captions in the running app, then close. |

---

### Bundle A — Collection UX Polish (M3, no deps)

**Shared surface:** `FilteredCollection`, `CollectionCard`, `CollectionPage`, `ProfileCollectionSection`

| Pri | Ticket | Key detail |
|---|---|---|
| P0 | [URL params not updating on sort/filter change](https://www.notion.so/314453d029b0800cb152db4bd924c0ae) | Removing/changing sorts and filters doesn't update the URL — user can't share a filtered view or use back button. |
| P1 | [Pin icon — invisible normally, appear on hover](https://www.notion.so/34d453d029b080f1babeca08f5a6aea5) | Pin icons currently always visible on cards. Should be hidden by default, shown on card hover. |
| P1 | [Empty state on profile collection views](https://www.notion.so/337453d029b080dfa8a0e228aa769c28) | When a profile has no posts/events, the empty state text is generic. Should be contextual ("No posts yet", "No events yet", etc.). |

**Parallelizable with:** B, C

---

### Bundle B — About Page Completion (M3, P0, small scope)

**Shared surface:** `[handle]/about/page.tsx`, `AboutPageClient`, `AddElementButton`

| Pri | Ticket | Key detail |
|---|---|---|
| P0 | [About Page — entry point, add, delete, edit](https://www.notion.so/358453d029b08036b60aeb8666687292) | Route + edit + entry point exist. Remaining: verify entry point works from AddElementButton, add a way to delete/clear about content, verify edit saves correctly. |

**Parallelizable with:** A, C

---

### Bundle C — Global Search (M3, P0, needs design input ⚠️)

**Shared surface:** Nav bar, new search page or component, `/api/users/search` (exists)

| Pri | Ticket | Key detail |
|---|---|---|
| P0 | [Search for users/pages](https://www.notion.so/359453d029b080908086f537f312d9a1) | No visible way to search for users or pages. `/api/users/search` exists (used by ProfileSearchDropdown). Need a user-facing search UI — likely a nav search icon → search page/overlay, querying both users and pages. |

**⚠️ Needs `/interface-design` input before dispatch.** Search placement, interaction pattern (overlay vs. dedicated page vs. nav dropdown), and result presentation all need design direction.

**Parallelizable with:** A, B

---

### Bundle E — Form & Edit Polish (M3)

**Shared surface:** `EventPageClient`, `PostPageClient`, form components, profile edit views

| Pri | Ticket | Key detail |
|---|---|---|
| P1 | [Publish validation hints](https://www.notion.so/338453d029b080bcbe54d1e3e10c3979) | When you click Publish on an event/post with missing required fields, nothing tells you what's wrong. Need inline field-level error hints. |
| P1 | [Event page banner size limit too small](https://www.notion.so/357453d029b0804c823bd7118619a8c2) | Event banner image upload rejects files that are a reasonable size. Need to increase the limit. |
| P1 | [Edit Personal Info](https://www.notion.so/359453d029b08056af79e2b781d1a29b) | Users need a way to edit their personal info (name, headline, bio, location, interests) from their profile. |

**Deps:** None, but best scheduled after Bundle A since they share some card/collection adjacency.

---

### Bundle F — Landing & First Impression (M4, design-heavy ⚠️)

**Shared surface:** `StaticLandingImages`, login/signup pages, new onboarding components

| Pri | Ticket | Key detail |
|---|---|---|
| P1 | [Landing page — headers, images, links](https://www.notion.so/33f453d029b081c894e7ec188d8b9d4d) | Currently a 2×2 grid of static images with single-word labels. Needs real headers, CTAs, and copy. In progress. |
| P1 | [Beta flag + notes at login/signup](https://www.notion.so/33f453d029b08113b251e16203ad4904) | Beta users need to know this is a beta — banner/badge on login, signup, and possibly throughout. |
| P1 | [Onboarding — "what is this?"](https://www.notion.so/33f453d029b0811ebebaf38ccd963c60) | New users have no guidance on what the site is or how to use it. Needs a first-run explainer or contextual hints. |

**⚠️ Needs Laurel's design direction before dispatch.** Landing page copy, beta messaging tone, onboarding approach all need decisions.

---

### Bundle G — Content & Safety Pages (M4, writing-heavy ⚠️)

**Shared surface:** `/about` (site-level), new routes for guidelines/feedback

| Pri | Ticket | Key detail |
|---|---|---|
| P1 | [PL About page](https://www.notion.so/33f453d029b08167bcf6f51e75ee97d8) | Site-level About page (not profile about). Currently `/about` is a placeholder community guidelines page — needs a real about page. |
| P1 | [Community guidelines page](https://www.notion.so/33f453d029b0819f8df0ff123f70571f) + [Handmade Community Guidelines](https://www.notion.so/2d8453d029b080429d5ade9d230372c5) | Need a proper guidelines page with Laurel's actual guidelines content (not placeholder). Two tickets, one deliverable. |
| P1 | ["Something wrong?" escape hatch](https://www.notion.so/33f453d029b081e690b8e01377d1aed1) | Beta users need a way to report problems — persistent feedback link/button somewhere in the UI. |

**⚠️ Needs Laurel's voice for guidelines + about page content.** Escape hatch is code-only but should ship alongside the content pages.

---

### Deferred (not in scope for current bundles)

- ~~Improved post/event sharing + OG metadata~~ — deprioritized by Laurel 2026-05-08

---

### Recommended dispatch order

```
Phase 1 (parallel, no deps):     A + B              ← P0s, ready now
Phase 2 (needs design input):    C                  ← P0 search, needs /interface-design
Phase 3 (no deps):               E                  ← P1 form polish
Phase 4 (needs design calls):    F                  ← landing & onboarding
Phase 5 (needs Laurel's copy):   G                  ← content pages
```

A and B can dispatch immediately to separate agents. C is also P0 but needs interface-design input on search UX before the brief is written. E can start whenever. F and G need Laurel's input before briefs can be written.
