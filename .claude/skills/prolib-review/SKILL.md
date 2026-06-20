---
name: prolib-review
description: >-
  Code review for The Project Library — runs the standard /code-review pass, then
  layers on Project Library's house rules and architectural invariants. Use this
  whenever the user wants to review a diff, branch, or PR for this project:
  "review my changes", "review this diff", "review the branch before I push",
  "code review this PR", "anything wrong with this?", or after finishing a feature
  and wanting a check before commit. Prefer this over a bare /code-review here,
  because the bare review doesn't know ProLib's conventions (route constants,
  server-util query layout, permission helpers, identity scoping) or its schema
  invariants (post/event mutual exclusion, draft visibility, conversation asPageId
  scoping). Not for QA/acceptance of a finished ticket against the running app —
  that's /prolib-qa.
---

# ProLib Code Review

Review changed code for The Project Library. This is a **two-layer** review:

1. **Universal correctness** — bugs, logic errors, security, quality. The built-in
   `/code-review` skill already does this well; don't re-implement it.
2. **Project Library fit** — the house rules and domain invariants a generic
   reviewer can't know. This skill exists for *this* layer.

Run layer 1, then apply layer 2. Report them together.

Most layer-2 findings are **rule violations**, so the **invariant checklist below is
the primary artifact.** The diagrams are supporting actors: they answer one structural
question fast — *"right layer / right enforcement point?"* — that prose alone makes you
trace by hand.

---

## Workflow

### 1. Run the standard review

Invoke the built-in **`/code-review`** on the current diff.

- **Default effort: `medium`.**
- **Escalate to `high`** when the diff touches any of: auth (`src/lib/auth.ts`,
  NextAuth), **permissions** (`src/lib/utils/server/permission.ts`, role checks),
  **visibility / messaging** (`src/lib/utils/server/visibility.ts`, conversations —
  identity scoping is a data-leak surface here), or the **Prisma schema**
  (`prisma/schema.prisma`). Correctness matters more than token cost there.
- Model: run on whatever the session is already using (Opus by default). Don't force
  a model switch.

### 2. Structural map — does the diff respect the layers?

Data flows **top-down through every layer.** The single highest-value structural
catch is a diff that *reaches past* a layer.

```
Client (RSC / "use client")
  └─ API route handlers — src/app/api/{auth,events,posts,pages,me,messages,follows,
        images,image-attachments,search,session,topics,upload,users,notion}/
        │  THIN: parse → authorize → delegate. Should NOT inline Prisma queries.
        ▼
  Permission / visibility gate — src/lib/utils/server/{permission.ts, visibility.ts}
        permission.ts: canPostAsPage, canManagePage, canManageEntity, hasPermission,
                       getPagesForUser, getUserMemberships, grant/revokePermission
        visibility.ts: getViewerContext, canViewUser/Page/Event/Post,
                       userListWhere/pageListWhere/eventListWhere/postListWhere,
                       syncChildPostVisibility, convertFollowersToMembers
        │  ENFORCEMENT POINT — mutations & reads pass through here.
        ▼
  Server-util query layer — src/lib/utils/server/{user,page,post,event,follow,
        message,rsvp,search,...}.ts
        │  ALL Prisma access lives here. Uses shared selectors from fields.ts:
        │   postWithUserFields, eventWithUserFields, *CollectionFields, imageFields…
        ▼
  Prisma — src/lib/utils/server/prisma.ts  →  DB
```

**Checkable rules this makes obvious — each is a finding:**
- A route handler or component that **calls Prisma directly** instead of going through
  the server-util query layer.
- A read of user/page/event/post content that **skips the visibility gate** — i.e. a
  raw `where` instead of the `*ListWhere` / `canView*` helpers in `visibility.ts`.
- A **mutation that writes without a `can*` permission check** first.
- A **hand-rolled Prisma `select`** instead of a shared selector from `fields.ts`.
- A **hardcoded path** instead of a constant from `src/lib/const/routes.ts`.

### 3. Entity invariants — derive shapes from the schema, check the rules

**Derive the entity shapes from `prisma/schema.prisma` at review time** (don't trust a
copy — the schema is the source of truth and changes). Then check the diff against these
stable invariants, which are the high-value catches:

