# PR 2 — URL Flattening (On Deck)

> Drop the `/u/` and `/p/` prefixes from user and page profile URLs so `projectlibrary.com/spats-improv` works directly. Prereq for the Microsite feature feeling like a real microsite.

**Depends on:** PR 1 (useful to land first — reduces the surface area of URL-referencing files) but not strictly required.
**Unblocks:** PR 3 (Microsite proper), where the whole "this page is their site" pitch rests on a short, shareable URL.

---

## Goal

Replace:

- `projectlibrary.com/u/laurel` → `projectlibrary.com/laurel`
- `projectlibrary.com/p/spats-improv` → `projectlibrary.com/spats-improv`
- `projectlibrary.com/p/spats-improv/connections` → `projectlibrary.com/spats-improv/connections`
- `projectlibrary.com/p/spats-improv/about` (from PR 3) → `projectlibrary.com/spats-improv/about`

No redirects needed — there are no real users or external links yet (pre-beta). The old route files are deleted directly and replaced by the new `[handle]` routes.

---

## Why this PR exists

1. **Microsite feel.** "Come see my page at projectlibrary.com/spats-improv" is a URL a human would say out loud. `/p/spats-improv` is not. PR 3 is called a "microsite" — it should feel like one.
2. **Now is the cheapest time.** No real users or external links exist yet (pre-beta). Doing this after beta means maintaining redirects indefinitely and auditing every place a URL was shared.
3. **Not a security issue.** Auth is resource-bound. Removing the prefix changes nothing about what a visitor can or can't see.

---

## What changes

### Routing

- **New:** `src/app/[handle]/page.tsx` — dynamic segment at the root of the app router
- **New:** `src/app/[handle]/connections/page.tsx` — page connections (owner view), replaces `/p/[slug]/connections`
- **New:** `src/app/[handle]/about/page.tsx` — introduced by PR 3; reserved as part of PR 2's routing plan
- **Deleted:**
  - `src/app/u/[username]/page.tsx`
  - `src/app/p/[slug]/page.tsx`
  - `src/app/p/[slug]/connections/page.tsx`

These are Next.js route entry points — thin server components whose only job is to respond to a URL and render profile components. The underlying UI components they render (`PageProfileClient`, `UserProfileClient`, etc., in `src/lib/components/`) are not touched. Each deleted file is replaced 1:1 by its `[handle]` counterpart above, which renders the same components at the new flat URL.

The `[handle]/page.tsx` server component does a **single query** via the `Handle` table:

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
}
```

The `Handle.handle @unique` constraint is a database-level guarantee. No application-level transaction trick is required to prevent two concurrent registrations from claiming the same handle — PostgreSQL enforces it and one insert wins, the other gets a unique constraint violation that the app catches and surfaces as "handle already taken." This is the same model used by any social platform (Instagram, GitHub, etc.).

`User.username` and `Page.slug` are renamed to `User.handle` and `Page.handle` respectively (see schema migration below). Both still carry their own `@unique` constraints (entity-scoped) and remain the primary field used within user- and page-scoped queries. The `Handle` table is the cross-entity uniqueness layer and the routing lookup target.

```ts
// lib/utils/server/handle.ts
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

Since the database currently contains only seed data, no complex backfill is needed. The preflight script (see Data Migration) normalizes and checks existing rows before the migration runs.

### Reserved handle list

`src/lib/const/reserved-handles.ts`:

```ts
export const RESERVED_HANDLES = new Set([
  // App routes
  "api", "explore", "events", "posts", "pages", "messages", "collections",
  "login", "signup", "settings", "profile", "logout","projects"

  // Reserved for future subroutes (single letters, a–z)
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "about", "connections",
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
  "billing", "account", "me",
  // Anti-impersonation
  "projectlibrary", "library", "official", "staff", "team",
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

`src/lib/const/routes.ts` — update all profile route constants to use `handle` as the parameter name and emit flat paths:

```ts
export const PUBLIC_USER_PAGE = (handle: string) => `/${handle}`;
export const PUBLIC_PAGE = (handle: string) => `/${handle}`;
export const PUBLIC_PAGE_CONNECTIONS = (handle: string) => `/${handle}/connections`;
export const PUBLIC_PAGE_ABOUT = (handle: string) => `/${handle}/about`; // PR 3
```

Because every route usage flows through these constants (codebase convention), this is a one-file change for all internal links. Grep for hardcoded `"/p/"` and `"/u/"` to catch any stragglers.

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
}
```

### Column renames

- `User.username` → `User.handle`
- `Page.slug` → `Page.handle`

These are column renames via `ALTER TABLE ... RENAME COLUMN`. No data is dropped. TypeScript will immediately surface every reference to `.username` and `.slug` that needs updating.

Note: `User.username` may be referenced in auth/login flows (session tokens, login form, NextAuth config). Audit these during the rename — they are not covered by the `routes.ts` constants convention.

### Migration order

1. Run preflight script (see below). Resolve any conflicts.
2. Add the `Handle` table (empty).
3. Rename `User.username` → `User.handle`; rename `Page.slug` → `Page.handle`. Lowercase all values in the same migration.
4. Backfill `Handle` rows from existing `User.handle` and `Page.handle` values.
5. Apply foreign key constraints.

