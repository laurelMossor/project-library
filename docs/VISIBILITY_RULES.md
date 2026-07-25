# Visibility & Privacy — The Rules

> The single contract for the visibility model. **All enforcement lives in one file:**
> `src/lib/utils/server/visibility.ts`. This doc is the human-readable spec for that layer —
> read it before touching any route that reads/lists/mutates user, page, event, post, message,
> or image data. When extending privacy features you are *applying* these helpers to a new
> surface, never inventing a new rule in a route handler.

---

## 0. The model — two independent sibling fields

Visibility is **two orthogonal concerns**, one per object:

| Field | On | Values | Governs |
|-------|----|--------|---------|
| `profileVisibility` | User, Page | `PUBLIC` \| `PRIVATE` | the **profile page** — full profile vs identity stub |
| `contentVisibility` | User, Page | `LISTED` \| `UNLISTED` \| `PRIVATE` | the **default** a new post/event inherits |
| `contentVisibility` | Post, Event | `LISTED` \| `UNLISTED` \| `PRIVATE` | the item's own **effective** distribution (inherited; not client-set) |

- **`PUBLIC` profile** — full profile, discoverable in search.
- **`PRIVATE` profile** — still discoverable in search, but renders an **identity-only stub**
  (name / handle / avatar) + a request-to-connect affordance. No headline/bio/location/content.
- **`LISTED` content** — appears in the public collections (Explore/feeds) **and** on the profile.
- **`UNLISTED` content** — on the profile only, never in the public collections.
- **`PRIVATE` content** — visible only to the owner + relationship edge (follower / member).

