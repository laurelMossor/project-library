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

- [ ] **Task 7 — Signup + page creation routes.**
  - [ ] `src/app/api/auth/signup/route.ts`: uses `handle` field, calls `validateHandle`, `isReservedHandle`, `isHandleTaken`. Creates the `Handle` row in the same `prisma.$transaction` as the User. The transaction is non-negotiable — User without Handle, or Handle without User, is a broken state.
  - [ ] `src/app/api/pages/route.ts`: same pattern for Page.
  - [ ] `src/app/api/me/page/route.ts`: same; if it supports handle changes, validate and update the `Handle` row atomically with the Page update.
  - [ ] Manual sanity check: trigger a signup (or run the test that does), inspect the DB — User and Handle rows both present, linked.
  - **Done when:** All three routes use `handle`, write Handles transactionally, and a fresh signup or page creation produces both rows.

---

### Stage 3 — New route trees

- [ ] **Task 8 — `[handle]/page.tsx` router.**
  - [ ] `src/app/[handle]/page.tsx` created. Uses `findEntityByHandle`. Dispatches to existing `PageProfileClient` or `UserProfileClient`. `notFound()` if no entity matches.
  - **Done when:** Dev server is running and visiting `/<seed-user-handle>` and `/<seed-page-handle>` renders the same content as the still-existing `/u/<handle>` and `/p/<handle>` URLs.

- [ ] **Task 9 — `[handle]/connections/page.tsx`.**
  - [ ] Created. Uses `findEntityByHandle` + `canManageEntity`. Renders the existing connections view component for the resolved entity.
  - [ ] This single file replaces all four old connections routes: `u/[username]/connections`, `p/[slug]/connections`, `u/profile/connections`, `p/profile/connections`.
  - **Done when:** `/<handle>/connections` renders correctly when authorized; `notFound()` otherwise.

- [ ] **Task 10 — `[handle]/profile/` tree.**
  - [ ] `src/app/[handle]/profile/page.tsx` created (settings entry; `canManageEntity` gate).
  - [ ] `src/app/[handle]/profile/settings/page.tsx` created (`canManageEntity` gate).
  - [ ] `ProfileSettingsContent.tsx` built. Choose merged-single-component if User/Page form fields overlap heavily; two sibling components (`UserSettingsContent.tsx`, `PageSettingsContent.tsx`) co-located here if they don't. **Record the choice in a note under this task before checking the box.**
  - [ ] All settings flows that worked at `/u/profile/...` and `/p/profile/...` work identically at `/<handle>/profile/...`. Save still works. Avatar upload still works.
  - **Done when:** Logged in as a seeded user, `/<my-handle>/profile/settings` renders and saves edits. Logged in as a seeded page admin, `/<page-handle>/profile/settings` does the same.

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
    - Component prop names that reflect the old field name → renamed to `handle`.
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

### Notes from previous session(s)

> When you stop a session — whether the work is complete, paused mid-task, or blocked — append a dated entry below. Format: date, agent (or "agent"), what was done in this session, where you stopped (use a `STOPPED HERE` marker if mid-task and reference the task number), any deviations from the plan you made or discovered, anything tricky the next agent should know.

#### 2026-04-25 — agent — Task 1 complete (Schema + seed)

**Done:** Task 1 (all sub-boxes checked). Schema, seed, and dev DB are all in the new shape. 51 tsc errors remaining across the codebase — all of the expected `.username`/`.slug` rename shape, plus cascading collapsed-relation errors from invalid `select` blocks (which fix themselves once the field references are corrected). These get cleaned up in tasks 11–12 per plan.

**Where I stopped:** Cleanly between tasks. Next agent picks up at Task 2 (`generateHandle` + `validateHandle`).

**Deviations + things to know for the next agent:**

