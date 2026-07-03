# Visibility & Authorization Audit — 2026-07-03

> **RESOLUTION (branch `visibility-audit`, 2026-07-03):** The visibility-model refactor
> (`profileVisibility` / `contentVisibility` split; see `docs/VISIBILITY_RULES.md`) landed and
> **subsumes or fixes** most findings here:
> - **Dissolved by the model:** #1/#2 (born-PUBLIC — create routes now derive visibility), #15
>   (event-PATCH visibility drift — content visibility is now derived/never client-set), #10 & #11
>   (private-in-lists / page-collection existence — private profiles are now *intentionally*
>   discoverable stubs). #24 handled (post re-parent re-derives).
> - **Fixed directly:** #3 (`/[handle]/about` now gated), #4/#5 (conversation GET embed-only +
>   PATCH `asPageId` check), #6/#7 (inbox + read use `getManagedPageIds`, not member-inclusive),
>   #8 (events/[id]/posts DRAFT gate), #9 (`me/page` re-checks `canPostAsPage`), #12/#19 (RSVP
>   counts + POST gated by `canViewEvent`), #13 (image-attachments default-deny), #14 (message
>   embeds attribution-only), #17 (draft child-updates filtered from cards), #20-partial
>   (`[messageId]/read` now 404s), #21 (LOCKED stub + search trimmed to identity-only).
> - **Still open (tracked follow-ups):** #16/#25 (inbox/sent active-identity scoping — MED,
>   touches the client contract), #20 (403→404 on posts/events PATCH·DELETE + rsvps GET — low
>   oracle), #22/#23 (image DELETE target-manager auth + `POST /api/images` url validation — low),
>   #18 (private-content images have world-readable Supabase URLs — architectural).
>
> Verified: `visibility.ts` rewritten, migration `20260703120000_split_and_rename_visibility`
> applied, 217 unit tests green, E2E spec updated.

**Scope:** Every route path where a viewer could obtain content, existence, or private
profile fields they should not see under the three-tier visibility model
(PUBLIC / UNLISTED / PRIVATE), plus messaging identity-scoping and mutation authorization.
**Method:** 8 parallel read-only agents (route families A–H) grounded in the authoritative
spec `src/lib/utils/server/visibility.ts`, followed by orchestrator verification of every
HIGH and the novel MEDs against the actual code. Report-only — nothing was changed except
this document and the companion rule set.

**Companion doc:** [`docs/guidance/VISIBILITY_RULES.md`](../guidance/VISIBILITY_RULES.md) — the
durable contract these findings are measured against. Read it before fixing anything.

> **The one-line takeaway:** the enforcement *layer* (`visibility.ts`) is sound and well
> designed. Almost every finding is a place where a route **bypassed the layer** — created a
> row without inheriting visibility, fetched with the ungated low-level helper, or gated one
> sibling path but not the other. The single most important bug is **write-time**: the main
> post/event create routes never set `visibility`, so private-parented content is born PUBLIC.

---

## Summary table