The two are **independent** (siblings, not a hierarchy), with **one guard**: a `PRIVATE` profile's
`contentVisibility` default cannot be `LISTED`. A public profile can keep its posts private ("find
me and read my bio, but my posts are connections-only"), and a private profile can keep its default
`UNLISTED` or `PRIVATE` — but a private profile whose entire output floods the public feeds is
incoherent, so that one pairing is rejected (UI removes the Listed option while private; the server
rejects the merged combo in `saveMyProfile`). Otherwise changing one field never silently changes
the other; switching a profile back to `PUBLIC` leaves content visibility untouched.

The guard constrains only the **profile-wide default**. A *future* per-item override (e.g. a single
"For Sale" post that is `LISTED` while the owner's profile default stays `PRIVATE`) lives on the
item's own `contentVisibility` field and is intentionally out of scope for this guard.

**Content is never client-set.** A new post/event inherits its owner's `contentVisibility` via
`resolveParentVisibility` (page → event → parentPost → user → `LISTED`). The `Post`/`Event.contentVisibility`
column is 3-value so a *future* per-item override is a pure UI addition — but today no route accepts a
client content visibility.

---

## 1. Invariants (never violate these)

1. **One layer, no scattered checks.** Visibility decisions come from `visibility.ts` helpers. A
   route must never re-implement "is this PRIVATE and am I a follower" inline.

2. **Content-authoritative enforcement.** Content gates (`canViewPost`/`canViewEvent`) read the
   *content's own* `visibility`. The profile's privacy governs the profile view + the default new
   content inherits — it does **not** re-gate already-created content at runtime.

3. **Content is born from its parent.** Create routes derive `visibility` via
   `resolveParentVisibility` (the `createPost`/`createEvent` utils do this). Never call
   `prisma.post/event.create` with a hard-coded or omitted visibility, and never accept a client
   `visibility` on create or PATCH. Re-parenting (`pageId` change) re-derives.

4. **Cascade tracks `contentVisibility`.** Changing a profile's `contentVisibility` cascades to all
   descendants via `syncDescendantVisibility` (in the same transaction). A `profileVisibility`-only
   change does **not** touch content. Firing the follow/join auto-approve is keyed on
   `profileVisibility` unlocking (→ `PUBLIC`), not on content.

5. **Profiles are discoverable; PRIVATE profiles reveal only identity.** `profileListWhere` returns
   `{}` (all profiles searchable). A PRIVATE profile with no viewer edge renders the LOCKED stub —
   identity only. The search path (`search.ts`) and the stub component must both strip
   headline/interests/location for PRIVATE profiles. Anonymous and logged-in non-edge viewers both
   get the stub (no more existence-deny 404 for profiles).

6. **Global collections are LISTED-only, plus your own.** Feeds/search of *content* use
   `postListWhere`/`eventListWhere`, which filter to `FEED_VISIBILITY` (`[LISTED]`) plus the
   viewer's own. UNLISTED and PRIVATE content never reach the collections.

7. **Not-viewable content 404s (never 403).** A detail/mutation route for content the viewer can't
   see returns 404, so it can't be told apart from "missing". This includes **mutation** routes
   (PATCH/DELETE): gate viewability first (→ 404), then authorize the edit (→ 403 only for
   viewable-but-not-editable). Use `requireViewableEvent` / `requireViewablePost`.

7a. **A LOCKED profile hides its collection everywhere.** A PRIVATE-profile page's JSON collection
   routes (`/api/pages/[id]/posts`, `/events`) gate on `requireViewableProfile` and 404 for
   non-edge viewers, matching the SSR stub — the JSON API must not serve what the page view hides.

8. **Embeds carry only attribution fields.** Nested selects on another entity ship
   `publicUserEmbedFields` / `publicPageEmbedFields` (id/handle/name/avatar) — never bio, location,
   interests, aboutContent, email, or the visibility fields.

9. **Messaging is identity-scoped, ADMIN/EDITOR for pages.** Page conversation access uses
   `getManagedPageIds` / `canPostAsPage` (ADMIN/EDITOR) — **never** `getPagesForUser` (which
   includes plain MEMBER). Acting as a page is verified from the session on every method (GET *and*
   PATCH), never trusted from a client `asPageId`.

10. **Mutations authorize the specific target**, derived from the session — "logged in" is never
    enough. Guard the id, not just the verb (IDOR is the default failure mode).

11. **Changing a profile's visibility is a manage action, not an edit action.** For a Page, only
    ADMIN (`canManagePage`) may change `profileVisibility` / `contentVisibility`; an EDITOR
    (`canPostAsPage`) may edit the rest of the profile but never its privacy. Enforced in
    `saveMyProfile` via the caller's `allowVisibilityChange` flag (the `/api/me/page` route derives
    it from `canManagePage`), so a visibility field from a non-admin is rejected (403) before the
    write. A user always controls their own profile's visibility (self is authoritative).

---

## 2. The helpers, and when to reach for each

| You are… | Use |
|----------|-----|
| showing ONE profile by id/handle | `requireViewableProfile(kind, id, viewer)` → `{id, profileVisibility}` or `null`→404 |
| deciding SSR full/stub | `resolveProfileAccess(kind, {id, profileVisibility}, viewer)` → `FULL` / `LOCKED` / `HIDDEN` |
| gating ONE post / event | `canViewPost` / `canViewEvent` (read the content's `visibility`) |
| a global content feed / search | `postListWhere` / `eventListWhere` (filter `FEED_VISIBILITY`) |
| a profile search | `profileListWhere` (returns `{}`) + strip stub fields for PRIVATE (see `search.ts`) |
| one entity's OWN collection | `collectionVisibilityWhere(kind, id, viewer)` (LISTED+UNLISTED, +PRIVATE if edge) |
| a new child's visibility | `resolveParentVisibility(userId, pageId?, eventId?, parentPostId?)` |
| a page's own collection JSON | gate on `requireViewableProfile("PAGE", id, viewer)` first (LOCKED page → 404) |
| a profile's contentVisibility changed | `syncDescendantVisibility(type, id, contentVis, tx)` |
| "who may see this owned content" | `canViewByOwnerEdge(ownerUserId, pageId, viewer)` (used inside the post/event gates) |
| building request context | `getViewerContext()` — call once at the top of a handler |

Shared value-sets (`FEED_VISIBILITY`, `PROFILE_COLLECTION_VISIBILITY`) are the single source for
"what's in feeds" / "what's on a profile" — reference them, don't inline literal enum sets.

---

## 3. Checklist for adding or changing a data route

- [ ] Built `viewer` once via `getViewerContext()`.
- [ ] **Profile detail:** gated with `requireViewableProfile` / `resolveProfileAccess`. The stub is identity-only.
- [ ] **Content detail:** gated with `canViewPost` / `canViewEvent`; not-viewable → **404**. DRAFT content only for its owner.
- [ ] **Content list:** the visibility clause is a `*ListWhere` / `collectionVisibilityWhere` fragment and nothing widens it.
- [ ] **Create/PATCH content:** never accept a client `visibility`; derive via the util. Re-parent re-derives.
- [ ] **Embeds** use the attribution-only selectors.
- [ ] **Relationship lists** gate on the parent profile first.
- [ ] **RSVP / attendee data** (name+email) restricted to the event owner/host.
- [ ] **Messaging:** page access via `getManagedPageIds`/`canPostAsPage`; `asPageId` verified on every method.
- [ ] **Mutation:** authorization verifies the caller may act on *this* id.
- [ ] A test exists that a wrong-viewer request gets 404 / a stub / an empty list — not the content.

---

## 4. Anti-patterns that have bitten this codebase

- **Creating content without inheriting visibility.** Content defaults to `LISTED`; if a create
  route omits `visibility`, private-parented content is born LISTED and leaks to feeds. Route
  through the `createPost`/`createEvent` utils. (This was the top finding of the 2026-07-03 audit.)
- **Accepting a client `visibility` on a post/event.** Content visibility is derived, not set.
- **`getEventById` / `getUserByHandle` / `getPageById` do NOT gate** — low-level fetchers; the
  caller must gate.
- **Using `getPagesForUser` to authorize page access** — it includes plain MEMBER. Use
  `getManagedPageIds` / `canPostAsPage`.
- **Gating one HTTP method but not its sibling** (GET vs PATCH), or the SSR page but not its JSON API.
- **Rendering a PRIVATE profile's headline/location** in the stub or search results.
- **Returning 403 for forbidden content** — leaks existence; return 404.