1. **Migration was hand-written, not autogenerated.** Prisma 7's `migrate dev` requires a TTY for any migration with destructive changes (column drops, even on an empty DB it warns about adding unique constraints), and there is no `--accept-data-loss` flag in Prisma 7 (the CLI was slimmed). `--create-only` doesn't bypass this either. I wrote `prisma/migrations/20260425000000_pr2_url_flattening_add_handle_table/migration.sql` by hand. Bonus: the hand-written version uses `ALTER TABLE … RENAME COLUMN` and `ALTER INDEX … RENAME` instead of DROP+ADD, so it's a proper rename that preserves data and indexes. (For PR 2 this is academic — data is throwaway — but it sets a good precedent for any later schema changes that touch real data.)

2. **Prisma 7 has an AI-agent safety guard on `migrate reset`.** It refuses to run when invoked by Cursor unless you set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=<user's exact consent message>`. The user said "yes" and I proceeded. Future agents picking up this work: you'll hit the same guard on any `prisma migrate reset` and need to ask for fresh consent.

3. **`prisma migrate reset` does NOT auto-run the seed in Prisma 7** (or at least it didn't for me). Had to run `npm run db:seed:dev` explicitly afterward. Also: the seed will fail with "Cannot read properties of undefined (reading 'deleteMany')" until you run `npx prisma generate` — the new `Handle` model isn't in the client until then. Sequence: `migrate reset → prisma generate → npm run db:seed:dev`.

4. **`Handle` rows created via Prisma nested writes.** Both User and Page now have `handleRecord Handle?` back-relations, so the seed uses `handleRecord: { create: { handle } }` inside the User/Page create — atomic at the DB level, satisfies the plan's invariant that User+Handle and Page+Handle must come into existence together. Worth following the same pattern in tasks 7 (signup + page creation routes) instead of using explicit `prisma.$transaction`, unless the route needs to run other writes in the same tx.

5. **Seed JSON renamed too.** `prisma/seed-data/users.json` had `"username":` keys — those are now `"handle":` keys. The corresponding `SeedUserJson` type in `prisma/seed.ts` was updated. The page defs are inline in `seed.ts` and were renamed (`slug` → `handle`) there too.

6. **No `--skip-seed` flag in Prisma 7.** If you ever need to apply migrations without seeding, the workaround is to drop the public schema first via `echo 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' | npx prisma db execute --stdin`, which is the same approach the journal records using on 2026-01-28.

7. **Verified DB state before checking the box.** 6 users, 2 pages, 8 handles (6 user-linked + 2 page-linked); every user/page has a matching handle row whose handle string equals the user's/page's `handle` field; all handles are lowercase. Used a throwaway `scripts/verify-pr2-task1.ts` for this and deleted it after.

#### 2026-04-25 — agent — Tasks 2 + 3 complete (handle utils + reserved handles)

**Done:** Tasks 2 and 3 (all sub-boxes checked). 109/109 unit tests pass. tsc still at exactly 51 errors — same set as end of Task 1, no new breakage. Validated by counting errors before/after each change.

**Where I stopped:** Cleanly between tasks. Next agent picks up at Task 4 (CI reserved-handle script).

**Deviations + things to know for the next agent:**

1. **Plan deviation: `validateProfileData` is NOT wired with `isReservedHandle`.** The plan body says to wire `isReservedHandle` into both `validateProfileData` and `validatePageData`, but `ProfileData` (in `src/lib/types/user.ts`) has no `handle` field — handle changes are explicitly listed as out-of-scope for PR 2 ("Handle renaming by users (not supported today, not added here)"). The only caller of `validateProfileData` is `PUT /api/me/user`, which doesn't accept a handle either. So there's literally nothing to validate. Per Task 7's own spec ("calls `validateHandle`, `isReservedHandle`, `isHandleTaken`"), signup carries that trio inline at the route level. I've left a comment in `validations.ts` near `validatePageData` documenting where the User-side equivalent lives. If a future feature adds handle changes through profile updates, that's the moment to revisit — wire the check then, with a real call site.

2. **`validateHandle` is pure format; reservation is a separate gate.** Plan calls them out as separate functions and the test file structure reflects that. Callers run `validateHandle(h) → isReservedHandle(h) → isHandleTaken(h)` in order. `validatePageData` does the first two; signup (task 7) will do all three. This separation matters because the third one is async (DB hit) and the first two are pure.

3. **Edge-hyphen behavior is intentional asymmetry.** `validateHandle` regex is `^[a-z0-9_-]{3,30}$` per the plan, which *allows* `-portland` and `portland-`. `generateHandle` strips them. This means anything generated from free-text input is edge-clean, but a user typing `-portland` directly into a handle field passes validation. The old `validatePageData` explicitly rejected this. There's a regression test documenting the new behavior. If product wants to tighten back up, change `validateHandle` to `/^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/` or similar — would need a follow-up PR. Not a blocker for PR 2.

4. **Updated one out-of-scope file to keep tsc clean.** When I deleted `src/lib/utils/slug.ts`, two callers needed updating to keep tsc resolving: `src/app/pages/new/page.tsx` (`generateSlug` → `generateHandle`, swap import + 2 call sites only — the rest of the page still uses `slug` state names that get cleaned up in task 12) and `src/app/api/auth/signup/route.ts` (`validateUsername` → `validateHandle`, name only, the call expression still passes `username` which gets renamed in task 7). Both are minimum-scope edits to prevent **new** module-not-found / no-exported-member errors on top of the existing 51 from Task 1. Task 12 (sweep) will rewrite both files properly.

5. **Test file split: handle utils have their own file.** `tests/unit/reserved-handles.test.ts` is new (10 tests), separate from `tests/unit/validations.test.ts`. Reserved-handles is a different module with a different responsibility; mixing them would have made `validations.test.ts` 350+ lines. Keeping them separate also means breaking `reserved-handles.ts` doesn't fail unrelated validation tests, which is nice for diagnosis.

#### 2026-04-25 — agent — Task 4 complete (CI reserved-handle script)

**Done:** Task 4 (all sub-boxes checked). Script verified in both directions (passes on real shape; fails with helpful error on a synthetic missing segment).

**Where I stopped:** Cleanly between tasks. Next agent picks up at Task 5 (server utils).

**Deviations + things to know for the next agent:**

1. **Plan deviation: no CI pipeline exists in this repo.** Plan said "Wired into the CI pipeline (find existing CI config; `.github/workflows/` is the likely location)." There's no `.github/`, `.gitlab-ci`, or `.circleci/` anywhere. The repo's enforcement gate is `npm run validate`, which `PROJECT_GUIDELINES.md` says the user runs locally before committing. I wired `check:reserved-handles` into `validate` between `typecheck` and `test:unit` — failure short-circuits before the long test/build runs, which mirrors the "fast fail" property a CI pipeline would have. Same enforcement, different trigger. When CI infra is added later, the npm script is the integration point.

2. **Script uses the `@/` path alias.** `import { RESERVED_HANDLES } from "@/lib/const/reserved-handles";` — works because `tsconfig.json` defines the alias and tsx respects it. If a future maintainer runs the script outside tsx (raw `node`), the alias won't resolve and they'll need to either use `tsx` or rewrite to a relative `../src/...` path.

3. **Route groups are correctly ignored.** Next.js wraps non-routable grouping folders in parens, e.g., `src/app/(auth)/`. Those don't show up in URLs and so can't shadow `/[handle]`. Script filters them out. Don't add `auth` to RESERVED_HANDLES based on `(auth)` — that's not a real route segment. (`auth` happens to be reserved anyway as part of the auth-flow group.)

4. **Negative test methodology, in case you want to repeat it.** `mkdir src/app/__pr2_negative_test__/`, then `npm run check:reserved-handles` (will exit 1), then `rm -rf src/app/__pr2_negative_test__/`. Note that if you run it as a chained `&&`/`||` shell command, the failing exit status from the npm script will short-circuit later commands — easier to run as separate shell calls so cleanup always happens.

#### 2026-04-25 — agent — Task 5 complete (server utils)

**Done:** Task 5 (all sub-boxes checked). Stage 1 ("Foundations") of the plan is now complete — all of tasks 1–5 done. Foundations stage closes out clean: 125/125 unit tests, tsc still at 51 errors (all from task 1's deliberate breakage), no new errors introduced by tasks 2–5.

**Where I stopped:** Cleanly between tasks. Next agent picks up at Task 6 (API URL rename) — first task of Stage 2 (API surface).

**Things to know for the next agent:**

1. **`canManageEntity` shape choice.** I typed it `{ user?: User | null; page?: Page | null }` to match `findEntityByHandle`'s return shape. The plan's example used the same. The function reads only `entity.user.id` and `entity.page.id`, so any narrower shape would also work — but matching the lookup function's return type means callers don't need any massaging. If a future caller has a different shape (e.g., from a custom query), pass `{ user, page }` explicitly.

2. **The User-branch short-circuit is intentional.** If an entity somehow has both `user` and `page` populated (shouldn't happen — Handle's mutually exclusive `@unique` FKs prevent it), `canManageEntity` checks the user branch only and skips the page DB query. Documented in the test "entity with both user and page → checks user branch only". This is the safe default: if a User and a Page somehow share a handle, only the user can manage their own data.

3. **Unit tests cast through `as never`.** `vi.mocked(...).mockResolvedValue(...)` complains about Prisma's deeply-typed include shapes. I cast via `as unknown as never` to satisfy the mock-resolve signature while keeping the test's runtime payload realistic. Same pattern as the existing `permission.test.ts`. If you want stricter types, set up Prisma type helpers, but it's overkill for these tests.

4. **No DB hit anywhere in tests.** Both new test files mock `@/lib/utils/server/prisma`. Run with `npx vitest run` — no DATABASE_URL needed. Same convention as the existing `permission.test.ts`.

5. **Foundations done — Stage 2 changes the surface area.** Tasks 1–5 added the substrate (schema, validators, server utils, CI guard) without rewriting any routes. From Task 6 on, the actual route tree starts changing. Expect tsc error count to fluctuate as old code gets deleted and new code is added. Track diff against 51 to spot truly new breakage vs intentional churn.

#### 2026-04-25 — agent — Task 6 complete (API URL rename)

**Done:** Task 6 (all sub-boxes checked). Stage 2 first task in the bag.

**Where I stopped:** Cleanly between tasks. Next agent picks up at Task 7 (signup + page creation routes).

**Things to know for the next agent:**

1. **tsc dropped from 51 → 46.** Fixing the `username` field reference in `getUserByHandle` (formerly `getUserByUsername`) cascaded to fix 5 errors total, not just 1. That's because the function's return type was a complex `Promise<{... select: publicUserFields ...}>` shape — once the `username` reference got out of the way, several callers that were reading `.username` on the result also stopped erroring on the *invalid* reference path. Their `.username` reads ARE still wrong (the field is now `.handle`) but tsc can't see them anymore from this function's return type because `select` discards `username`. They'll resurface at task 12 when fields rename, or stay hidden if the callers stop reading the field. Either way, expected.

2. **No `?username=` query params anywhere — sub-bullet was a no-op.** Plan called for renaming `?username=` query params to `?handle=`. This codebase has none — all username lookups went through path segments (`/api/users/by-username/${...}`). The grep step is still meaningful as a safety net (catches anything I might have missed), but it returned zero hits.

3. **Two `(formerly /by-username/[username])` comments left as breadcrumbs.** One in the new route file's docblock, one inline in `AddConnectionSearch.tsx`. They're for next agent / future debugging context. Remove them at task 12 if you want a clean sweep, or leave them — small footprint.

4. **`src/app/u/[username]/...` and `src/app/p/[slug]/...` still have lots of broken refs.** Tasks 6c only did the *minimum* to keep imports resolving (renamed function calls). The deeper field-shape errors (`.username`, `.slug`, ProfileEntity discriminator, etc.) persist. Don't try to "fix" those during stage 2 — they're owned by tasks 11–12, and those files get DELETED in task 14 anyway.