| # | Severity | Route | Method | Leak | Status |
|---|----------|-------|--------|------|--------|
| 1 | **HIGH** | `POST /api/posts` | POST | Posts on a PRIVATE page / by a PRIVATE user are stored PUBLIC → global feed & search | ✅ verified |
| 2 | **HIGH** | `POST /api/events` | POST | Same inheritance bypass for events (incl. location/lat/long) | ✅ verified |
| 3 | **HIGH** | `/[handle]/about` (SSR) | GET | PRIVATE profile's full aboutContent + identity rendered to **anyone, incl. anonymous** | ✅ verified |
| 4 | **HIGH** | `/api/messages/conversation/[targetId]` | GET | Any logged-in user reads **any** user's full private profile fields | ✅ verified |
| 5 | **HIGH** | `/api/messages/conversation/[targetId]` | PATCH | Client-supplied `asPageId` trusted with no check → mark any page's DMs read + oracle | ✅ verified |
| 6 | **HIGH** | `/api/messages/inbox` | GET | A plain page **MEMBER** reads that page's private DMs (content + participants) | ✅ verified |
| 7 | **HIGH** | `/api/messages/[messageId]/read` | PATCH | Same MEMBER-inclusive bug → member marks page DMs read | ✅ verified |
| 8 | **HIGH** | `/api/events/[id]/posts` | GET | DRAFT event's child posts served to anyone (no status gate) | ✅ verified |
| 9 | MED‑HIGH | `/api/me/page` | GET | Any authed user sets `activePageId` to any page → reads its full profile + **physical address** | ✅ verified |
| 10 | MED | relationship lists (followers/following/members/memberships) | GET | Embedded PRIVATE accounts' identity + social edge shipped to anon | ✅ verified (policy nuance) |
| 11 | MED | `/api/pages/[pageId]/{posts,events}` | GET | Missing parent-page gate → HIDDEN page's (drifted) content served; 200 vs 404 | ✅ verified |
| 12 | MED | `/api/events/[id]/rsvps/counts` | GET | Existence + attendance-size oracle for PRIVATE/DRAFT events | ✅ verified |
| 13 | MED | `/api/image-attachments` | POST | `MESSAGE`/`IMAGE` target types fall through with no ownership check → inject image into others' threads | ✅ verified |
| 14 | MED | message routes (inbox/sent/conversation) | GET | Embeds use full `publicUserFields` not attribution-only → private profile fields ride along | ✅ verified |
| 15 | MED | `/api/events/[id]` | PATCH | `visibility` accepted with no clamp to parent page → child breaks out of PRIVATE scope | ✅ verified |
| 16 | MED | `/api/messages/inbox` | GET | No active-identity scoping (personal + page convos merged server-side) | ✅ verified |
| 17 | MED | list card embeds (`updates: take 1`) | GET | Nested "recent update" select lacks status filter → DRAFT update content on public cards | ✅ verified |
| 18 | MED | storage / `/api/upload` | — | Private-content images have world-readable public Supabase URLs (architectural) | ✅ verified |
| 19 | MED | `/api/events/[id]/rsvps` | POST | Anyone can RSVP to a PRIVATE event; DRAFT-existence oracle | ✅ verified |
| 20 | LOW | posts/events PATCH·DELETE, rsvps GET, read PATCH | various | 403-vs-404 existence oracles for unviewable content | ✅ verified |
| 21 | LOW | `/[handle]` LOCKED stub (SSR) | GET | Private profile's headline + location shown in locked preview | ✅ verified |
| 22 | LOW | `/api/image-attachments/[id]` | DELETE | Authorizes on image-uploader, not target-manager | ✅ verified |
| 23 | LOW | `/api/images` | POST | Stores client-supplied `url`/`path` unvalidated | ✅ verified |
| 24 | LOW | `/api/posts/[id]` | PATCH | Re-parenting (`pageId` change) doesn't re-inherit visibility | ✅ verified |
| 25 | LOW | `/api/messages/sent` | GET | No identity scoping (own sent-as-page merged into personal) | ✅ verified |

---

## HIGH severity

### 1–2. Write-time visibility inheritance bypass (the root cause)
**`POST /api/posts` · `POST /api/events`**

All four content models declare `visibility Visibility @default(PUBLIC)` (schema.prisma:95,
208, 345, 388). The server utils `createPost` (post.ts:148) and `createEvent` (event.ts:90)
correctly call `resolveParentVisibility(userId, pageId, eventId)` — but the **API route
handlers do not use those utils.** They call `prisma.post.create` / `prisma.event.create`
directly with no `visibility` field:

- `src/app/api/posts/route.ts:224-237` — create omits `visibility`.
- `src/app/api/events/route.ts:124-138` (draft) and `:190-206` (published) — both omit it.

**Effect:** a post authored on a PRIVATE page, or by a PRIVATE user, or an event on a PRIVATE
page, is stored as **PUBLIC**. It then passes `postListWhere` / `eventListWhere` and appears
in `/explore`, global search, and anonymous list APIs — exposing content (and event
location/latitude/longitude) that belongs to a private context. `syncDescendantVisibility`
only repairs this if the parent's visibility is *changed again later*; a stable PRIVATE parent
+ new child leaks permanently.

This is also the **root cause** of the "visibility drift" that findings 11 and 15 describe as a
concern — it is not a rare edge case, it is the default behavior of the primary create path
(the client posts through `post-client.ts` → `POST /api/posts`, not through the util).