Steps 3–5 can be a single Prisma migration file with manual SQL for the rename + backfill.

---

## Data migration

### Preflight script

`scripts/check-handle-conflicts.ts`:

- Queries all `User.username` and `Page.slug` values.
- Normalizes each to lowercase.
- Reports any exact-match conflicts (same value across the two tables).
- Reports any case-normalization conflicts (e.g., `"Laurel"` and `"laurel"` in the same table — after lowercasing, these would be duplicates within a single table's unique constraint).

**Expected result:** zero conflicts. The product has < 20 real users and pages were seeded after users.

**If conflicts exist:** resolve manually before the migration. For cross-table conflicts, append a number to the page handle (`spats-improv-1`). For within-table case conflicts, keep the lowercase variant and update the other.

---

## File-by-file changes

### New files

- `src/app/[handle]/page.tsx` — routes to user or page profile via Handle table
- `src/app/[handle]/connections/page.tsx` — page owner connections view
- `src/lib/const/reserved-handles.ts`
- `src/lib/utils/server/handle.ts` — `isHandleTaken`, `findEntityByHandle`
- `scripts/check-handle-conflicts.ts` — preflight script
- `scripts/ci-check-reserved-handles.ts` — CI script: scans `src/app/` top-level dirs, diffs against `RESERVED_HANDLES`, fails if any are missing
- `prisma/migrations/…_handle_table_and_rename.sql` — Handle table + column renames + backfill

### Modified files

- `prisma/schema.prisma` — add `Handle` model; rename `User.username` → `User.handle`, `Page.slug` → `Page.handle`
- `src/lib/const/routes.ts` — flatten all profile route constants; rename params to `handle`
- `src/lib/validations.ts` — reject reserved handles on signup / page creation
- `src/app/api/auth/signup/route.ts` — call `isReservedHandle`, `isHandleTaken`; write `Handle` row on user creation
- `src/app/api/pages/route.ts` — same; write `Handle` row on page creation
- `src/app/api/me/page/route.ts` — same, for handle updates
- All files referencing `User.username` or `Page.slug` — TypeScript will surface these after the rename
- Auth/login flow files — audit for `username` references after rename

### Deleted files

- `src/app/u/[username]/page.tsx`
- `src/app/p/[slug]/page.tsx`
- `src/app/p/[slug]/connections/page.tsx`

The `u/` and `p/` folders collapse to empty and are removed. TypeScript will immediately surface any remaining imports from these paths.

---

## Task breakdown (sequenced)

1. **Preflight: run `check-handle-conflicts` against dev + prod databases.** Resolve manually if any overlaps. Confirm zero case-normalization conflicts.
2. **Schema migration.** Add `Handle` table; rename `User.username` → `User.handle` and `Page.slug` → `Page.handle`; lowercase all values; backfill `Handle` rows. Apply as one migration file.
3. **Audit auth/login for `username` references.** Update any session config, login form fields, or NextAuth adapter that referenced `User.username`.
4. **Reserved handles constant + validator.** Add `reserved-handles.ts`, wire into validators. Unit test: reserved words rejected, normal handles accepted.
5. **CI reserved-handle check script.** Scans `src/app/` and diffs against the constant. Wire into CI. Required, not optional.
6. **`isHandleTaken` and `findEntityByHandle` via Handle table.** Unit test: registering same handle as user then page throws.
7. **`[handle]/page.tsx` router.** Single `Handle` table query. Test with existing user and page — should render same components as old routes, just at new URL.
8. **`[handle]/connections/page.tsx`** — replace `p/[slug]/connections/page.tsx`.
9. **Update `routes.ts`** — all profile constants now flat, params renamed to `handle`. Let TypeScript surface what broke.
10. **Grep for hardcoded `"/p/"` / `"/u/"` references.** Fix any stragglers.
11. **Delete old route files.** `u/[username]/`, `p/[slug]/`, `p/[slug]/connections/`.
12. **Playwright E2E update.** Every test that hits a profile URL — use the route constant, or update the URL literal.
13. **Deploy + smoke test.** Visit `projectlibrary.com/laurel` and `projectlibrary.com/spats-improv` directly.

Land as one PR. Partial landing leaves the app in a weird mixed-URL state.

---

## Out of scope for PR 2

- Any new routes (`/[handle]/about` is reserved but implemented in PR 3)
- Any visual changes to profiles
- Handle renaming by users (not supported today, not added here; the `Handle` table makes this straightforward to add later)
- Internationalized handles / unicode normalization (current handles are ASCII only)
- Subdomain-based microsites (`spats-improv.projectlibrary.com`) — different product decision, not scoped here

---

## Risks / open questions

- **Auth/login `username` reference audit.** `User.username` rename is mechanical but must be complete before the migration runs. TypeScript will catch model references; login session serialization (e.g., NextAuth callbacks that spread user fields) may not be caught by the type-checker alone.
- **SEO.** `projectlibrary.com/spats-improv` is nicer for users. No SEO strategy yet and this PR shouldn't invent one.
- **Rollback.** Revert the PR: new `[handle]` routes disappear, old routes come back together (all in the same PR). The `Handle` table stays in the DB but is unused — harmless. Schema rollback is a separate migration if needed.
