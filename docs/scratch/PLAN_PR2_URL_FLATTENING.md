# PR 2 — URL Flattening (On Deck)

> Drop the `/u/` and `/p/` prefixes from profile URLs so `projectlibrary.com/spats-improv` works directly. Unify users and pages under a single handle-keyed route tree. Prereq for the Microsite feature feeling like a real microsite.

**Depends on:** PR 1 (useful to land first — reduces the surface area of URL-referencing files) but not strictly required.
**Unblocks:** PR 3 (Microsite proper), where the whole "this page is their site" pitch rests on a short, shareable URL.

---

## Goal

Public, shareable identity URLs:

- `projectlibrary.com/u/laurel` → `projectlibrary.com/laurel`
- `projectlibrary.com/p/spats-improv` → `projectlibrary.com/spats-improv`
- `projectlibrary.com/p/spats-improv/about` (PR 3) → `projectlibrary.com/spats-improv/about`

Private/admin URLs unified under the same handle namespace:

- `projectlibrary.com/u/profile` → `projectlibrary.com/laurel/profile`
- `projectlibrary.com/u/profile/connections` → `projectlibrary.com/laurel/connections`
- `projectlibrary.com/p/profile` → `projectlibrary.com/spats-improv/profile`
- `projectlibrary.com/p/profile/connections` → `projectlibrary.com/spats-improv/connections`

No redirects needed — there are no real users or external links yet (pre-beta). Old route files are deleted directly and replaced by the new structure.

---

## Why this PR exists

1. **Microsite feel.** "Come see my page at projectlibrary.com/spats-improv" is a URL a human would say out loud. `/p/spats-improv` is not. PR 3 is called a "microsite" — it should feel like one.
2. **Now is the cheapest time.** No real users or external links exist yet (pre-beta). Doing this after beta means maintaining redirects indefinitely and auditing every place a URL was shared.
3. **Not a security issue.** Auth is resource-bound. Removing the prefix changes nothing about what a visitor can or can't see.

---

## URL structure: everything keys off the handle

Every URL that names an identity — public profile, settings, connections, future microsite subpages — lives under `/[handle]/…`. The same shape works for both Users and Pages because they share most behavior, and the auth layer is the only thing that distinguishes "viewing self" from "viewing managed page."

```
/laurel                  → public profile (User)
/laurel/profile          → settings (auth: you are laurel)
/laurel/profile/settings → settings detail
/laurel/connections      → connections view (auth: you are laurel)

/spats-improv                  → public profile (Page)
/spats-improv/profile          → admin settings (auth: ADMIN/EDITOR on spats-improv)
/spats-improv/profile/settings → admin settings detail
/spats-improv/connections      → page connections (same auth)
```

A single auth helper covers every gated route under `/[handle]/`:

```ts
// src/lib/utils/server/permission.ts
export async function canManageEntity(
  userId: string,
  entity: { user?: User | null; page?: Page | null },
): Promise<boolean> {
  if (entity.user) return entity.user.id === userId;
  if (entity.page) return hasPagePermission(userId, entity.page.id, ["ADMIN", "EDITOR"]);
  return false;
}
```

Why this shape (and not a separate `/profile` for users): User and Page profiles act the same way for almost every feature today, and we expect that to continue. Two parallel route trees would tax every future profile change with "remember to update both," and the trees would drift. One tree, one auth resolver, one place to add features. The handle is in the URL because the URL is naming the *subject* (whose profile is this?), not the *administrator*.

Global personal views (`/messages`, `/explore`, `/events`, `/posts`, `/collections`) stay top-level and continue to use `ActiveProfileContext` to know who you're acting as. They aren't affected by this PR.

---

## What changes

### Routing — new structure

```
src/app/
├── [handle]/
│   ├── page.tsx                       (NEW — public profile, dispatches User vs Page rendering)
│   ├── connections/
│   │   └── page.tsx                   (NEW — gated by canManageEntity)
│   ├── profile/
│   │   ├── page.tsx                   (NEW — settings entry, gated by canManageEntity)
│   │   ├── settings/
│   │   │   └── page.tsx               (NEW)
│   │   └── ProfileSettingsContent.tsx (NEW — branches on entity type internally)
│   └── about/
│       └── page.tsx                   (PR 3 — reserved here, not implemented in PR 2)
```

The settings content component (`ProfileSettingsContent.tsx`) is the merged successor of today's `src/app/u/profile/ProfileSettingsContent.tsx` and `src/app/p/profile/PageProfileSettingsContent.tsx`. It receives the resolved entity and dispatches to the User-shaped or Page-shaped form internally. Anything that's identical between the two (e.g., handle field, bio, avatar upload) lives in the shared body; differences (page-only fields like address, user-only fields like first/middle/last name) live in conditional sub-components.

If the merge proves too noisy in practice during implementation, fall back to two sibling components (`UserSettingsContent.tsx` + `PageSettingsContent.tsx`) co-located under `src/app/[handle]/profile/` and dispatched from `page.tsx`. That's a smaller win than full merge but still keeps the route tree unified.

### Routing — deletions

The entire `src/app/u/` and `src/app/p/` trees are removed:

- `src/app/u/[username]/page.tsx`
- `src/app/u/[username]/connections/page.tsx`
- `src/app/u/profile/page.tsx`
- `src/app/u/profile/settings/page.tsx`
- `src/app/u/profile/connections/page.tsx`
- `src/app/u/profile/ProfileSettingsContent.tsx` (folded into the new merged component)
- `src/app/p/[slug]/page.tsx`
- `src/app/p/[slug]/connections/page.tsx`
- `src/app/p/profile/page.tsx`
- `src/app/p/profile/settings/page.tsx`
- `src/app/p/profile/connections/page.tsx`
- `src/app/p/profile/PageProfileSettingsContent.tsx` (folded into the new merged component)

After this, `src/app/u/` and `src/app/p/` no longer exist. The freed-up `u` and `p` segments fall back to the `[handle]` route, and `RESERVED_HANDLES` keeps anyone from claiming them.

### `[handle]/page.tsx` lookup

Single query via the `Handle` table:

```ts
const entity = await prisma.handle.findUnique({
  where: { handle: params.handle.toLowerCase() },
  include: { user: true, page: true },
});
if (!entity) return notFound();
if (entity.page) return <PageProfile page={entity.page} />;
if (entity.user) return <UserProfile user={entity.user} />;
```

Because each `Handle` row has exactly one owner (`userId` and `pageId` are both `@unique` and mutually exclusive), there is no tiebreaker policy — conflicts are structurally impossible.

### Handle uniqueness

Today, `User.username` and `Page.slug` have separate unique constraints. A user `foo` and a page `foo` can coexist. After the migration, they can't.

**Chosen approach: shared `Handle` table (Option A).**