**Fix:** in both POST handlers, resolve `visibility` via
`resolveParentVisibility(ctx.userId, pageId, eventId)` before create — or, better, route the
handlers through the existing `createPost`/`createEvent` utils so there is one create path.
Consider a data-repair migration for content already mislabeled PUBLIC under private parents.

### 3. SSR `/[handle]/about` renders PRIVATE about content with no gate
`src/app/[handle]/about/page.tsx:18-68` fetches the profile via `getUserByHandle` /
`getPageByHandle` (both ungated low-level fetchers) and renders `aboutContent` at line 100.
The **only** guard is line 68: `if (!canEdit && !aboutContent) notFound()`. There is no
`getViewerContext` / `canViewProfile` / `resolveProfileAccess`. The sibling SSR route
`/[handle]/page.tsx:73,145` gates correctly with `resolveProfileAccess`, and the JSON APIs
`by-handle/[handle]` and `pages/[pageId]` gate with `canViewProfile` → 404. So a PRIVATE user's
or page's full about content and identity is served to **anonymous** viewers.
**Fix:** build `viewer = await getViewerContext()` and `resolveProfileAccess(kind, entity,
viewer)`; `notFound()` unless FULL (about content is body content, so also 404 on LOCKED).

### 4. `GET /api/messages/conversation/[targetId]` leaks any user's full profile
`route.ts:67-76`: for `type=user` it fetches `prisma.user.findUnique({ where:{ id: targetId },
select: publicUserFields })` — the **full** profile (bio, location, interests, aboutContent,
elements) — with no `canViewProfile` gate, and returns it as `target` even in the
no-conversation-yet branch (`:113-119`). Any logged-in user can enumerate any private user's
profile fields by id. The sibling `by-handle/[handle]` gates the identical field shape.
**Fix:** select `publicUserEmbedFields` for `target`, or gate with `canViewProfile` and 404.

### 5. `PATCH /api/messages/conversation/[targetId]` trusts client `asPageId`
`route.ts:167-176`: the PATCH (mark-conversation-read) reads `asPageId` from the request body
and passes it straight to `getConversationIdsForIdentity`, which — when `asPageId` is set —
queries `{ pageId: asPageId }` and **ignores `userId` entirely**. There is no `canPostAsPage`
check (the GET handler has one at `:56-61`; PATCH omits it). Any authenticated user can pass an
arbitrary `pageId` and mark that page's private conversation as read, and learn from the
200-vs-404 + returned `updated` count whether a conversation exists and how many unread messages
it holds. **Fix:** mirror GET — `if (asPageId && !(await canPostAsPage(ctx.userId, asPageId)))
return forbidden()` before line 176.

### 6–7. Page **MEMBER** can read/modify page private DMs
`getPagesForUser` (permission.ts:94) filters only by `resourceType: PAGE` with **no role
filter**, so it returns pages where the caller is a plain MEMBER. Two message routes use it to
decide page-conversation access:

- `messages/inbox/route.ts:22` — feeds MEMBER pages into the participant query (`:27-35`), so a
  member receives every page DM (participant lists + `lastMessage` content) in their inbox.
- `messages/[messageId]/read/route.ts:63` — a MEMBER passes the participation check and can mark
  page DMs read.

Everywhere else, page message access is correctly ADMIN/EDITOR-only (`canPostAsPage`,
`getManagedPageIds`, and the unused `getConversationsForUser`). **Fix:** swap `getPagesForUser`
for `getManagedPageIds` in both routes.

### 8. `GET /api/events/[id]/posts` serves DRAFT events' child posts
`route.ts:18-24` fetches via `getEventById` (ungated; returns DRAFT) and gates only on
`canViewEvent` — never `event.status`. A DRAFT event with default PUBLIC visibility passes
`canViewEvent` for everyone, so its child posts (full title/content) are served to anonymous
viewers, while the sibling `GET /api/events/[id]` correctly 404s the DRAFT. **Fix:** after the
null-check, `if (event.status === "DRAFT" && viewer.userId !== event.userId) return notFound()`.
(Also add a `status: PUBLISHED` filter to `getEventUpdates` for non-owners — child update posts
default to DRAFT too.)

