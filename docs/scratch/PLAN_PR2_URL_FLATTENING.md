# PR 2 — URL Flattening

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

Old URLs 301 to new ones so nothing outside the app breaks.

---

## Why this PR exists

1. **Microsite feel.** "Come see my page at projectlibrary.com/spats-improv" is a URL a human would say out loud. `/p/spats-improv` is not. PR 3 is called a "microsite" — it should feel like one.
2. **Now is the cheapest time.** No real external links exist yet (pre-beta). Post-beta, every email, embed, and shared screenshot becomes a redirect maintenance burden.
3. **Not a security issue.** Auth is resource-bound. Removing the prefix changes nothing about what a visitor can or can't see.

---

## What changes

### Routing

- **New:** `src/app/[handle]/page.tsx` — dynamic segment at the root of the app router
- **New:** `src/app/[handle]/connections/page.tsx` — page connections (owner view), replaces `/p/[slug]/connections`
- **New:** `src/app/[handle]/about/page.tsx` — introduced by PR 3; reserved as part of PR 2's routing plan
- **Removed after redirects are in place:**
  - `src/app/u/[username]/page.tsx`
  - `src/app/p/[slug]/page.tsx`
  - `src/app/p/[slug]/connections/page.tsx`

The `[handle]/page.tsx` server component:

1. Looks up the handle in a combined query: first try `getPageBySlug(handle)`, then `getUserByUsername(handle)`, in that order.
2. If both miss → 404.
3. If it's a page → renders the existing `p/[slug]` profile (same components: `ProfileHeader`, `ProfileBody`, `ProfileButtons`, `ProfileCollectionSection`).
4. If it's a user → renders the existing `u/[username]` profile.
5. Internally, the two branches can share a `ProfileRoute` component that accepts a `ProfileEntity` discriminated union.

