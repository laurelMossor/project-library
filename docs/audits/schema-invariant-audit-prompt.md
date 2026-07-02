# Audit brief — Schema-invariant enforcement sweep

> Report-only orchestration prompt. Paste into a fresh Claude Code session (Opus as
> orchestrator; fan out to Fable subagents). The deliverable is a findings doc, **not**
> code changes.

## GOAL
For each schema invariant, trace every write path and classify enforcement as **ENFORCED**
(DB constraint or a shared server-util guard), **CALLER-DISCIPLINE** (works only if the
caller happens to pass the right thing), or **UNGUARDED** (a bad write would succeed) — so
we know which invariants are protected by mechanism vs. by memory.

## SESSION BOOTSTRAP (read in parallel first)
- `docs/guidance/PROJECT_GUIDELINES.md` — stack, conventions, schema tree
- `prisma/schema.prisma` — the invariants live in the model comments; treat as the spec
- `src/lib/utils/server/` — where write paths should funnel (permission.ts, post.ts, event.ts, …)

## CONTEXT
The Project Library is a Next.js (App Router) + Prisma + Postgres app in open beta. Several
data-integrity invariants are documented in `schema.prisma` comments but enforced unevenly —
some by DB CHECK/unique constraints, some only by whichever route remembered to guard them.
Write paths are the API routes under `src/app/api/` and the server utils under
`src/lib/utils/server/`.

## SCOPE — invariants to audit (cite `file:line`)
Trace **create AND update** paths for each; a bad edit is as dangerous as a bad create.
1. **Post: `parentPostId` XOR `eventId`** — DB CHECK claimed (schema.prisma:319). Verify the
   constraint exists in a migration and that no write path can violate it.
2. **Post updates cannot nest** (an update can't have children) — app-enforced only. Find the guard.
3. **Child posts store `pageId` redundantly** — must stay in sync with the parent on create AND edit.
4. **Follow: exactly one follower** (`followerId` XOR `followerPageId`) **and exactly one followee**
   (`followingUserId` XOR `followingPageId`) — DB CHECK claimed (schema.prisma:421–423). Verify + verify writes.
5. **ConversationParticipant: exactly one of `userId`/`pageId`** (schema.prisma:523).
6. **ProfileElement: exactly one of `userId`/`pageId`** (schema.prisma:585).
7. **Handle: exactly one of `userId`/`pageId`; handle always stored lowercase** (schema.prisma:264–275).
8. **Page-authored content** (Post/Event with `pageId`): writer must hold ADMIN/EDITOR on that page.
   Check create AND author-switch (PATCH `pageId`) paths. (`canPostAsPage` in permission.ts)
9. **Creating a Page auto-creates `Permission(userId, pageId, PAGE, ADMIN)`** — atomic with page create.
10. **Only PUBLISHED posts/events surface publicly**; the publish transition validates non-empty content server-side.
11. **Rsvp uniqueness by `[eventId, email]`** (schema.prisma:412) — upsert, not duplicate insert.
12. **`emailVerified` gates login; password reset bumps `tokenVersion`** and invalidates existing JWTs.
13. **Visibility cascade + inheritance** correctness (`resolveParentVisibility`, `syncDescendantVisibility`
    in visibility.ts) — cross-check with the visibility audit if both are run.

## FAN-OUT — parallel read-only Fable subagents
Spawn via the Agent tool, `model: claude-fable-5`, read-only. Cluster:
- **1 — content tree:** invariants 1, 2, 3, 10, 11
- **2 — polymorphic XOR:** invariants 4, 5, 6, 7
- **3 — authz / identity:** invariants 8, 9, 12
- **4 — visibility integrity:** invariant 13

Each returns, per invariant: status (ENFORCED / CALLER-DISCIPLINE / UNGUARDED), the write
paths inspected (`file:line`), a concrete bad-write that would slip through if any, and whether
a DB constraint or a shared server-util guard is the right home for the fix.

## ORCHESTRATOR STEPS
Merge into `docs/audits/schema-invariant-findings-<date>.md`: one row per invariant
(status · where enforced · gap · recommended guard location). Flag every UNGUARDED and
CALLER-DISCIPLINE case as an action item. Report only — no fixes.

## OUT OF SCOPE
- Fixing anything. Flag only.
- Visibility *access-control* leaks (that's the sibling visibility audit) except invariant 13's integrity angle.
- Performance concerns.
