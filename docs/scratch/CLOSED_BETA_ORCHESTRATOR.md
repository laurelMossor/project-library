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

When Laurel picks a bundle (or you recommend one), produce a **self-contained prompt** in a copiable code block in the chat (not in this doc — briefs live in the conversation only).

**Structure:**
1. **Goal** — one-sentence outcome
2. **Session bootstrap** — which docs to read first (always include PROJECT_GUIDELINES.md and STATUS.md)
3. **Context** — brief project description, tech stack, enough for a cold start
4. **Scope** — numbered tasks, each with:
   - What the problem is
   - File paths *verified live* via Read/Grep (don't trust this doc or memory — check the codebase before writing the brief)
5. **Acceptance criteria** — checkboxes, including `npm run validate` for all work
6. **Out of scope** — explicit exclusions to prevent scope creep

**Tone:** Describe the problem and point at the relevant files, then get out of the way. Don't prescribe implementation details or dictate the approach — the receiving agent should think critically about *how* to solve it. Keep the brief concise; a wall of implementation notes pigeonholes the agent and prevents it from finding better solutions.

**Skill invocation:** When a bundle involves UI design work, tell the agent which `/skill` to invoke and at which phase (planning vs. implementation).

**Adapting to agent context:** If a bundle is going to the same agent that just finished a related bundle, write a shorter follow-up prompt. If it's a fresh agent, the prompt must be fully self-contained.

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

### Bundle A — Collection UX Polish (M3, no deps) DONE

**Shared surface:** `FilteredCollection`, `CollectionCard`, `CollectionPage`, `ProfileCollectionSection`

| Pri | Ticket | Key detail |
|---|---|---|
| P0 | [URL params not updating on sort/filter change](https://www.notion.so/314453d029b0800cb152db4bd924c0ae) | Removing/changing sorts and filters doesn't update the URL — user can't share a filtered view or use back button. |
| P1 | [Pin icon — invisible normally, appear on hover](https://www.notion.so/34d453d029b080f1babeca08f5a6aea5) | Pin icons currently always visible on cards. Should be hidden by default, shown on card hover. |
| P1 | [Empty state on profile collection views](https://www.notion.so/337453d029b080dfa8a0e228aa769c28) | When a profile has no posts/events, the empty state text is generic. Should be contextual ("No posts yet", "No events yet", etc.). |

**Parallelizable with:** B, C

---

### Bundle B+E — Form, Edit & About Polish (M3) DONE

**Shared surface:** `EventPageClient`, `PostPageClient`, `AboutPageClient`, form components, profile edit/settings views

| Pri | Ticket | Key detail |
|---|---|---|
| P0 | [About Page — delete interface](https://www.notion.so/358453d029b08036b60aeb8666687292) | About page works for add/edit. Missing: a way to delete/clear about content. |
| P1 | [Publish validation hints](https://www.notion.so/338453d029b080bcbe54d1e3e10c3979) | When you click Publish on an event/post with missing required fields, nothing tells you what's wrong. Need inline field-level error hints. |
| P1 | [Event page banner size limit too small](https://www.notion.so/357453d029b0804c823bd7118619a8c2) | 5MB limit rejects iPhone photos. Needs auto-compression. |
| P1 | [Edit Personal Info](https://www.notion.so/359453d029b08056af79e2b781d1a29b) | Private personal info form accessible from user settings. "Coming soon" for Pages. |

**Parallelizable with:** A, C

---

### Bundle C+F — Search, Landing & Beta Experience (M3+M4, design-driven)

**Shared surface:** Nav bar, landing page, login/signup, search UI, profile cards. Uses `/interface-design` skill.

| Pri | Ticket | Key detail |
|---|---|---|
| P0 | [Search for users/pages](https://www.notion.so/359453d029b080908086f537f312d9a1) | No visible way to search for users or pages. `/api/users/search` exists. Need search UI + rich profile result cards (ProfileTag fields + headline + top interests). |
| P1 | [Landing page — headers, images, links](https://www.notion.so/33f453d029b081c894e7ec188d8b9d4d) | 2×2 clickable image grid exists. Needs inviting headers for each image. |
| P1 | [Beta flag + notes at login/signup](https://www.notion.so/33f453d029b08113b251e16203ad4904) | Existing pre-beta warning on signup/login (`InviteCTA`). Review and extend to other sensible locations. |
| P1 | [Onboarding — "what is this?"](https://www.notion.so/33f453d029b0811ebebaf38ccd963c60) | New users have no guidance. Needs contextual onboarding. |

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
Phase 1 (done):                  A + B+E            ← shipped 2026-05-08
Phase 2 (design-driven):         C+F                ← search, landing, beta UX — uses /interface-design
Phase 3 (needs Laurel's copy):   G                  ← content pages
```