---

## MEDIUM severity

### 9. `GET /api/me/page` returns active page (incl. address) with no live permission check
`activePageId` is persisted through the NextAuth `jwt` callback (`auth.ts:112-115`), which
accepts `sessionData.activePageId` on any `trigger === "update"` with **zero validation** —
and `useSession().update()` is directly client-callable, bypassing the `PUT
/api/session/active-page` route that *does* validate. `GET /api/me/page:25` then returns
`getPageById(ctx.activePageId)` — which selects `addressLine1/2, city, state, zip, aboutContent`
— with **no `canPostAsPage` check** (the PUT sibling has one at `:54`). So any authenticated
user can set their active page to any page id and read its full profile and **physical mailing
address**, including PRIVATE pages they have no relationship to. (Every *write* consumer of the
active identity re-validates independently, so this is read-only — but the address is PII.)
**Fix:** re-validate `canPostAsPage` in the `jwt` callback, AND add the same check to `GET
/api/me/page` before returning.

### 10. Relationship-list embeds disclose PRIVATE accounts
The followers / following / members / memberships routes gate the **parent** profile correctly,
but the embedded rows carry no filter on the *embedded* profile's own visibility
(`follow.ts:27-43`, `permission.ts:132-146,178-197`). So a PRIVATE user who follows a PUBLIC
profile — or is a member of a PUBLIC page — has their handle/displayName/avatar and the social
edge shipped to anonymous viewers. The exposed fields are attribution-only (no bio/location), so
this is **existence + social-graph disclosure**, not full-profile leak. Whether a private
account's mere presence in a public list should be hidden is partly a **product-policy
decision** — flagging for a deliberate call rather than asserting it's unambiguously a bug.
**Fix (if policy says hide):** filter embedded profiles by viewer-relative visibility, or redact
private embeds to a stub.

### 11. Page collection routes miss the parent gate
`/api/pages/[pageId]/posts` and `/events` (`route.ts:13-18` each) call `getViewerContext` +
`getPostsByPage`/`getEventsByPage` with a viewer but **never** `requireViewableProfile("PAGE")`.
The `members`/`followers`/`following` routes *do* gate the parent. Consequences: (a) a HIDDEN
page returns `200 []` instead of 404 (minor oracle), and (b) combined with findings 1/2/15, any
child that is PUBLIC under a PRIVATE page is served here, grouped under the private page id.
**Fix:** add `if (!(await requireViewableProfile("PAGE", pageId, viewer))) return notFound()` at
the top of both handlers (the followers route is the template).

### 12 & 19. RSVP counts + creation ungated on PRIVATE/DRAFT events
- `GET /api/events/[id]/rsvps/counts` (`counts/route.ts:24-34`) checks only that the row exists,
  then returns attendance counts — a 200-vs-404 existence oracle **and** an attendance-size leak
  for PRIVATE/DRAFT events, to anonymous callers.
- `POST /api/events/[id]/rsvps` (`rsvps/route.ts:27-38`) checks `status === PUBLISHED` but never
  `canViewEvent`, so anyone with the id can RSVP to a PRIVATE published event; the DRAFT branch
  returns 400 vs 404-for-missing, a draft-existence oracle.

**Note:** the RSVP **attendee list** (`GET`, names + emails) *is* correctly restricted to the
event owner/host via `canManageEntity` (`rsvps/route.ts:78-86`) — the PII list is safe; only the
counts/creation siblings and the 403-vs-404 shape are the issue. **Fix:** select
`{id,userId,pageId,visibility,status}` and apply the draft + `canViewEvent` gate on both.