- **Post / Event exclusivity.** A Post carries optional `pageId`, `eventId`,
  `parentPostId`. Schema enforces `DB CHECK: parentPostId IS NULL OR eventId IS NULL` —
  a post is an event-attachment **or** an update to another post, never both. Updates
  are **one level deep** (a child post can't have its own children).
- **Identity scoping (recurring bug).** Page-authored content stores `pageId`; child
  posts store it **redundantly**. Queries for a *user's own* content must filter
  `pageId: null`, or page-authored items leak into the personal view. Conversation /
  message queries must scope by **`asPageId`** — without it a page admin's personal
  inbox leaks page conversations.
- **Visibility cascade.** `Visibility` enum is `PUBLIC | UNLISTED | PRIVATE` (default
  `PUBLIC`) on User, Page, Event, Post. A Post's visibility **cascades from its parent**
  (`syncChildPostVisibility`); lowering a Page/Event/User to a more private state
  **converts followers → MEMBER** (`convertFollowersToMembers`). A diff that changes
  visibility but skips these helpers is a finding.
- **Draft visibility.** Events default to `DRAFT`; only `PUBLISHED` is publicly visible.
  A public-facing query that forgets the status filter (or bypasses the `*ListWhere`
  helpers) leaks drafts.
- **Permission creation.** Creating a Page must auto-create
  `Permission(userId, pageId, PAGE, ADMIN)`.

**Schema-design principles (when the diff changes the schema):** avoid open-ended enums;
prefer single-responsibility models.

### 4. Other house rules

- **Hand-written TS types** that duplicate schema shapes — the DB schema is the source
  of truth; prefer the schema-derived interfaces in `src/lib/types/` → flag.
- **Validation logic** outside `src/lib/validations.ts` → flag.
- **New re-exports** — the project bans them; import from the original location or move
  the function → flag.
- **Identity-aware UI** that refetches/derives identity instead of reading
  `ActiveProfileContext` (`activeEntity`, `activePageId`, `currentUser`) → flag.

### 5. Verify before reporting — don't trust this list over the code

Paths, function names, and invariants drift. Before reporting a layer-2 finding that
names a specific field, enum value, helper, or file, confirm it against the source of
truth — **`prisma/schema.prisma`** for schema/enum/relation claims, and
**`src/lib/utils/server/`**, **`src/lib/const/routes.ts`**, **`src/lib/validations.ts`**
for "this should live in X" claims. If the code and this skill disagree, **the code
wins** — report the discrepancy (and flag that this skill or `PROJECT_GUIDELINES.md`
needs updating) rather than emitting a false positive.

The authoritative convention list is **`docs/guidance/PROJECT_GUIDELINES.md`**; this
skill is a review checklist derived from it, not a second copy.

### 6. Report the findings

Combine both layers into one report. Lead with correctness/security, then Project
Library fit. For each finding give file:line, what's wrong, and the fix.

```
## Review: <branch / PR / diff>

### Correctness & security
- <finding> — file:line — <why + fix>

### Project Library fit
- <convention/invariant> — file:line — <what to change>

Nothing flagged in a section → say so explicitly.
```

If a finding is **ambiguous** (arguably-correct, needs a product/design call), flag it
for the user rather than asserting a verdict.

### 7. Discuss before planning — do NOT jump to a plan or to fixes

This review is a **conversation, not a hand-off.** After reporting, the default is to
*talk through* the findings with the user — never to immediately write a plan or start
editing. Specifically:

- **Go over the feedback together.** Walk the high-value findings, explain the *why* and
  how real each one is, and let the user react. Lead with the ones worth tracking; call
  the rest optional.
- **Settle scope explicitly.** Which findings get fixed now vs. filed as tickets vs.
  dropped? How aggressive should any refactor be — the PR's own code only, or the
  develop-side code it shares duplication with? Surface design forks (e.g. *where* a fix
  should live) and get a decision. Use `AskUserQuestion` for the genuine choices.
- **Wait for "we're done discussing."** Don't pre-empt the user by starting a plan while
  scope is still open.

### 8. Kick off a plan once the discussion concludes

Only when the user signals scope is settled, *then* move into planning for the agreed-on
changes — enter plan mode and produce an implementation plan (don't silently auto-apply
`/code-review --fix`). The plan covers only what was agreed, names the files/helpers to
reuse, and includes a verification section. When the changes are later implemented,
**prompt the user to run `npm run validate`** rather than running it yourself — it's
token-heavy.

---

## Keeping this skill from rotting (read once)

- **The diagrams are scoped to stable boundaries only** — the layer architecture and the
  entity model change rarely, which is why a diagram scoped to them survives. The layer
  diagram stays at the *directory* level (the dirs above), **never per-component**. The
  entity invariants are re-derived from `schema.prisma` at review time. The moment either
  starts listing individual components, it will rot — that's why there's no component-tree
  diagram here.
- **The checklist leads, the diagram supports.** Findings are rule violations; the diagram
  only answers "right layer / right enforcement point?"
