# Audit brief — Authorization & visibility leak sweep

> Report-only orchestration prompt. Paste into a fresh Claude Code session (Opus as
> orchestrator; fan out to Fable subagents). The deliverable is a findings doc, **not**
> code changes.

## GOAL
Find every path where a viewer can obtain content, existence, or private profile fields
they should not see under the three-tier visibility model — with special attention to the
known leak class: a gate present in one code path (SSR) but missing in its sibling (JSON API).

## SESSION BOOTSTRAP (read in parallel first)
- `docs/guidance/PROJECT_GUIDELINES.md` — stack, conventions, schema tree
- `docs/guidance/STATUS.md` — current milestone + the visibility work history
- `src/lib/utils/server/visibility.ts` — **the spec**; treat its rules as authoritative

## CONTEXT
The Project Library is a Next.js (App Router) + Prisma + Postgres app in open beta. All
visibility enforcement lives in one layer, `src/lib/utils/server/visibility.ts`. A prior
review already found and fixed one instance of the leak class described above; this audit
asks how many more remain across the full surface. Do NOT scatter new checks — the point
of the audit is to find where the existing layer is *not* applied, not to invent new rules.

## THE RULES TO AUDIT AGAINST (from visibility.ts — cite these)
- **Detail gates** — PUBLIC/UNLISTED pass; PRIVATE needs ownership OR a relationship edge
  (follow for users; follow OR membership for pages). Not-viewable AND missing must both
  return **404, never 403** — existence itself must not leak.
  (`requireViewableProfile` visibility.ts:173, `canViewProfile` :84, `canViewEvent` :117,
  `canViewPost` :133)
- **Global list / search** — only PUBLIC + the viewer's own content. UNLISTED and PRIVATE
  must **never** appear in global feeds or search.
  (`profileListWhere` :193, `eventListWhere` :201, `postListWhere` :216)
- **Own-collection** — anyone who reached an entity sees its PUBLIC+UNLISTED; PRIVATE only
  for owner / follower(user) / member-or-follower(page). (`collectionVisibilityWhere` :255)
- **Embeds** — nested selects (post author, event host, relationship rows) must not ship a
  private profile's fields or private related content to a viewer who can't see them.
- **Cascade** — child Post/Event visibility must track the parent. (`syncDescendantVisibility` :296)
- **Messaging** — conversation queries must be identity-scoped via `asPageId`; a page
  admin's personal inbox must not leak page conversations, and vice versa.
- **Viewer context** is built once per request via `getViewerContext` (visibility.ts:36).

## AXES — test every route against the full matrix
- Visibility: PUBLIC × UNLISTED × PRIVATE
- Viewer: anonymous · authed-unrelated · follower(user) · member(page) · follower(page) · owner/admin
- Entity: User profile · Page profile · Event · Post · relationship lists · messages · images

## SCOPE — fan out as PARALLEL read-only Fable subagents
Spawn via the Agent tool, `model: claude-fable-5`, read-only (Explore or general-purpose).
Give each the rules above + its slice + the per-finding format. Split by route family
(paths verified live under `src/app/api/`):

- **A. Profile detail + microsite** — `users/by-handle/[handle]`, `pages/[pageId]`, `me/*`,
  and the SSR `/[handle]` tree.
- **B. Content detail** — `posts/[id]`, `events/[id]`, `events/[id]/posts`, + their SSR pages.
- **C. Relationship / collection lists** — `pages/[pageId]/{events,posts,followers,following,members,membership,admins}`,
  `users/[userId]/{followers,following,memberships}`, `events/[id]/rsvps` (+`/counts`).
- **D. Global lists + search** — `posts`, `events`, `search/profiles`, `topics`.
- **E. Messaging identity-scoping** — `messages/{inbox,sent,unread-count}`,
  `messages/conversation/[targetId]`, `messages/[messageId]/read`.
- **F. Images / attachments / upload** — `images/*`, `image-attachments/*`, `upload`.
- **G. SSR↔API parity sweep (the known leak class)** — for every server component that
  renders gated content, confirm the JSON API serving the same data enforces the same gate.
  Flag any asymmetry.

## PER-FINDING OUTPUT (each subagent returns a JSON array of these)
```json
{ "route": "", "method": "GET|POST|PATCH|DELETE", "severity": "high|med|low",
  "viewer": "", "visibility": "", "leak": "what is disclosed",
  "evidence": "file:line + the missing/asymmetric check",
  "spec_rule": "which rule above it violates", "fix_sketch": "one line" }
```

## ORCHESTRATOR STEPS
1. Spawn A–G in parallel. 2. Dedupe + merge. 3. Rank by severity.
4. Write `docs/audits/visibility-findings-<date>.md`: summary table → findings →
   a "confirmed-safe" list (so coverage is explicit). 5. Note any route you could not reach.

## OUT OF SCOPE
- Fixing anything. Flag only — Laurel triages fixes.
- Adding new visibility *rules* — this audits application of the existing layer.
- Performance/N+1 concerns (separate audit).
