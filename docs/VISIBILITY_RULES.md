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

**Where it lives is not who's speaking.** `pageId` is the collection, and therefore the audience:
a post or event inherits that page's visibility. `asPageId` is the voice. When it is set it equals
`pageId` (the page is speaking). When it is null the human author is speaking, even if the post
lives on a page. An admin or editor may post to a page or as that page; a member may post to a
page only when it allows member posts, and never as the page. `showOnAuthorProfile` only changes
where an author-voiced, to-page post also appears. It never changes who can see it.

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

6. **Global collections are LISTED-only.** Feeds/search of *content* use
   `postListWhere`/`eventListWhere`, which filter to `FEED_VISIBILITY` (`[LISTED]`) for every
   viewer. Your own UNLISTED/PRIVATE content lives on your own collection. UNLISTED and PRIVATE
   content never reach the global collections.

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
   includes plain MEMBER). Acting as a page is verified from the session on the thread GET and on
   every write action, never trusted from a client `asPageId`. Access, read state, and the writes
   live in `src/lib/utils/server/message.ts`. The read-route prelude is `message-routes.ts`. The
   write guard is `message-commands.ts`, behind `src/lib/actions/message.ts`. Callers apply those,
   never re-derive the check. For DMs **and groups**:
   - **Participant-only.** A conversation is reachable only by an identity that is a participant;
     everyone else gets **404** on every method (never 403 — no existence leak).
   - **History from join time.** A participant sees only messages sent at/after it joined (its
     participant row's `createdAt`) — in the thread, the inbox preview, and unread counts.
   - **A page speaks with one voice.** Other members see a page's messages as the page only. The human
     sender (`Message.senderId`) is included **only** when the viewer is that same page (its
     co-managers) — never in another member's payload.
   - **Leaving as a page is a manage action (ADMIN, `canManagePage`)** — it removes the page for all of
     its managers. EDITORs may still read, send, rename, and add.
   - **Read state is per identity** (`ConversationParticipant.lastReadAt`); a page's marker is shared by
     its managers. Email read-suppression uses the same marker (`isMessageReadBy`).

10. **Mutations authorize the specific target**, derived from the session — "logged in" is never
    enough. Guard the id, not just the verb (IDOR is the default failure mode).

11. **Changing a page's settings is a manage action, not an edit action.** For a Page, only
    ADMIN (`canManagePage`) may change `profileVisibility`, `contentVisibility`, `membershipPolicy`,
    or `allowMemberPosts`. An EDITOR (`canPostAsPage`) may edit the rest of the profile. Enforced in
    `saveMyProfile` via the caller's `allowManageChange` flag (the `/api/me/page` route derives it
    from `canManagePage`), so one of those fields from a non-admin is rejected (403) before the
    write. A user always controls their own profile's visibility (self is authoritative).

12. **A post is never wider on its author's profile than on its page.** A to-page post inherits the
    page's audience. Showing it on the author's profile (`showOnAuthorProfile`) adds a place it
    appears; `authorProfilePlacementWhere` still requires the viewer to be able to see it on that
    page. Following the author is not enough to see a private page's member post. Placement
    (`pageId` / `asPageId` / `showOnAuthorProfile`) can change only while the post is a DRAFT, and
    a reply copies its parent's placement.

---

## 2. The helpers, and when to reach for each

| You are… | Use |
|----------|-----|
| showing ONE profile by id/handle | `requireViewableProfile(kind, id, viewer)` → `{id, profileVisibility}` or `null`→404 |
| deciding SSR full/stub | `resolveProfileAccess(kind, {id, profileVisibility}, viewer)` → `FULL` / `LOCKED` |
| gating ONE post / event | `canViewPost` / `canViewEvent` (read the content's `visibility`) |
| a global content feed / search | `postListWhere` / `eventListWhere` (filter `FEED_VISIBILITY` for every viewer) |
| a profile search | `profileListWhere` (returns `{}`) + strip stub fields for PRIVATE (see `search.ts`) |
| one entity's OWN collection | `collectionVisibilityWhere(kind, id, viewer)` (LISTED+UNLISTED, +PRIVATE if edge) |
| an author's profile, including posts they wrote to a page | `authorProfilePlacementWhere(viewer)` OR'd with the personal-post clause. Never use `collectionVisibilityWhere("USER")` alone for that — it returns `{}` to the author's followers and would leak a private page's posts |
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
- [ ] **Content detail:** gated with `canViewPost` / `canViewEvent`; not-viewable → **404**. DRAFT content only for whoever `canEditContent` allows: a current editor when it is spoken as a page, otherwise its author.
- [ ] **Content list:** the visibility clause is a `*ListWhere` / `collectionVisibilityWhere` fragment and nothing widens it.
- [ ] **Create/PATCH content:** never accept a client `visibility`; derive via the util. Re-parent re-derives.
- [ ] **Embeds** use the attribution-only selectors.
- [ ] **Relationship lists** gate on the parent profile first.
- [ ] **RSVP / attendee data** (name+email) restricted to the event owner/host.
- [ ] **Messaging:** page access via `getManagedPageIds`/`canPostAsPage`; `asPageId` verified on every method.
- [ ] **Conversations (DM or group):** participant check → 404 otherwise; messages floored at join time;
      a page message's human sender only for that page's managers; page leave is ADMIN-only.
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
