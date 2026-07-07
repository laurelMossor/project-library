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
  invariants (post/event mutual exclusion, two-field profile/content visibility,
  draft gating, conversation asPageId scoping). Not for QA/acceptance of a finished
  ticket against the running app — that's /prolib-qa.
---

# ProLib Code Review

Review changed code for The Project Library. This is a **two-layer** review:

1. **Universal correctness** — bugs, logic errors, security, quality. The built-in
   `/code-review` skill already does this well; don't re-implement it.
2. **Project Library fit** — the house rules and domain invariants a generic
   reviewer can't know. This skill exists for *this* layer.

Run layer 1, then apply layer 2. Then check whether the diff's **tests** protect
the change — meaningful coverage gaps and weak tests (step 5). Report them together.

Most layer-2 findings are **rule violations**, so the **invariant checklist below is
the primary artifact.** The diagrams are supporting actors: they answer one structural
question fast — *"right layer / right enforcement point?"* — that prose alone makes you
trace by hand.

---

## Workflow

### 1. Run the standard review

Invoke the built-in **`/code-review`** on the current diff.

- **Default effort: `high`.**
- **Escalate to `xhigh`** when the diff touches any of: auth (`src/lib/auth.ts`,
  NextAuth), **permissions** (`src/lib/utils/server/permission.ts`, role checks),
  **visibility / messaging** (`src/lib/utils/server/visibility.ts`, conversations —
  identity scoping is a data-leak surface here), or the **Prisma schema**
  (`prisma/schema.prisma`). Correctness matters more than token cost there.
- **When escalating for visibility/messaging, also read `docs/VISIBILITY_RULES.md`**
  before the layer-2 pass — it's the durable contract layer 2 checks against, with its
  own route checklist (§3) and known anti-patterns (§4).
- Model: run on whatever the session is already using. Don't force a model switch.

### 2. Structural map — does the diff respect the layers?

Data flows **top-down through every layer.** The single highest-value structural
catch is a diff that *reaches past* a layer.