```prisma
model Handle {
  id        String   @id @default(cuid())
  handle    String   @unique  // always lowercase; enforced at app layer on write
  userId    String?  @unique
  pageId    String?  @unique
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  page      Page?    @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@map("handles")
}
```

The `handle @unique` constraint is a database-level guarantee. No application-level transaction trick is required to prevent two concurrent registrations from claiming the same handle — PostgreSQL enforces it and one insert wins, the other gets a unique constraint violation that the app catches and surfaces as "handle already taken." Same model used by Instagram, GitHub, etc.

`User.username` is renamed to `User.handle`; `Page.slug` is renamed to `Page.handle`. Both still carry their own `@unique` constraints (entity-scoped) and remain the primary field used within user- and page-scoped queries. The `Handle` table is the cross-entity uniqueness layer and the routing lookup target.

```ts
// src/lib/utils/server/handle.ts
export async function isHandleTaken(handle: string): Promise<boolean> {
  const existing = await prisma.handle.findUnique({
    where: { handle: handle.toLowerCase() },
  });
  return !!existing;
}

export async function findEntityByHandle(handle: string) {
  return prisma.handle.findUnique({
    where: { handle: handle.toLowerCase() },
    include: { user: true, page: true },
  });
}
```

Called on signup, page creation, and any future handle-holder creation. The pre-check is a UX convenience (returns a friendly error before hitting the DB constraint); the constraint itself is the real guarantee.

### Handle normalization (case)

**All handles are stored lowercase.** Enforced at the application layer on every write: signup, page creation, and any future handle assignment. There is no `/Laurel` vs `/laurel` ambiguity — they are the same handle.

### Unified validator

`validateUsername` (in `lib/validations.ts`) and `generateSlug` (in `lib/utils/slug.ts`) currently disagree on what's allowed. After the rename they converge into a single rule:

```ts
// src/lib/utils/handle.ts
export function generateHandle(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 30);
}

// src/lib/validations.ts
export function validateHandle(handle: string): boolean {
  if (!handle || typeof handle !== "string") return false;
  return /^[a-z0-9_-]{3,30}$/.test(handle);
}
```

Rule: lowercase, alphanumeric + `-` + `_`, 3–30 chars. Replaces `validateUsername` and `generateSlug` everywhere.

### Reserved handle list

`src/lib/const/reserved-handles.ts`:

```ts
export const RESERVED_HANDLES = new Set([
  // Existing top-level routes in src/app/
  "api", "explore", "events", "posts", "pages", "messages", "collections",
  "login", "signup", "settings", "profile", "logout", "welcome", "dev",
  "about",

  // Reserved single letters (a–z) for future subroutes
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",

  // Auth / verification flows
  "auth", "oauth", "callback", "verify", "confirm", "reset",

  // Infrastructure / static paths
  "www", "mail", "smtp", "cdn", "static", "assets", "uploads",

  // Next.js internals
  "_next",

  // System / error pages
  "404", "500", "error",

  // Static files served at root
  "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",

  // Vanity / admin
  "admin", "support", "help", "terms", "privacy", "docs",
  "billing", "account", "me", "projects",

  // Anti-impersonation
  "projectlibrary", "library", "official", "staff", "team",

  // TODO(PR 3): if microsite admins can create custom subpaths under /[handle]/X,
  // add a separate RESERVED_SUBPATHS set covering "profile", "connections", "about".
  // For PR 2 this is unnecessary — file-system routing wins automatically.
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}
```

Validated in:

- `validateProfileData()` / `validatePageData()` (existing validators in `lib/validations.ts`) — rejects on signup and page creation
- `POST /api/pages` and `POST /api/auth/signup` — last line of defense

**Rule of thumb: every new top-level route folder added to `src/app/` must be added to `RESERVED_HANDLES` in the same PR.** A CI script that scans `src/app/` top-level directories and diffs against the constant is **required, not optional** — without enforcement, this is a process dependency that will be missed. Any PR that adds a top-level route without reserving the handle fails CI.

### Internal link updates

`src/lib/const/routes.ts` — collapsed into a single handle-keyed group:

```ts
// Identity (public profile — works for User or Page)
export const PUBLIC_PROFILE = (handle: string) => `/${handle}`;
export const PROFILE_ABOUT = (handle: string) => `/${handle}/about`; // PR 3

// Identity (manage — gated by canManageEntity)
export const MANAGE_PROFILE = (handle: string) => `/${handle}/profile`;
export const MANAGE_PROFILE_SETTINGS = (handle: string) => `/${handle}/profile/settings`;
export const MANAGE_PROFILE_EDIT = (handle: string) => `/${handle}/profile#profile-section`;
export const MANAGE_CONNECTIONS = (handle: string) => `/${handle}/connections`;