### 13. `POST /api/image-attachments` — unguarded MESSAGE/IMAGE targets
The authorization switch (`route.ts:52-80`) handles `PAGE` (`canPostAsPage`), `EVENT`, and
`POST` (owner) target types, but `AttachmentTarget` also includes `IMAGE` and `MESSAGE`
(schema), which **fall through with no target-ownership check** to the create at `:102`. An
authenticated user can attach their own image to an arbitrary `MESSAGE` target (a conversation
they aren't part of) — content injection into others' private threads. **Fix:** add explicit
branches for MESSAGE (verify conversation participation) and IMAGE, and default-deny any target
type without a resolved ownership check.

### 14. Message-route embeds ship full profile fields
`inbox/route.ts:50-51,67-68`, `sent/route.ts:26-28`, and `conversation/[targetId]/route.ts:126-127`
embed participants and senders with `select: publicUserFields` (full profile) rather than the
attribution-only `publicUserEmbedFields`. These are the only routes still using the full
selector for embedded users, so a PRIVATE user's bio/location/aboutContent rides along on every
inbox row and message. **Fix:** switch these embeds to `publicUserEmbedFields`.

### 15. `PATCH /api/events/[id]` allows visibility break-out
`route.ts:162` writes a client-supplied `visibility` with no comparison to the hosting page's
visibility, then cascades it to child posts (`:191-193`). An event created under a PRIVATE page
can be flipped to PUBLIC (and its children with it), after which the now-public event embeds the
private page's identity to anonymous viewers, defeating the page's existence-deny. Re-parenting
via `pageId` (`:151`) has the same gap with no visibility re-inheritance. **Fix:** on a
visibility *widen* (or `pageId` change), clamp to the parent page's visibility via
`resolveParentVisibility`, or require page-admin rights to widen.

### 16. Inbox has no active-identity scoping
`inbox/route.ts:27-35` merges personal and page conversations into one result set with no
`asPageId` parameter; identity separation happens only in the client
(`MessagesPageView.tsx:228`). Even with finding 6 fixed (MEMBER→ADMIN/EDITOR), the server still
ships an admin's page conversations into their personal inbox response. **Fix:** accept a
verified `?asPageId=` and query one identity at a time (the pattern `getConversationIdsForIdentity`
already implements).

### 17. Draft "recent update" content leaks on list cards
`postCollectionFields` (`fields.ts:140-149`) and `eventCollectionFields` (`:77-86`) include a
nested `updates: { take: 1 }` select with **no status/visibility clause**, surfaced as
`recentUpdate` on every list card (`posts/route.ts:127-133`, `events/route.ts:82-88`). Since
`POST /api/posts` accepts `isDraft:true` with a `parentPostId`/`eventId`, a user drafting an
update to their published post/event exposes that DRAFT's title/content to every viewer,
including anonymous. `_count.updates` also counts drafts. **Fix:** add `where: { status:
"PUBLISHED" }` to the nested `updates` select and `_count` in both field objects.

### 18. Private-content images have world-readable storage URLs (architectural)
Uploads go to a **public** Supabase bucket; signed URLs are disabled
(`storage.ts:18-19,90-112`), and filenames are only timestamp + 7 random chars. Any image
attached to a PRIVATE post/event/page has a permanent public object URL that bypasses all
DB-level gating once the URL is known (and the URL is returned to authorized viewers, who can
reshare it). **Fix:** serve gated images via short-TTL signed URLs or an authenticated proxy
route that re-checks `canView*` on the resolved target; keep private buckets non-public.

---

## LOW severity

- **20. 403-vs-404 existence oracles.** `posts/[id]` & `events/[id]` PATCH/DELETE return 403 for
  content the caller can't even view (`posts/[id]/route.ts:147-151,265-270`;
  `events/[id]/route.ts:97-102,236-241`); `rsvps` GET returns 403 for non-managers of any
  existing event (`rsvps/route.ts:74-86`); `[messageId]/read` returns 404-then-403 revealing
  message existence (`read/route.ts:40-42` vs `:69-74`). Per spec, not-viewable should 404. Keep
  403 only for viewable-but-not-editable.
- **21. LOCKED stub renders headline + location.** The private-profile locked preview
  (`LockedProfilePreview` → `ProfileHeader`) shows `headline` and `location`, which the
  sensitive-field doctrine (`user.ts:46-50`) says shouldn't ride along. Product-policy call.
- **22. `DELETE /api/image-attachments/[id]`** authorizes on the image *uploader*
  (`route.ts:37-42`), not the target's manager — a page admin who didn't upload can't detach; a
  since-removed member still can. Correctness divergence, not a leak.
- **23. `POST /api/images`** stores client-supplied `url`/`path` verbatim (`route.ts:22-51`) —
  external-content / tracking-pixel vector; prefer deriving them server-side in `/api/upload`.