```
Client (RSC / "use client")
  └─ API route handlers — src/app/api/{auth,events,posts,pages,me,messages,follows,
        images,image-attachments,requests,search,session,topics,upload,users,notion}/
        │  THIN: parse → authorize → delegate. Should NOT inline Prisma queries.
        ▼
  Permission / visibility gate — src/lib/utils/server/{permission.ts, visibility.ts}
        permission.ts: canPostAsPage, canManagePage, canManageEntity, hasPermission,
                       getManagedPageIds (ADMIN/EDITOR — the authorization one),
                       getPagesForUser (MEMBER-inclusive — display only, never authz),
                       grant/revokePermission
        visibility.ts: getViewerContext, resolveProfileAccess/requireViewableProfile,
                       canViewPost/canViewEvent, requireViewablePost/requireViewableEvent,
                       postListWhere/eventListWhere/profileListWhere/
                       collectionVisibilityWhere, resolveParentVisibility,
                       syncDescendantVisibility
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
- **Two-field visibility.** The contract is **`docs/VISIBILITY_RULES.md`** — read it
  whenever the diff touches this; don't re-derive its rules here. `profileVisibility`
  (`PUBLIC | PRIVATE`, User/Page) governs the profile page; `contentVisibility`
  (`LISTED | UNLISTED | PRIVATE`, User/Page/Event/Post) governs where content surfaces.
  The high-value catches:
  - Content visibility is **derived, never client-set**. Create routes go through the
    `createPost`/`createEvent` utils, which call `resolveParentVisibility`
    (page → event → parentPost → user → `LISTED`). `contentVisibility` deliberately has
    **no schema default** so a raw `prisma.*.create` without it fails — a diff that
    re-adds a default, hardcodes a value, or accepts client visibility is a finding.
  - A profile's `contentVisibility` change cascades to descendants via
    **`syncDescendantVisibility`** in the same transaction; a `profileVisibility`-only
    change must **not** touch content.
  - A `PRIVATE` profile cannot pair with `LISTED` content (guarded in `saveMyProfile`).
  - PRIVATE profiles render an **identity-only locked stub** (no 404, no existence-deny);
    PRIVATE *content* the viewer can't see **404s, never 403**.
- **Draft visibility.** Posts *and* events default to `DRAFT`; only `PUBLISHED` is
  publicly visible. `requireViewablePost` / `requireViewableEvent` centralize the
  draft + visibility gate (owner/co-manager sees drafts; everyone else 404s) — gate
  detail **and mutation** routes with them *before* authorizing the edit. A
  public-facing query that forgets the status filter (or bypasses the `*ListWhere`
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

### 5. Test coverage — does the diff leave meaningful risk untested?

Look at the tests as part of the diff's surface, not an afterthought. Two checks,
both judged by one bar — **"would this meaningfully protect against a real
regression?"** — never line coverage for its own sake.

**a. Missing cases worth adding.** For the behavior this diff changes, is the
*risk-bearing* path tested? The high-value gaps are the **same invariants from
step 3** plus the security properties this codebase guards — and an invariant
with **no test at all** is the strongest finding this review produces. Watch for:
visibility gates **and the cascade/inheritance** (`syncDescendantVisibility`,
`resolveParentVisibility`), permission gates, identity scoping (`pageId: null` on
a user's own-content query, `asPageId` on conversation queries), draft-status
filtering, no-enumeration auth responses, and the mass-assignment whitelist.
Prefer a **unit test at the enforcement point** (mocked Prisma — fast, exact)
over leaning on an E2E that only walks the happy path. Flag a gap only when a
plausible future change would silently break the behavior and no existing test
would catch it — name the specific case and where it should live.

**b. Efficacy of tests in the diff.** When the diff adds or edits tests, check
each one earns its place:
- It asserts something real — not a body wrapped in `if (await x.isVisible())`,
  not "no error text" on a page that could be blank, not an assertion that only
  proves a mock was called.
- Its name matches what it verifies (a test that exercises the format gate must
  not claim to test the reserved-word check).
- Robust locators (role/label/text over CSS classes) and web-first assertions
  (no `waitForTimeout`/`networkidle`) — `tests/TESTING.md` holds the suite's
  conventions and the storageState/seed-actor model.
- It isn't a duplicate code-path or a constant-asserting canary.

Don't demand tests for trivial or presentational changes — the bar is *meaningful
protection*: security, data integrity, identity scoping, permission paths, and
regressions of bugs this diff (or a prior one) fixed. If coverage is already
adequate, say so explicitly rather than manufacturing a gap.

### 6. Verify before reporting — don't trust this list over the code

Paths, function names, and invariants drift. Before reporting a layer-2 finding that
names a specific field, enum value, helper, or file, confirm it against the source of
truth — **`prisma/schema.prisma`** for schema/enum/relation claims,
**`docs/VISIBILITY_RULES.md`** for visibility-rule claims, and
**`src/lib/utils/server/`**, **`src/lib/const/routes.ts`**, **`src/lib/validations.ts`**
for "this should live in X" claims. If the code and this skill disagree, **the code
wins** — report the discrepancy (and flag that this skill or `PROJECT_GUIDELINES.md`
needs updating) rather than emitting a false positive.

The authoritative convention list is **`docs/guidance/PROJECT_GUIDELINES.md`**; this
skill is a review checklist derived from it, not a second copy.

### 7. Report the findings

Combine the layers into one report. Lead with correctness/security, then Project
Library fit, then test coverage. For each finding give file:line, what's wrong,
and the fix.

```
## Review: <branch / PR / diff>

### Correctness & security
- <finding> — file:line — <why + fix>

### Project Library fit
- <convention/invariant> — file:line — <what to change>

### Test coverage
- <missing case worth adding | weak or misleading test> — file:line — <the risk it protects + the case to add/fix>

Nothing flagged in a section → say so explicitly.
```

If a finding is **ambiguous** (arguably-correct, needs a product/design call), flag it
for the user rather than asserting a verdict.

### 8. Discuss before planning — do NOT jump to a plan or to fixes

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

### 9. Kick off a plan once the discussion concludes

Only when the user signals scope is settled, *then* move into planning for the agreed-on
changes — enter plan mode and produce an implementation plan (don't silently auto-apply
`/code-review --fix`). The plan covers only what was agreed, names the files/helpers to
reuse, and includes a verification section. Verify with **targeted checks** (the
affected unit/E2E tests, a typecheck of touched files). Don't run `npm run validate`
and don't ask the user to run it either — it's the CI merge gate and runs
automatically on every PR.

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