Page-first lookup order is a deliberate choice: Pages are the "microsite" concept and more likely to be typed. If a conflict ever slipped through the uniqueness check (it shouldn't), Page wins. Noted as a tiebreaker policy in code comments.

### Handle uniqueness

Today, `User.username` and `Page.slug` have separate unique constraints. A user `foo` and a page `foo` can coexist. After the migration, they can't.

Two implementation options:

**Option A — Shared `Handle` table (cleanest, heavier migration).**

```prisma
model Handle {
  id        String   @id @default(cuid())
  handle    String   @unique
  userId    String?  @unique
  pageId    String?  @unique
  createdAt DateTime @default(now())
}
```

All handle lookups go through this table. User.username and Page.slug become derived/cached copies. Complex migration (backfill, dual-write period, cut over).

**Option B — Pre-insert check across both tables.**

```ts
// lib/utils/server/handle.ts
async function isHandleTaken(handle: string): Promise<boolean> {
  const [user, page] = await Promise.all([
    prisma.user.findUnique({ where: { username: handle } }),
    prisma.page.findUnique({ where: { slug: handle } }),
  ]);
  return !!(user || page);
}
```

Called on signup, page creation, and rename. Not race-proof on its own — wrap the insert in a transaction and re-check inside. Existing schema stays.

**Recommendation: Option B.** Simpler, same user-facing guarantee, no complex migration. Option A becomes attractive only if we grow more handle-holder types (which we don't anticipate).

### Reserved slug list

`src/lib/const/reserved-handles.ts`:

```ts
export const RESERVED_HANDLES = new Set([
  // App routes
  "api", "explore", "events", "posts", "pages", "messages", "collections",
  "login", "signup", "settings", "profile", "logout",
  // Legacy prefixes (redirected but shouldn't be handles)
  "u", "p", "o", "orgs", "projects",
  // Reserved for future subroutes (PR 3)
  "about", "connections",
  // Vanity / admin
  "admin", "support", "help", "terms", "privacy", "docs",
  "billing", "account", "me",
  // Anti-impersonation (suggested)
  "projectlibrary", "library", "official", "staff", "team",
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}
```

Validated in:

- `validateProfileData()` / `validatePageData()` (existing validators in `lib/validations.ts`) — rejects on signup and page creation
- `POST /api/pages` and `POST /api/auth/signup` — last line of defense

Rule of thumb: **every new top-level route folder added to `src/app/` must be added to `RESERVED_HANDLES`** in the same PR. A lint-level check (CI script) that scans `src/app/` and diffs against the constant is a nice-to-have, not blocking.

### Redirects

Preserve all old URLs via 301 in `proxy.ts` (or a Next.js `redirects()` config in `next.config.ts`):

- `/u/:username` → `/:username`
- `/u/:username/connections` → `/:username/connections`
- `/p/:slug` → `/:slug`
- `/p/:slug/connections` → `/:slug/connections`
- `/p/:slug/about` → `/:slug/about` (when PR 3 lands)

Preference: `next.config.ts` `redirects()` — server-side, cacheable, no runtime cost. These stay in place indefinitely. They're cheap.

### Internal link updates

`src/lib/const/routes.ts` holds all route constants (`PUBLIC_USER_PAGE`, `PUBLIC_PAGE`, etc.). Update these to emit the new flat paths:

```ts
export const PUBLIC_USER_PAGE = (username: string) => `/${username}`;
export const PUBLIC_PAGE = (slug: string) => `/${slug}`;
export const PUBLIC_PAGE_CONNECTIONS = (slug: string) => `/${slug}/connections`;
export const PUBLIC_PAGE_ABOUT = (slug: string) => `/${slug}/about`; // PR 3
```

Because every route usage flows through these constants (codebase convention), this is a one-file change for all internal links. Grep for hardcoded `"/p/"` / `"/u/"` to catch any stragglers.

---

## Data migration

Any existing conflicts between `User.username` and `Page.slug`?

- **Check first:** a one-off script `scripts/check-handle-conflicts.ts` that queries both tables and reports overlaps.
- **Expected result given current dev + prod state:** probably zero — the product has < 20 real users and pages were seeded after users.
- **If conflicts exist:** resolve manually before migration. Append a number (`page-foo-1`) to the younger of the two.

No backfill, no data transformation. The schema stays the same; only application-level constraints tighten.

---

## File-by-file changes

### New files

- `src/app/[handle]/page.tsx` — routes to user or page profile
- `src/app/[handle]/connections/page.tsx` — page owner connections view
- `src/lib/const/reserved-handles.ts`
- `src/lib/utils/server/handle.ts` — `isHandleTaken`, `findEntityByHandle`
- `scripts/check-handle-conflicts.ts` — one-off preflight

### Modified files

- `src/lib/const/routes.ts` — flatten all profile route constants
- `src/lib/validations.ts` — reject reserved handles on signup / page creation
- `src/app/api/auth/signup/route.ts` — call `isReservedHandle`, `isHandleTaken`
- `src/app/api/pages/route.ts` — same
- `src/app/api/me/page/route.ts` — same, for slug updates
- `next.config.ts` — add `redirects()` block for 301s
- `proxy.ts` — only if `redirects()` isn't sufficient (it should be)

### Removed files

After redirects are in place and QA'd:

- `src/app/u/[username]/page.tsx`
- `src/app/p/[slug]/page.tsx`
- `src/app/p/[slug]/connections/page.tsx`

The `u/` and `p/` folders collapse to empty and get deleted. Any still-imported modules from these paths are flagged by TypeScript immediately.

---

## Task breakdown (sequenced)

1. **Preflight: run `check-handle-conflicts` against dev + prod databases.** Resolve manually if any overlaps.
2. **Reserved handles constant + validator.** Add to `reserved-handles.ts` and wire into validators. Unit test: common reserved words rejected, normal handles accepted.
3. **`isHandleTaken` cross-table check.** Unit test with seeded user + page same handle.
4. **`[handle]/page.tsx` router.** Implement, test with existing user and page (should render same content as old routes, just at new URL).
5. **`[handle]/connections/page.tsx`** — migrate from `p/[slug]/connections`.
6. **Update `routes.ts`** — all profile constants now flat. Let TypeScript tell you what broke.
7. **Add `redirects()` in `next.config.ts`** for all old URL shapes.
8. **Grep for hardcoded `"/p/"` / `"/u/"` references.** Fix any stragglers.
9. **Remove old route files.** `u/[username]/`, `p/[slug]/`, `p/[slug]/connections/`.
10. **Playwright E2E update.** Every test that hits a profile URL — use the route constant, or update the URL literal. Verify old URLs 301 to new ones.
11. **Deploy + smoke test.** Visit `projectlibrary.com/laurel`, `projectlibrary.com/spats-improv`, `projectlibrary.com/p/spats-improv` (should 301), `projectlibrary.com/u/laurel` (should 301).

Land as one PR. Partial landing leaves the app in a weird mixed-URL state.

---

## Out of scope for PR 2

- Any new routes (`/[handle]/about` is reserved but implemented in PR 3)
- Any visual changes to profiles
- Handle renaming by users (not supported today, not added here)
- Internationalized handles / unicode normalization (current handles are ASCII only)
- Subdomain-based microsites (`spats-improv.projectlibrary.com`) — different product decision, not scoped here

---

## Risks / open questions

- **Case sensitivity.** Is `/Laurel` the same as `/laurel`? Currently `User.username` is case-sensitive in the DB but lowercased in the login path. Recommendation: normalize all handles to lowercase at insert and lookup. Add a `handle.toLowerCase()` pass in every check. Existing data may need a lowercase backfill if any mixed-case slugs exist.
- **Reserved list completeness.** Miss one and a user can register `/api` or `/login`. Mitigation: CI lint scanning `src/app/` top-level folders against the constant.
- **Social preview / OG tags.** Any existing share previews cached on the old URLs stay stale until re-scraped. Not a blocker, but noted.
- **SEO.** `projectlibrary.com/spats-improv` is nicer for users but also broader-surface for SEO. We don't have SEO strategy yet and this PR shouldn't invent one.
- **Lookup performance.** `[handle]/page.tsx` does two queries (Page first, User fallback). Both are indexed. Overhead is one extra query on User profile hits. Acceptable. Could be optimized later with a union view or the Option A handle table if it ever matters.
- **Analytics URL taxonomy.** Any dashboards or logs that bucket by URL prefix (`/p/*` vs `/u/*`) will need new segmentation. Note for `docs/scratch/logging_and_tracking.md`.
- **Rollback.** If anything goes catastrophically wrong, revert the PR and the 301 redirects stay in place (harmless, they just never trigger). Low-risk rollback.