- **24. `PATCH /api/posts/[id]`** accepts `pageId` without re-inheriting visibility
  (`route.ts:155-168,212`). (Note: post PATCH correctly does **not** accept `visibility`.)
- **25. `GET /api/messages/sent`** returns messages sent *as pages* merged into the personal
  view (`sent/route.ts:19-20`). Self-authored only, minimal impact.

---

## Confirmed-safe coverage (so the sweep is explicit)

- **Global list/search filters are correct.** `postListWhere`/`eventListWhere`/`profileListWhere`
  (visibility.ts:219-254) implement PUBLIC + viewer's own; UNLISTED/PRIVATE excluded. The GET
  list routes AND the filter (never OR-widen it), force `status:PUBLISHED` for non-own queries,
  and `search/profiles` passes a real viewer and ANDs the filter with the name/handle predicate.
  `topics` exposes only static taxonomy (no page associations). *The list-read side is sound; the
  leak (findings 1–2) is that private content is mislabeled PUBLIC at write time.*
- **Profile & content detail JSON APIs gate correctly** — `by-handle/[handle]`, `pages/[pageId]`
  (GET), `posts/[id]` (GET), `events/[id]` (GET) all build a viewer and 404 on not-viewable /
  DRAFT, with SSR↔API parity.
- **Relationship-list parent gates** — followers/following/members/memberships all call
  `requireViewableProfile`/`canViewUser`/`canViewPage` → 404. (The embed rows are finding 10.)
- **Request approve/deny is NOT IDOR-able** — `canActOnRequest` requires target-user identity or
  `canManagePage` (ADMIN). You cannot approve yourself into a private page.
- **Member role management, page create, membership join/leave, follow/unfollow** — all
  authorize on the correct role set (`canManagePage` ADMIN / `canPostAsPage` ADMIN-EDITOR), with
  last-admin-orphan guards and self-service-role restrictions. No self-promotion.
- **`POST /api/messages` (send)** — verifies `asPageId` via `canPostAsPage`, takes `senderId`
  from the session (no spoofing), and keeps page↔user conversations separate.
- **`unread-count`** — correctly uses `getManagedPageIds` (ADMIN/EDITOR) and splits personal vs
  per-page. This is the *correct* pattern the inbox route should copy.
- **RSVP attendee list (names+emails)** — restricted to owner/host via `canManageEntity`.
- **Content embeds on cards/detail** (post author, event host) use `publicUserEmbedFields` /
  `publicPageEmbedFields` — no bio/location/email. (Message routes are the exception, finding 14.)
- **Image read** — no GET-by-id route exists for images/attachments; `GET /api/images` is scoped
  to the caller's own uploads; current callers of the ungated `getImagesForTarget` gate the
  target first.
- **Write-authorization on posts/events** — PATCH/DELETE are owner/`canPostAsPage`-gated (the
  only issue is the 403-vs-404 shape, finding 20).

---

## Notes for the triager

- **Dead code worth deleting** (removes future footguns): `src/lib/utils/server/message.ts` in
  full (`getConversationsForUser` — the *correctly* ADMIN/EDITOR-scoped inbox query — plus
  `sendMessage`/`createConversation`/`markMessagesRead`) has **no importers**; the routes
  reimplement it inline, which is how finding 6 crept in. `getPostUpdates` (post.ts:41) is also
  unused. Reviving the util as the single message-query path would prevent recurrence.
- **Scope corrections found during the sweep:** there is no `/api/users/[userId]` detail route
  (only its relationship sub-routes), no `[handle]/layout.tsx`, and `/api/pages/[pageId]` uses
  `PUT` not `PATCH`.
- **Suggested fix ordering:** (1) findings 1–2 first — they are the root cause and the widest
  exposure (anonymous, global feed). (2) The messaging HIGHs 4–7 (trivial one-line helper swaps
  for 6–7). (3) SSR about-page 3. (4) `me/page` 9. Then the MEDs. Every fix is an *application*
  of an existing `visibility.ts` helper — none require new rules.
- **No routes were unreachable.** All 8 slices completed; the `notion/*` and `auth/*` routes are
  out of the visibility model's scope and were not audited here.