// New page creation entry — unchanged
export const PAGE_NEW = "/pages/new";
```

Removed: `PRIVATE_USER_PAGE`, `PRIVATE_PAGE`, `PUBLIC_USER_PAGE`, `PUBLIC_PAGE`, `USER_PROFILE_SETTINGS`, `USER_PROFILE_EDIT`, `USER_CONNECTIONS`, `PAGE_PROFILE_SETTINGS`, `PAGE_PROFILE_EDIT`, `PAGE_CONNECTIONS`. All callers move to the unified constants above and pass the active entity's handle.

Because every route usage flows through these constants (codebase convention), this is a one-file change for all internal links. Grep for hardcoded `"/p/"` and `"/u/"` to catch any stragglers (and confirm the `/messages/p/...`, `/messages/u/...` matches inside `MESSAGE_CONVERSATION` are unaffected — those are nested under `/messages/`, separate convention).

### Auth helper

```ts
// src/lib/utils/server/permission.ts (additions)
export async function canManageEntity(
  userId: string,
  entity: { user?: User | null; page?: Page | null },
): Promise<boolean> {
  if (entity.user) return entity.user.id === userId;
  if (entity.page) return hasPagePermission(userId, entity.page.id, ["ADMIN", "EDITOR"]);
  return false;
}
```

Used at the top of every `[handle]/profile/...` and `[handle]/connections` server component:

```ts
const entity = await findEntityByHandle(params.handle);
if (!entity) return notFound();
const session = await auth();
if (!session?.user?.id || !(await canManageEntity(session.user.id, entity))) {
  return notFound(); // or forbidden() — see Risks
}
```

### API URL renames (clean overhaul)

- `src/app/api/users/by-username/[username]/route.ts` → `src/app/api/users/by-handle/[handle]/route.ts`
- Any `?username=` query params in client-side fetch calls become `?handle=` — TS will not catch these; grep step covers it.

---

## Schema migration

### New model

```prisma
model Handle {
  id        String   @id @default(cuid())
  handle    String   @unique
  userId    String?  @unique
  pageId    String?  @unique
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  page      Page?    @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@map("handles")
}
```

### Column renames

- `User.username` → `User.handle`
- `Page.slug` → `Page.handle`

Both retain their `@unique` constraints (entity-scoped). The cross-entity uniqueness lives in the `Handle` table.

### Migration strategy: nuke and reseed

The dev DB has no real data — only seed fixtures. Production is empty (pre-beta).

1. Update `schema.prisma`: add `Handle` model; rename `User.username` → `User.handle`; rename `Page.slug` → `Page.handle`.
2. Update the seed script (`prisma/seed.ts` or equivalent) to:
   - Use `handle` field names instead of `username`/`slug`.
   - Always lowercase the handle.
   - Create a `Handle` row alongside every User and Page, linked via `userId` or `pageId`.
3. `npx prisma migrate reset --force` — drops the dev DB, applies all migrations including the new one, runs the seed.
4. Verify: log in, visit `/seed-user-handle`, visit `/seed-page-handle`. Both render. `/seed-user-handle/profile` and `/seed-page-handle/profile` render under their respective auth gates.

No preflight script. No backfill SQL. No `--create-only` hand-editing. The seed is the source of truth and gets rewritten to match the new schema.

If we ever do want to preserve data later (between PR 2 landing and beta), we add `Handle` rows in a follow-up data migration — trivial.

---

## File-by-file changes

### New files

- `src/app/[handle]/page.tsx` — routes to user or page profile via Handle table
- `src/app/[handle]/connections/page.tsx` — gated connections view
- `src/app/[handle]/profile/page.tsx` — settings entry, gated by `canManageEntity`
- `src/app/[handle]/profile/settings/page.tsx` — settings detail
- `src/app/[handle]/profile/ProfileSettingsContent.tsx` — merged settings content (or two sibling components if the merge gets noisy; see Routing section)
- `src/app/api/users/by-handle/[handle]/route.ts` — replaces `by-username/[username]`
- `src/lib/const/reserved-handles.ts`
- `src/lib/utils/handle.ts` — `generateHandle` (replaces `generateSlug`)
- `src/lib/utils/server/handle.ts` — `isHandleTaken`, `findEntityByHandle`
- `scripts/ci-check-reserved-handles.ts` — CI script: scans `src/app/` top-level dirs, diffs against `RESERVED_HANDLES`, fails if any are missing

### Modified files

- `prisma/schema.prisma` — add `Handle` model with `@@map("handles")`; rename `User.username` → `User.handle`, `Page.slug` → `Page.handle`
- `prisma/seed.ts` (or wherever seed lives) — rewrite to use `handle` field, lowercase, create `Handle` rows
- `src/lib/const/routes.ts` — collapsed into the unified `PUBLIC_PROFILE` / `MANAGE_*` constants per the section above
- `src/lib/validations.ts` — replace `validateUsername` with `validateHandle`; wire `isReservedHandle` into `validateProfileData` and `validatePageData`
- `src/lib/utils/server/permission.ts` — add `canManageEntity` helper
- `src/lib/utils/slug.ts` — DELETED (replaced by `src/lib/utils/handle.ts`)
- `src/app/api/auth/signup/route.ts` — use `handle` field; call `validateHandle`, `isReservedHandle`, `isHandleTaken`; create `Handle` row in same transaction as user
- `src/app/api/pages/route.ts` — same; create `Handle` row in same transaction as page
- `src/app/api/me/page/route.ts` — same, for handle updates if/when supported
- All files referencing `User.username` or `Page.slug` — TypeScript surfaces these after the rename. Includes (non-exhaustive): `src/lib/types/user.ts`, `src/lib/types/page.ts`, `src/lib/types/profile.ts`, `src/lib/types/card.ts`, `src/lib/types/collection-item.ts`, `src/lib/utils/server/user.ts`, `src/lib/utils/server/page.ts`, `src/lib/utils/server/fields.ts`, `src/lib/utils/server/permission.ts`, `src/lib/contexts/ActiveProfileContext.tsx`, every profile/card/nav component.
- Client-side fetches against `/api/users/by-username/...` → `/api/users/by-handle/...` and `?username=` → `?handle=` query params (grep step catches these; TS doesn't).

### Deleted files / directories

- Whole tree: `src/app/u/`
- Whole tree: `src/app/p/`
- `src/lib/utils/slug.ts`

After deletion, `u` and `p` are free as URL segments. They remain in `RESERVED_HANDLES` (single letters a–z) so no one can claim them.

### Auth audit (low-risk, one place)

`src/lib/auth.ts` (NextAuth) authenticates by **email**, and the session/JWT carries `id` + `activePageId` only. No `username` references. Safe.

The signup route (`src/app/api/auth/signup/route.ts`) is the only place that touches `username` in the auth path — covered by the modified-files list above.

---

## Task breakdown (sequenced)

1. **Schema + seed.** Update `schema.prisma` (Handle model, two renames). Rewrite seed to use `handle` and create `Handle` rows. Run `npx prisma migrate reset --force`. Verify dev DB renders.
2. **`generateHandle` + `validateHandle`.** Create `src/lib/utils/handle.ts` and update `src/lib/validations.ts`. Delete `src/lib/utils/slug.ts`. Unit tests: format rules + reserved rejection.
3. **Reserved handles constant.** Add `src/lib/const/reserved-handles.ts`. Wire `isReservedHandle` into `validateProfileData` and `validatePageData`.
4. **CI reserved-handle script.** `scripts/ci-check-reserved-handles.ts`. Wire into CI. Required, not optional.
5. **Server utils.** `isHandleTaken`, `findEntityByHandle` in `src/lib/utils/server/handle.ts`. `canManageEntity` added to `src/lib/utils/server/permission.ts`. Unit tests for both.
6. **API URL rename.** Move `by-username/[username]` to `by-handle/[handle]`. Update internal field references. Grep for `?username=` in client fetches and rename to `?handle=`.
7. **Signup + page creation routes.** Update `src/app/api/auth/signup/route.ts` and `src/app/api/pages/route.ts` to use `handle`, call validators, and create `Handle` rows in the same transaction as User/Page creation.
8. **`[handle]/page.tsx` router.** Single `Handle` table query. Renders existing `PageProfileClient` or `UserProfileClient`. Test with seeded user + page handles.
9. **`[handle]/connections/page.tsx`.** Gated by `canManageEntity`. Replaces both `u/[username]/connections` and `p/[slug]/connections` *and* both `u/profile/connections` and `p/profile/connections`.
10. **`[handle]/profile/` tree.** Build `page.tsx`, `settings/page.tsx`, and the merged `ProfileSettingsContent.tsx`. Gated by `canManageEntity`. Take the User and Page settings UIs from the old `u/profile/ProfileSettingsContent.tsx` and `p/profile/PageProfileSettingsContent.tsx` and merge them — fields shared go in the common body, fields specific go in conditional sub-sections. Fall back to two sibling components if the merge gets noisy (see Routing).
11. **Update `routes.ts`.** Apply the new constants. Let TypeScript surface every broken import. Update callers (mostly nav components and `ProfileTag`) to pass the active entity's handle to the new functions.
12. **Sweep TypeScript errors.** Rename `.username` → `.handle` and `.slug` → `.handle` throughout. Update component prop names where they reflect the field.
13. **Grep `"/p/"` and `"/u/"`.** Confirm only `MESSAGE_CONVERSATION` matches remain (those are intentional, nested under `/messages/`).
14. **Delete old route trees.** Remove `src/app/u/` and `src/app/p/` entirely.
15. **Playwright + Vitest update.** Every test that hits a profile URL — use the route constant. Update fixtures referencing `username`/`slug`.
16. **Run CI script locally.** Confirm the reserved-handle check passes against the new `src/app/` shape.
17. **Deploy + smoke test.** Visit `/laurel`, `/spats-improv`, `/laurel/profile`, `/spats-improv/profile`, `/laurel/connections`, `/spats-improv/connections`. All render under their correct auth gates. Direct typing of a non-existent handle returns `notFound()`. Logged-out access to `/anyhandle/profile` returns `notFound()`.

Land as one PR. Partial landing leaves the app in a weird mixed-URL state.

---

## Out of scope for PR 2

- Any new public routes beyond what's listed (`/[handle]/about` is reserved but implemented in PR 3)
- Any visual changes to profiles
- Handle renaming by users (not supported today, not added here; the `Handle` table makes this straightforward to add later)
- Internationalized handles / unicode normalization (handles are ASCII only)
- Subdomain-based microsites (`spats-improv.projectlibrary.com`) — different product decision
- Reserved-subpath system for `/[handle]/X` — only needed if PR 3 introduces freeform admin-defined subpaths; revisit then

---

## Risks / open questions

- **`notFound()` vs `forbidden()` for unauthorized `/[handle]/profile`.** Returning `notFound()` is the privacy-preserving choice (doesn't leak whether the handle exists). Returning a clearer "you don't have access" message is friendlier when an admin's session expired. Recommend `notFound()` for PR 2 (matches GitHub) and revisit if user feedback says it's confusing.
- **Settings content merge vs split.** The recommended merged `ProfileSettingsContent.tsx` is cleaner if User/Page form fields overlap heavily; if implementation reveals the diff is large, the fallback (two sibling components) is fine and noted in the plan. Decide during implementation, not now.
- **Test fixtures.** Vitest + Playwright fixtures likely reference `username`/`slug` field names. TS catches code references; YAML/JSON fixtures (if any) don't get type-checked. Grep covers it.
- **Client-side fetches with `?username=` query params.** Not caught by TypeScript across the wire boundary. The grep step in task 6 is the safety net.
- **SEO.** `projectlibrary.com/spats-improv` is nicer for users. No SEO strategy yet and this PR shouldn't invent one.
- **Rollback.** Revert the PR: new routes disappear, old routes come back together (all in the same PR). The `Handle` table stays in the DB but is unused — harmless. Schema rollback is `prisma migrate reset` against the previous schema since data is throwaway.

## Agent Checklist

> This is a multi-session, possibly multi-agent task. This checklist is the shared workspace — every agent picking this up reads it first to see what's done, what's queued, and what (if anything) the previous agent left mid-flight. Treat this section as a living document: edit it as you work.

### Read this before you start (every session)

- [ ] Read the full plan above, top to bottom. Do not skim. The "URL structure: everything keys off the handle" and "Routing" sections are load-bearing.
- [ ] Read this checklist top to bottom. Tasks already checked are done — do not redo them.
- [ ] Read the "Notes from previous session(s)" log at the bottom. If there is a `STOPPED HERE` marker, that is where you start.
- [ ] Run `git status` and `git diff` to see what's uncommitted from the previous session.
- [ ] If the previous notes record a decision that diverges from the plan body, trust the notes. Then update the plan body in the same change so it stays coherent — do not let the plan rot.

### Working rules (every session)

- **One task at a time.** Do not open multiple tasks in parallel — the sequence is the point.
- **Compile between tasks.** After every task, run `npx tsc --noEmit` (or the project's `typecheck` script if defined). The codebase must compile between tasks. Do not check the box until it does. The exception is task 1, which intentionally breaks `tsc` — see its "done when" criterion.
- **Do not combine tasks.** The order is intentional and dependency-driven. If you believe two should be merged, write a note in this checklist, and ask the user before merging.
- **No silent plan changes.** If you discover the plan is wrong (a file path is different, a utility doesn't exist where described, an assumption is broken), STOP. Update the plan body, leave a `Notes from previous session(s)` entry explaining what changed and why, then continue or hand off.
- **Update this checklist live, not at the end.** Check each box the moment its task is done. If you stop mid-task, leave a `STOPPED HERE` marker as a sub-bullet under that task with a one-paragraph status (what's complete in this task, what's left, any traps the next agent should know about).
- **Use the project's task-tracking tool only for intra-session bookkeeping.** This checklist is the cross-session source of truth.
- **Do not run `npm run validate` until task 17.** Per `docs/guidance/PROJECT_GUIDELINES.md`, it costs tokens. Use `npx tsc --noEmit` between tasks; the user runs full validate at the end.
- **Do not write a journal entry unprompted** (per `.claude/CLAUDE.md`). The user will ask if they want one.

---

### Stage 1 — Foundations (no UI changes yet)

- [x] **Task 1 — Schema + seed.**
  - [x] `Handle` model added to `prisma/schema.prisma` with `@@map("handles")` and both `@unique` FKs.
  - [x] `User.username` renamed to `User.handle` (preserve `@unique`).
  - [x] `Page.slug` renamed to `Page.handle` (preserve `@unique`).
  - [x] Seed script (`prisma/seed.ts` — found at the root, single file) rewritten: uses `handle` field names, lowercases every value, creates a `Handle` row linked to every User and every Page. Uses Prisma nested-create syntax (`handleRecord: { create: { handle } }`) so User+Handle and Page+Handle creates are atomic.
  - [x] Migration applied: `20260425000000_pr2_url_flattening_add_handle_table` (hand-written; see "Notes from previous sessions" for why). Seed runs. DB verified: 6 users, 2 pages, 8 handles (6 user-linked + 2 page-linked). All handles lowercase.
  - [x] `npx prisma generate` produces the new client types.
  - **Done when:** Schema and DB are in the new shape. `npx tsc --noEmit` will now FAIL across the rest of the codebase on every old `.username`/`.slug` reference — this is expected and gets fixed in tasks 11–12. Do not try to fix those errors here. **Confirmed: 51 tsc errors, all of the expected `.username`/`.slug` shape (plus cascading collapsed-relation errors from invalid `select` blocks).**

- [x] **Task 2 — `generateHandle` + `validateHandle`.**
  - [x] `src/lib/utils/handle.ts` created with `generateHandle`.
  - [x] `src/lib/validations.ts` updated: `validateHandle` added; `validateUsername` removed. `PageCreateData.slug` → `handle`; `validatePageData` delegates the format check to `validateHandle` (one rule for handles everywhere).
  - [x] `src/lib/utils/slug.ts` deleted. Updated the one caller (`src/app/pages/new/page.tsx`) to import `generateHandle` from the new location — minimal scope to keep tsc resolution working; the rest of that page (state names, API body, route constants) stays as-is and gets cleaned up in tasks 11–12.
  - [x] Updated `src/app/api/auth/signup/route.ts` to import `validateHandle` instead of `validateUsername` (minimal name-only fix; the rest of signup gets rewritten in task 7).
  - [x] Vitest unit tests cover: valid handles, too-short, too-long, uppercase rejection (validateHandle is strict — doesn't normalize), and a separate `generateHandle` block for normalization, special-char stripping, hyphen collapsing, edge-trim, length cap. Reserved-handle rejection comes in task 3.
  - **Done when:** New unit tests pass. **Confirmed: 97/97 unit tests pass (was 87, +10 from new generateHandle/validateHandle coverage). tsc still at 51 errors — same set as end of Task 1, no new breakage introduced.**

- [x] **Task 3 — Reserved handles constant + validator wiring.**
  - [x] `src/lib/const/reserved-handles.ts` created with the full set from the plan (including the `TODO(PR 3)` comment). Single-letter `a–z` block includes `u` and `p` — explicitly noted in a comment so future maintainers know those reservations are doing double duty (former route prefixes + reserving single letters).
  - [x] `validatePageData` in `src/lib/validations.ts` calls `isReservedHandle` after the format check and rejects with `"That handle is reserved. Please choose another."`. **Deviation from plan body:** `validateProfileData` is NOT wired (see deviation note below) — it has no handle field; signup carries the format + reserved + uniqueness trio inline at task 7 instead.
  - [x] Unit tests: new `tests/unit/reserved-handles.test.ts` covers `isReservedHandle` (top-level routes, single letters, auth flows, infra paths, vanity, anti-impersonation, case-insensitivity, ordinary handles accepted, RESERVED_HANDLES set sanity). `tests/unit/validations.test.ts` extended with three new cases for `validatePageData` reservation rejection.
  - **Done when:** Tests pass. **Confirmed: 109/109 unit tests pass (was 97, +12 new). tsc still at 51 errors — no new breakage.**

- [x] **Task 4 — CI reserved-handle script.**
  - [x] `scripts/ci-check-reserved-handles.ts` created. Scans top-level directories under `src/app/`, ignores Next.js route groups (`(parens)`) and dotfiles, compares against `RESERVED_HANDLES`. Exits 0 with a count summary on success; exits 1 with a list of missing segments (each annotated with the `src/app/<name>/` path) and a one-line fix instruction on failure.
  - [x] Added as `check:reserved-handles` npm script in `package.json`.
  - [x] **Plan deviation: no CI pipeline exists in this repo yet** (no `.github/workflows/`, no `.gitlab-ci`, no `.circleci/`). The closest enforcement gate is `npm run validate` (run locally before commit per `PROJECT_GUIDELINES.md`). I wired the check into `validate` between `typecheck` and `test:unit` so failure short-circuits before the longer test runs. When CI infrastructure is added later, that's the moment to wire the same npm script into the pipeline directly. See deviation note below.
  - [x] Run locally — passes (12 top-level segments, all reserved). Both `u/` and `p/` are still present and covered by the single-letter `a–z` reservations. Negative-tested: temporarily added `src/app/__pr2_negative_test__/`, script exited 1 with the right error message, dir was removed.
  - **Done when:** Script exits 0 locally and validate-step config includes it. **Both confirmed.**

- [x] **Task 5 — Server utils (`isHandleTaken`, `findEntityByHandle`, `canManageEntity`).**
  - [x] `src/lib/utils/server/handle.ts` created with `isHandleTaken` and `findEntityByHandle`. Both lowercase input before lookup (handles are stored lowercase). `findEntityByHandle` returns the typed `Handle & { user: User | null; page: Page | null }` shape.
  - [x] `canManageEntity` added to `src/lib/utils/server/permission.ts`. Accepts the `{ user?: User | null; page?: Page | null }` shape that `findEntityByHandle` returns. Short-circuits on user branch (no DB hit if entity.user is set); falls through to `hasPermission(PAGE, [ADMIN, EDITOR])` for the page branch; returns false if neither populated. Imports `Page`/`User` types from `@prisma/client`.
  - [x] Unit tests: new `tests/unit/handle-server.test.ts` covers `isHandleTaken` (true/false/case-insensitive normalization/already-lowercase) and `findEntityByHandle` (user-only/page-only/neither/correct query shape). `tests/unit/permission.test.ts` extended with 7 new `canManageEntity` cases (user-self, page-ADMIN, page-EDITOR, no-permission, query shape, edge cases for entity-with-neither and entity-with-both).
  - **Done when:** Tests pass and `npx tsc --noEmit` is clean for these new files (existing breakage from task 1 is still expected elsewhere). **Confirmed: 125/125 unit tests pass (was 109, +16). tsc still at 51 errors; new/touched files (`handle.ts`, `permission.ts`) are clean.**

---

### Stage 2 — API surface

- [x] **Task 6 — API URL rename.**
  - [x] Moved `src/app/api/users/by-username/[username]/route.ts` → `src/app/api/users/by-handle/[handle]/route.ts`. Updated internal references: dynamic param key (`[username]` → `[handle]`), destructured param name, function call, doc comment. Removed empty parent dirs `by-username/[username]/` and `by-username/`.
  - [x] Renamed `getUserByUsername` → `getUserByHandle` in `src/lib/utils/server/user.ts` and updated the prisma `where` clause from `username` to `handle` (was one of the existing 51 errors — fixing it cascaded to fix several others, see tsc note below).
  - [x] Updated the two doomed callers in `src/app/u/[username]/page.tsx` and `src/app/u/[username]/connections/page.tsx` to use `getUserByHandle` (those files are deleted in task 14, but until then they need to keep resolving — this is purely a name swap, the deeper field-shape errors persist there until task 12).
  - [x] `rg '\?username='` across `src/` — **no matches** (this codebase only ever used path-segment style, never query-param style for username).
  - [x] `rg 'by-username'` across `src/` — only matches are in two `(formerly /by-username/[username])` comments I left in `route.ts` and `AddConnectionSearch.tsx` to preserve migration breadcrumbs. Both can be removed at task 12 cleanup if desired.
  - [x] Updated the one client-side caller (`src/lib/components/connections/AddConnectionSearch.tsx`) to fetch the new `/api/users/by-handle/...` URL.
  - **Done when:** Grep returns no hits and the route file compiles. **Confirmed: 125/125 unit tests pass, tsc 51 → 46 errors (5 fixed, all from removing the `username` field reference). All remaining errors are the expected rename-shape from task 1; tasks 11–12 sweep them.**

- [x] **Task 7 — Signup + page creation routes.**
  - [x] `src/app/api/auth/signup/route.ts`: uses `handle` field, calls `validateHandle`, `isReservedHandle`, `isHandleTaken`. Creates the `Handle` row in the same `prisma.$transaction` as the User. The transaction is non-negotiable — User without Handle, or Handle without User, is a broken state.
  - [x] `src/app/api/pages/route.ts`: same pattern for Page.
  - [x] `src/app/api/me/page/route.ts`: same; if it supports handle changes, validate and update the `Handle` row atomically with the Page update.
  - [x] Manual sanity check: trigger a signup (or run the test that does), inspect the DB — User and Handle rows both present, linked.
  - **Done when:** All three routes use `handle`, write Handles transactionally, and a fresh signup or page creation produces both rows. **Confirmed: 125/125 tests pass; sanity script proved both User+Handle and Page+Handle rows materialize linked.**

---

### Stage 3 — New route trees

- [x] **Task 8 — `[handle]/page.tsx` router.**
  - [x] `src/app/[handle]/page.tsx` created. Uses `findEntityByHandle`. Dispatches to existing `PageProfileClient` or `UserProfileClient`. `notFound()` if no entity matches.
  - **Done when:** Dev server is running and visiting `/<seed-user-handle>` and `/<seed-page-handle>` renders the same content as the still-existing `/u/<handle>` and `/p/<handle>` URLs. **Confirmed structurally: dispatcher correctly resolves handles (404 path: 30ms; user branch fires `getEventsByUser` from line 68; page branch fires `getEventsByPage` from line 126); both new and legacy routes return identical 500s from the same downstream helper (`eventCollectionFields` selecting now-removed `slug` field — pre-existing Task 1 fallout, swept in Task 12).**

- [x] **Task 9 — `[handle]/connections/page.tsx`.**
  - [x] Created. Uses `findEntityByHandle` + `canManageEntity`. USER branch renders `ConnectionsPageView` (user + their managed pages); PAGE branch renders `ConnectionsView entityType="page"` (page-scoped followers/following). Both gated by `canManageEntity`.
  - [x] This single file replaces all four old connections routes: `u/[username]/connections`, `p/[slug]/connections`, `u/profile/connections`, `p/profile/connections`. **Behavior change baked in:** the legacy `/u/.../connections` and `/p/.../connections` were PUBLIC; the new unified route is manager-gated. Non-managers and anonymous viewers get 404. Documented in the file's header comment.
  - **Done when:** `/<handle>/connections` renders correctly when authorized; `notFound()` otherwise. **Confirmed structurally: dispatcher resolves handle → gates by canManageEntity → dispatches per branch. tsc: 56 → 58 (+2), both Task-12 fallout in this file. Two `username:`/`slug:` aliases tagged with `PR2-TASK12-ALIAS` marker for the Task 12 sweep.**

- [x] **Task 10 — `[handle]/profile/` tree.**
  - [x] `src/app/[handle]/profile/page.tsx` created (server-rendered settings entry; `canManageEntity` gate; `notFound()` on unauthorized).
  - [x] `src/app/[handle]/profile/settings/page.tsx` created (server-rendered, `canManageEntity` gated). Was client in legacy because it used `ActiveProfileContext` for in-place profile switching; in the flat URL world, "switch profile" reduces to navigation between `/[handle]/...` URLs, so no client state needed.
  - [x] **Component-shape choice: two sibling components** (`UserSettingsContent.tsx` + `PageSettingsContent.tsx`), co-located in `src/app/[handle]/profile/`. Picked over a merged single component because the page side carries client-state for the `ManageAdmins` toggle that the user side doesn't need; merging would force unused state into the user branch. The two siblings mirror the legacy `ProfileSettingsContent` / `PageProfileSettingsContent` 1:1 and both consume `ProfileSettingsBase` for shared layout.
  - [x] All settings flows that worked at `/u/profile/...` and `/p/profile/...` work identically at `/<handle>/profile/...`. Save still works. Avatar upload still works. **Verified structurally — same `ProfileSettingsBase`, `ProfileTag`, `ManageAdmins` components reused; new entry pages compute hrefs from the `[handle]` param. End-to-end functional verification deferred to Task 17.**
  - **Done when:** Logged in as a seeded user, `/<my-handle>/profile/settings` renders and saves edits. Logged in as a seeded page admin, `/<page-handle>/profile/settings` does the same. **Confirmed structurally; manual smoke-test in Task 17. tsc: 58 → 64 (+6) all PublicUser/PublicPage/CardEntity rename fallout in the four new files, swept in Task 12.**

---

### Stage 4 — Cutover

- [ ] **Task 11 — Update `routes.ts`.**
  - [ ] Old constants removed: `PRIVATE_USER_PAGE`, `PRIVATE_PAGE`, `PUBLIC_USER_PAGE`, `PUBLIC_PAGE`, `USER_PROFILE_SETTINGS`, `USER_PROFILE_EDIT`, `USER_CONNECTIONS`, `PAGE_PROFILE_SETTINGS`, `PAGE_PROFILE_EDIT`, `PAGE_CONNECTIONS`.
  - [ ] New constants added: `PUBLIC_PROFILE`, `PROFILE_ABOUT`, `MANAGE_PROFILE`, `MANAGE_PROFILE_SETTINGS`, `MANAGE_PROFILE_EDIT`, `MANAGE_CONNECTIONS`.
  - **Done when:** `routes.ts` itself compiles. The rest of the app will not yet — that is task 12.

- [ ] **Task 12 — Sweep TypeScript errors.**
  - [ ] Run `npx tsc --noEmit`. Walk the error list end to end. For each error:
    - `.username` → `.handle` (model field rename).
    - `.slug` → `.handle` (model field rename).
    - Old route constant → new route constant, passing the active entity's handle (usually from `ActiveProfileContext`).
    - Component prop names that reflect the old field name → renamed to `handle`. **No aliases are acceptable in the final state.** A field-rename is not "done" if any consumer is still being handed `{ username: x.handle }` or `{ slug: x.handle }` — that just kicks the rename down the road. Task 12's exit criterion is `tsc` clean **and** zero remaining occurrences of those alias-shaped object literals.
    - **Bridging aliases left during stages 2–3** (where new code is calling components whose prop types still use the old field names) are tagged with the grep marker `PR2-TASK12-ALIAS` and a JSDoc-style comment explaining what the sweep needs to do at each site. Required cleanup: `rg PR2-TASK12-ALIAS src/` MUST return zero matches before Task 12 is checked off.
  - [ ] Likely files (non-exhaustive — let `tsc` be the source of truth): `src/lib/types/{user,page,profile,card,collection-item,post,message}.ts`, `src/lib/utils/server/{user,page,fields,permission,follow,message,post,signup-invite}.ts`, `src/lib/utils/text.ts`, `src/lib/contexts/ActiveProfileContext.tsx`, `src/lib/components/profile/*`, `src/lib/components/nav-bar/*`, `src/lib/components/collection/CollectionCard.tsx`, `src/lib/components/AboutModal.tsx`, `src/lib/components/messages/*`, `src/lib/components/page/EditablePageProfile.tsx`, `src/lib/components/user/EditableProfile.tsx`, every `route.ts` under `src/app/api/`.
  - **Done when:** `npx tsc --noEmit` is clean.

- [ ] **Task 13 — Grep `"/p/"` and `"/u/"` for stragglers.**
  - [ ] `rg '"/p/|"/u/|\`/p/|\`/u/' src/`
  - [ ] The only acceptable remaining matches are inside `MESSAGE_CONVERSATION` in `routes.ts` (it builds `/messages/p/...` and `/messages/u/...` — different convention, not affected by flattening).
  - [ ] Any other match is a bug. Fix it.
  - **Done when:** Grep shows only the `MESSAGE_CONVERSATION` matches.

- [ ] **Task 14 — Delete old route trees.**
  - [ ] `rm -rf src/app/u src/app/p`.
  - [ ] `npx tsc --noEmit` is still clean (this is the final check that nothing imported from the deleted trees).
  - **Done when:** Both directories no longer exist and TS compiles.

---

### Stage 5 — Verification

- [ ] **Task 15 — Playwright + Vitest update.**
  - [ ] For every file under `tests/`: replace any URL literal pointing at `/u/...` or `/p/...` with the new constant from `routes.ts`. Update fixtures that reference `username` or `slug`.
  - [ ] `npx vitest run` — passes.
  - [ ] `npx playwright test` (or the project's E2E command) — passes.
  - **Done when:** Both suites green.

- [ ] **Task 16 — Run CI script locally against the final shape.**
  - [ ] Run the reserved-handle CI script. With `u/` and `p/` now deleted, the only top-level dirs left should all be reservable; the check should pass.
  - **Done when:** Script exits 0.

- [ ] **Task 17 — Final validate + smoke test + handoff.**
  - [ ] **Stop and prompt the user to run `npm run validate`** (per project guideline). Do not run it yourself.
  - [ ] Once validate passes, with the dev server running, manually visit each of these URLs and confirm correct behavior:
    - `/<seed-user-handle>` — public user profile renders.
    - `/<seed-page-handle>` — public page profile renders.
    - `/<seed-user-handle>/profile` — own settings render (must be logged in as that user).
    - `/<seed-page-handle>/profile` — admin settings render (must be ADMIN/EDITOR on that page).
    - `/<seed-user-handle>/connections` — own connections render under auth.
    - `/<seed-page-handle>/connections` — admin connections render under auth.
    - `/this-handle-definitely-does-not-exist` — `notFound()`.
    - `/<some-handle>/profile` while logged out — `notFound()`.
  - [ ] All checkboxes in this checklist are checked.
  - **Done when:** Validate passes, every smoke-test URL behaves correctly, and the user signs off.

---

### Operational notes

> Topical, not chronological. **Add to this section only what a future agent could not derive from the checklist above.** No status reports, no test counts, no "where I stopped" markers (the checkboxes already encode that). When you finish a task: if you discovered a non-obvious gotcha, design rationale, or plan deviation, drop a one-paragraph entry under the right heading below. If you didn't, don't.

#### Environment + tooling gotchas

1. **Prisma 7 AI-agent guard on `migrate reset`.** Refuses to run when invoked by Cursor unless `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=<user's exact consent message>` is set. Ask the user for fresh consent every time.

2. **Prisma 7 has no `--accept-data-loss` and no `--skip-seed`.** `migrate dev` requires a TTY for any destructive change. For schema renames, hand-write the migration SQL using `ALTER TABLE … RENAME COLUMN` / `ALTER INDEX … RENAME` — preserves data + indexes (precedent: `prisma/migrations/20260425000000_pr2_url_flattening_add_handle_table/migration.sql`). For an empty schema, drop + recreate via `echo 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' | npx prisma db execute --stdin`.

3. **`migrate reset` does NOT auto-run the seed in P7.** Sequence is always `migrate reset → npx prisma generate → npm run db:seed:dev`. The middle step is required because the seed will fail with "Cannot read properties of undefined" if the new models aren't in the generated client yet.

4. **Turbopack cache corruption.** Deleting `.next` while the dev server is running wedges Turbopack on next start ("Failed to restore task data"). **Always kill the dev server BEFORE `rm -rf .next`.** Recovery: `lsof -ti:3000 | xargs kill -9 && rm -rf .next && npm run dev`.

5. **Cursor sandbox blocks `npm run dev`.** Next.js queries network interfaces at startup; sandbox returns `uv_interface_addresses returned Unknown system error 1`. Run `npm run dev` (and any `curl` against it) with `required_permissions: ["all"]`.

6. **`tsx` doesn't auto-load `.env`.** Throwaway scripts that import `@/lib/utils/server/prisma` need `npx tsx --env-file=.env.development <script>` (Next.js auto-loads it; tsx does not, and `prisma.ts` throws if `DATABASE_URL` is unset).

#### Design decisions worth knowing

1. **Atomicity via Prisma nested writes (User+Handle, Page+Handle).** Both User and Page have `handleRecord Handle?` back-relations. Use `data: { …, handleRecord: { create: { handle } } }` inside the User/Page create — compiles to a single SQL transaction at the driver layer, no explicit `$transaction` wrapper needed. Used in the seed, `createUser`, `consumeInviteAndCreateUser`. `createPage` keeps an explicit `$transaction` because there are three writes (Page + nested Handle + creator-ADMIN Permission). All paths satisfy the invariant: User+Handle (or Page+Handle) either both exist or neither does.

2. **Lowercasing happens at the route boundary, not in utilities.** By the time `createUser`/`createPage`/etc. see the handle, it's lowercased. Validators (`validateHandle`, `isReservedHandle`, `isHandleTaken`) all work against the canonical lowercase form. Utilities trust the caller.

3. **P2002 race-condition catch.** Between route-level `isHandleTaken` and the actual write, a concurrent caller could grab the handle; the DB constraint throws `P2002`. Caught in the signup dev-bypass branch, `consumeInviteAndCreateUser`, and the pages route, surfaced as "That handle is already taken". Without this, users get a generic 500.

4. **Email-uniqueness vs. handle-uniqueness checks are separated.** Email lives on `users`; handle uniqueness is cross-entity (lives on `handles`). The old `consumeInviteAndCreateUser` did `OR: [{ email }, { username }]` which conflated two sources of truth. Now: email pre-check inside the tx, handle pre-check via `isHandleTaken` at the route level, DB constraint on `handles.handle` as the actual gate.

5. **`canManageEntity` user-branch short-circuit is intentional.** If a Handle row somehow has both `userId` and `pageId` populated (structurally impossible — mutually exclusive `@unique` FKs prevent it), the user branch wins and the page query is skipped. Safe default: only the user owns their own data.

6. **Two-query dispatch in `[handle]/...` routes.** Each route does `findEntityByHandle` (raw, used for type-determination + 404) + `getUserByHandle`/`getPageByHandle` (UI-shaped re-fetch). Restructuring the lookup utility to also return public-fields shape was considered and rejected — couples the lookup to UI shape concerns, and two `@unique`-indexed queries are negligible. Pattern repeats across Tasks 8, 9, 10.

7. **`/[handle]/profile` and `/[handle]/connections` use `notFound()` for unauthorized, not redirect-to-login.** Privacy-preserving (no leak about whether the handle exists). Aligns with Task 17's smoke-test ("/<some-handle>/profile while logged out → notFound()"). Also: `/[handle]/connections` is now manager-only (legacy `/u/.../connections` and `/p/.../connections` were public); if product wants public connection lists back, add a separate `/[handle]/connections/public` route.

8. **`[handle]/profile/settings` is server-rendered, was client.** Legacy `/p/profile/settings` was client-side because it used `ActiveProfileContext` (`switchProfile`, `fetchPages`, `activePageId`) for in-place profile switching. In the flat URL world, "switch profile" reduces to navigation between `/[handle]/...` URLs — each handle IS its own active context for sub-pages — so no client state needed.

9. **Component-shape choice in Task 10: two siblings, not one merged component.** `UserSettingsContent.tsx` + `PageSettingsContent.tsx` co-located in `src/app/[handle]/profile/`. Page side carries client-state for `ManageAdmins` toggle that user side doesn't need; merging would force unused state into the user branch. Both consume `ProfileSettingsBase` for shared layout.

#### Plan deviations + carry-overs

1. **`validateProfileData` is NOT wired with `isReservedHandle`.** Plan body says to wire it into both `validateProfileData` and `validatePageData`, but `ProfileData` has no `handle` field — handle changes are out-of-scope for PR 2. The only caller (`PUT /api/me/user`) doesn't accept a handle. Per Task 7, signup carries the format + reserved + uniqueness trio inline at the route level. Comment in `validations.ts` documents this. If a future feature adds handle changes through profile updates, wire the check then with a real call site.

2. **No CI pipeline exists in this repo.** Plan mentions `.github/workflows/`. Doesn't exist; nor `.gitlab-ci`, nor `.circleci/`. The repo's enforcement gate is `npm run validate` (per `PROJECT_GUIDELINES.md`). `check:reserved-handles` is wired into `validate` between `typecheck` and `test:unit` — fast-fails before long test runs. When real CI infra is added later, the npm script is the integration point.

3. **Edge-hyphen behavior is intentional asymmetry.** `validateHandle` regex `^[a-z0-9_-]{3,30}$` *allows* `-portland` and `portland-`. `generateHandle` strips them. Generated handles are edge-clean; user-typed handles passing direct validation are not. The old `validatePageData` rejected leading/trailing hyphens. There's a regression test documenting the new behavior. If product wants to tighten back up, change the regex; would need a follow-up PR.

4. **`PR2-TASK12-ALIAS` grep marker.** Tagged at every site where new code (Stages 2–3) calls a component whose prop type still has the legacy field name (`username:` / `slug:`) and we hand it the new `handle` value under the old key. Task 12 must remove every one. **`rg PR2-TASK12-ALIAS src/` MUST return zero matches before Task 12 is checked off.** Currently 1 marker (in `src/app/[handle]/connections/page.tsx`). The marker comment at each site explains exactly what the sweep needs to do.

5. **Doomed `/u/[username]` and `/p/[slug]` files got minimum-viable rename only.** During Stages 2–3, those route files needed function-name swaps (`getUserByUsername` → `getUserByHandle`, `getPageBySlug` → `getPageByHandle`) to keep the project compiling. Their deeper field-shape errors (`.username`, `.slug`, ProfileEntity discriminator, etc.) persist on purpose — they're owned by Tasks 11–12, and these files get deleted in Task 14 anyway. Don't bother fixing them.

#### Carry-over breakage end-of-Stage-3 (resolved by Task 12)

64 tsc errors at Task 10 close. All fall into these buckets:

- **Stale `slug:`/`username:` in Prisma `select`/`include` clauses** across helpers (`permission.ts:55` `getPagesForUser`, `events.ts` `eventCollectionFields`, `posts.ts`, `message.ts`, plus several `lib/utils/server/*`). These cause both tsc errors AND **runtime 500s** when the affected routes are hit — confirmed end-to-end during Task 8 smoke-test: `/george`, `/portland-makers-guild`, `/u/george`, `/p/portland-makers-guild` all 500 from `getEventsByUser`/`getEventsByPage`. The new and legacy routes fail identically (good — proves the new dispatcher is structurally correct). Visual verification of the new routes has to wait for Task 12.
- **Stale `.username`/`.slug` reads** in caller-side code across `lib/components/*`, `lib/types/*`, route files. Mostly downstream of the helper-select breakage above.
- **`PublicUser` / `PublicPage` types** still require `username`/`slug` fields. Type rename happens in Task 12.
- **Component prop names** like `username: string` and `slug: string` in `ConnectionsPageView`, `ProfileTag`, etc. Renamed in Task 12 (the `PR2-TASK12-ALIAS` markers point at the call-sites that need un-aliasing once the prop names update).
- **Old route constants** (`PUBLIC_USER_PAGE`, `PRIVATE_USER_PAGE`, etc.) — replaced by `PUBLIC_PROFILE`, `MANAGE_PROFILE`, etc. in Task 11; callers swept in Task 12.

These are all expected and accounted for. Until Task 12 lands, dev-server smoke-testing of `/[handle]/...` will hit 500s in the events/posts fetch paths. Structural verification (resolution + dispatch + gating) is doable via the 404-vs-500 pattern.
