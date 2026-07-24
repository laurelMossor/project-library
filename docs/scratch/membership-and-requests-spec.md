# Spec — Pages-have-Members + Request-to-Follow / Request-to-Join

> ⚠️ **Superseded in part (2026-07-24, `netwerk-8`).** Both tickets were built, but self-service
> **Join / membership is now hidden behind `FEATURES.SELF_SERVICE_MEMBERSHIP`** — Follow (with
> request-to-follow on private entities) is the single relationship for beta, since following a page
> already grants the same access. The **request-to-FOLLOW** half of this spec is live; the
> **request-to-JOIN** / MEMBER-role half is deferred behind the flag. Also note the RSVP gate helper
> named below (`canManageEntity`) was since renamed **`canActAsEntity`**.

**Status:** Draft for review (Laurel)
**Milestone:** Open Beta → Netwerk
**Covers two tickets, designed together because they share one graph + permission surface:**

- **P0 — Pages have Members** ([ticket](https://app.notion.com/p/36d453d029b0815db9c0d534ca0645e6)): activate the `MEMBER` role — add/remove members, change roles, a member-management surface, and wire membership into private-page visibility + member-scoped RSVPs.
- **P1 — Request-to-Follow / Request-to-Join** ([ticket](https://app.notion.com/p/376453d029b0813498f3cee9de603a74)): add the approval layer that was deferred when visibility shipped. A `PRIVATE` user/page must stop auto-accepting new follow/join requests; `PUBLIC`/`UNLISTED` keep instant-follow.

> This is a **spec only** — no implementation, migrations, or tests here. Out of scope: notification delivery (assume the dispatcher doesn't exist; the approval UI must stand alone), Block/unblock (seam noted only), bulk request management, auto-expiry.

---

## 1. Problem & goals

### What's broken
The Netwerk visibility model (`PUBLIC`/`UNLISTED`/`PRIVATE`) shipped with **enforcement but no gatekeeping**. A `PRIVATE` entity is viewable by its owner *or anyone holding a relationship edge* — a follow (users) or a follow-or-membership (pages) — see `canViewProfile` ([visibility.ts:84](../src/lib/utils/server/visibility.ts)). But the two routes that *create* those edges never check the target's visibility:

- `POST /api/follows` instantly creates a `Follow` for any target ([follows/route.ts:60](../src/app/api/follows/route.ts), [:105](../src/app/api/follows/route.ts)).
- `POST /api/pages/[pageId]/membership` instantly grants `MEMBER` ([membership/route.ts:54](../src/app/api/pages/[pageId]/membership/route.ts)).

So today, **a stranger can follow a PRIVATE user — or self-join a PRIVATE page — and instantly gain read access to everything that visibility was supposed to protect.** The privacy tier is advisory until the approval layer lands. The visibility work deliberately deferred this: it converted *existing* followers of a newly-private page to `MEMBER` but left *new* access ungated (journal 2026-06-19; STATUS.md).

Separately, `MEMBER` is marked **"future use"** in the schema ([schema.prisma:22](../prisma/schema.prisma)). The role already *works* for visibility, but there is no first-class management surface (role changes, a settings tab) and a latent last-admin gap in the role-change route.

### Goals
1. **Close the privacy gap.** A `PRIVATE` target routes new follow/join attempts through approval; `PUBLIC`/`UNLISTED` stay instant.
2. **Activate `MEMBER` as a managed role** — admins add/remove members and change roles from a proper page-settings surface, with last-admin safety.
3. **Reuse, don't rebuild.** The follow graph, the permission helpers, the visibility layer, and the connections UI already exist. The new model is one small table and one server-util choke point. The existing ConnectionsView is the most logical place for this interface, but consider modern day best practices to make a recommended suraface, and if there should be a new one.
4. **Stand alone without notifications.** Admins/owners discover pending requests by a pull surface (tab + count badge), not a push.

### Who it's for
- **Page admins/editors** running a private group, gallery, or workspace who need to vet who gets in.
- **Private users** who want followers to be approved (the Instagram/Mastodon private-account model).
- **Members** who get a real role and member-only access, distinct from public followers.

---

## 2. Current-state map

### 2a. Lifecycle — follow a user / follow a page
- **UI:** `ProfileButtons` Follow toggle on every public profile header ([ProfileButtons.tsx:52](../src/lib/components/profile/ProfileButtons.tsx)); rendered at [[handle]/page.tsx:202](../src/app/[handle]/page.tsx).
- **Route:** `POST /api/follows` with `{ followingUserId }` or `{ followingPageId }` ([follows/route.ts:15](../src/app/api/follows/route.ts)). Validates exactly-one target, no self-follow, target exists, not already following — then **creates the `Follow` immediately** ([:60](../src/app/api/follows/route.ts), [:105](../src/app/api/follows/route.ts)). **No visibility check.**
- **Schema:** `Follow`, polymorphic on both ends (`followerId`/`followerPageId` → `followingUserId`/`followingPageId`), four composite `@@unique` pairs, **no status field** ([schema.prisma:425](../prisma/schema.prisma)).
- **Unfollow / remove-follower:** `DELETE /api/follows/[followingOwnerId]?type=&removeFollower=` ([follows/[followingOwnerId]/route.ts:63](../src/app/api/follows/[followingOwnerId]/route.ts)); surfaced in `ConnectionsPageView` ([:251](../src/lib/components/profile/ConnectionsPageView.tsx), [:263](../src/lib/components/profile/ConnectionsPageView.tsx)).
- **PUBLIC vs PRIVATE today:** **identical** — instant follow either way.

### 2b. Lifecycle — join a page (self-service)
- **UI:** `JoinButton` on page headers ([JoinButton.tsx:19](../src/lib/components/profile/JoinButton.tsx)); hidden when the viewer is acting *as* a page ([:42](../src/lib/components/profile/JoinButton.tsx)) — a page can't be a member.
- **Route:** `POST /api/pages/[pageId]/membership` → `grantPermission(MEMBER)` immediately; `409` if you already hold ADMIN/EDITOR ([membership/route.ts:38](../src/app/api/pages/[pageId]/membership/route.ts)). **No visibility check.** `DELETE` leaves (refuses for ADMIN/EDITOR) ([:67](../src/app/api/pages/[pageId]/membership/route.ts)).
- **Schema:** `Permission(userId, resourceId, resourceType, role)`, unique on the triple ([schema.prisma:291](../prisma/schema.prisma)).
- **PUBLIC vs PRIVATE today:** **identical** — instant `MEMBER` either way.

### 2c. Lifecycle — admin adds/removes a member, changes a role
- **Add member:** `POST /api/pages/[pageId]/members` `{ userId, role }`, requires `canManagePage` (ADMIN) ([members/route.ts:40](../src/app/api/pages/[pageId]/members/route.ts)). Surfaced via `ConnectionsPageView` "+ Add members" ([:273](../src/lib/components/profile/ConnectionsPageView.tsx)).
- **Change role:** `PUT /api/pages/[pageId]/members/[userId]` `{ role }`, ADMIN-only, `grantPermission` upsert ([members/[userId]/route.ts:19](../src/app/api/pages/[pageId]/members/[userId]/route.ts)). **No UI wired** and **no last-admin guard** (see §5). There is also no way to add soemone to the Editor role. This is deferred/out of scope for this work, but shuld be considered. 
- **Remove member:** `DELETE …/members/[userId]`, ADMIN-only, last-admin guard only on self-removal ([:57](../src/app/api/pages/[pageId]/members/[userId]/route.ts)).
- **Admins sub-surface:** `GET/POST /api/pages/[pageId]/admins` ([admins/route.ts](../src/app/api/pages/[pageId]/admins/route.ts)) + `DELETE …/admins/[permissionId]` with a real last-admin guard ([admins/[permissionId]/route.ts:37](../src/app/api/pages/[pageId]/admins/[permissionId]/route.ts)); `ManageAdmins` → `ManageConnections` ([ManageAdmins.tsx](../src/lib/components/connections/ManageAdmins.tsx)).
- **Permission helpers:** `grantPermission`/`revokePermission`/`getResourcePermissions`/`getUserMemberships`/`canManagePage` ([permission.ts](../src/lib/utils/server/permission.ts)).

### 2d. The privacy gap, traced
1. Stranger hits `POST /api/follows {followingUserId: privateUser}` → `Follow` created, no visibility branch ([follows/route.ts:60](../src/app/api/follows/route.ts)).
2. Next read of the private profile: `canViewProfile("USER", …)` → `isFollower` is now `true` → **access granted** ([visibility.ts:93](../src/lib/utils/server/visibility.ts)).
   Same path for pages via self-join → `isMember` true → granted ([visibility.ts:96](../src/lib/utils/server/visibility.ts)).
   **Auto-accept happens implicitly**: there is no accept step, because creating the edge *is* the grant.

### 2e. What `MEMBER` does and does NOT gate today
- **DOES gate (already live):** all private-page visibility. `getViewerContext` loads **every** `Permission` row (any role) into `memberPageIds` ([visibility.ts:40](../src/lib/utils/server/visibility.ts)); `isMember` is a pure membership check ([visibility.ts:74](../src/lib/utils/server/visibility.ts)) consumed by `canViewProfile`/`canViewEvent`/`canViewPost`, the list filters (`profileListWhere`/`eventListWhere`/`postListWhere`), and `collectionVisibilityWhere`. A `MEMBER` already sees the private page, its private posts/events, and gets them in their own feed.
- **Does NOT gate:** nothing member-specific beyond visibility. Posting "as" the page still needs ADMIN/EDITOR (`canPostAsPage`). **RSVPs are fully anonymous** (`name`+`email`, no `userId`; [schema.prisma:400](../prisma/schema.prisma)); `POST /rsvps` is public ([rsvps/route.ts:15](../src/app/api/events/[id]/rsvps/route.ts)) and the attendee-list `GET` is gated to **`event.userId` only** — not even page admins ([rsvps/route.ts:76](../src/app/api/events/[id]/rsvps/route.ts)). So "member-scoped RSVPs" is genuinely new surface (§3e).

### 2f. Existence-deny is already the house style
`requireViewableProfile` collapses *missing* and *not-viewable* into one `null` → routes return `404`, never leaking existence ([visibility.ts:173](../src/lib/utils/server/visibility.ts)). Private entities never appear in global lists/search (`profileListWhere`, [visibility.ts:193](../src/lib/utils/server/visibility.ts)). **This is the constraint the request flow has to thread** (§4d / §5).

---

## 3. Proposed model

### 3a. Schema — one new table: `AccessRequest` (recommended)

**Decision: a dedicated `AccessRequest` model, NOT a `status` field on `Follow`/`Permission`.**

The visibility layer treats the *existence* of a `Follow` row or a `Permission` row as the access grant — `isFollower`/`isFollowingPage` check existence ([visibility.ts:56](../src/lib/utils/server/visibility.ts)), and `getViewerContext` slurps **every** permission row into `memberPageIds` regardless of role ([visibility.ts:40](../src/lib/utils/server/visibility.ts)). If a pending request were a `Follow`/`Permission` row carrying `status = PENDING`, it would **instantly grant the access we're trying to withhold** unless every one of those call sites is updated to filter `status = ACCEPTED`. That is exactly the leak class the 2026-06-19 review fixed. A separate table keeps the grant tables meaning "granted," full stop — nothing in the visibility layer changes.

This also matches house conventions: polymorphic "exactly-one-of" FKs (like `Follow`, `ConversationParticipant`, `ProfileElement`), single-responsibility models, closed enums (feedback memory), and the consume-on-action token pattern (`SignupInvite`).

```prisma
enum AccessRequestKind {
  FOLLOW // requester wants to follow a User or Page  → materializes a Follow
  JOIN   // requester (a User) wants MEMBER on a Page  → materializes a Permission(MEMBER)
}

model AccessRequest {
  id        String            @id @default(cuid())
  kind      AccessRequestKind
  createdAt DateTime          @default(now())

  // Requester — exactly one (mirrors Follow's follower side).
  // JOIN is user-only (pages don't hold MEMBER): requesterPageId must be null for JOIN (app-enforced).
  requesterId     String?
  requesterPageId String?

  // Target — exactly one. JOIN targets a Page only: targetUserId must be null for JOIN (app-enforced).
  targetUserId String?
  targetPageId String?

  requester     User? @relation("RequestsMade",  fields: [requesterId],     references: [id], onDelete: Cascade)
  requesterPage Page? @relation("RequestsMadeAs", fields: [requesterPageId], references: [id], onDelete: Cascade)
  targetUser    User? @relation("RequestsForUser", fields: [targetUserId],   references: [id], onDelete: Cascade)
  targetPage    Page? @relation("RequestsForPage", fields: [targetPageId],   references: [id], onDelete: Cascade)

  // Idempotency: re-POST while pending → no-op return of the existing row.
  @@unique([requesterId, targetUserId, kind])
  @@unique([requesterId, targetPageId, kind])
  @@unique([requesterPageId, targetUserId, kind])
  @@unique([requesterPageId, targetPageId, kind])

  // The admin/owner "incoming requests" query:
  @@index([targetPageId])
  @@index([targetUserId])
  @@map("access_requests")
}
```

**No `status` column.** A row's mere existence = *pending*. This is the same idiom as `Follow` (existence = followed) and `SignupInvite` (consume on action). Approve → materialize the edge **and delete the request** in one transaction. Deny → delete the request. Tradeoffs and the re-request decision are in §3b.

**Why one model, not two (`FollowRequest` + `JoinRequest`):** the *request* is structurally identical — requester → target, pending until acted on. Only the materialization differs (Follow vs Permission), and that's a two-line switch on `kind`. One table = one admin query, one server-util, one UI list. (The constraint that JOIN is user→page-only is app-enforced, like the existing "exactly one of" CHECKs on `Follow`.)

A DB CHECK constraint (added in the migration, as `Follow` already does per [schema.prisma:423](../prisma/schema.prisma)) should enforce exactly-one-requester and exactly-one-target.

### 3b. Deny semantics & re-request — **deny = delete the row** (recommended)

When an admin/owner denies, **delete the `AccessRequest`**. Consequences:
- **Re-request is allowed** — the requester can ask again later. This is the Mastodon/Instagram model: a denied follow request just vanishes; stopping someone from re-asking is what **Block** is for (separate ticket — §5 seam).
- **No "denied" signal leaks** to the requester (their button simply returns to "Request"). Avoids the awkward "you were rejected" notification — appropriate since notifications are out of scope anyway.
- **No audit trail** of denials, and we can't distinguish "never asked" from "asked and denied." Accepted tradeoff at beta; if an audit trail is later needed, add a separate append-only log rather than resurrecting a `status` column (which would reintroduce the leak risk).

Idempotency: a re-POST while a request is already pending hits the `@@unique` and returns the existing row (HTTP `200`, treated as success), never a duplicate.

### 3c. The single branch point — instant vs request (server-util layer)

All "should this be instant or a request?" logic lives in **one new server util**, `src/lib/utils/server/requests.ts`, next to `follow.ts`/`permission.ts`/`visibility.ts`. Routes stay thin — consistent with the visibility-layer rule ("do NOT scatter visibility checks into route handlers," [visibility.ts:16](../src/lib/utils/server/visibility.ts)).

```
requestOrCreateFollow(requester, target):
  if target.visibility != PRIVATE  → create Follow (today's path)        → { status: "followed" }
  else                             → upsert AccessRequest(FOLLOW)        → { status: "requested" }

requestOrJoinPage(userId, page):
  if page.visibility != PRIVATE    → grantPermission(MEMBER) (today)     → { status: "joined" }
  else                             → upsert AccessRequest(JOIN)          → { status: "requested" }

approveRequest(actor, requestId):   // actor must own/admin the target
  tx: materialize edge (Follow or Permission(MEMBER)) + delete AccessRequest
denyRequest(actor, requestId):      // actor must own/admin the target
  delete AccessRequest
```

This util is also the **single choke point** where a future `isBlocked(requester, target)` check slots in (Block seam, §5) and where the notification "emit" hook lives (no-op today, §3f).

### 3d. Routes — extend, don't add new top-level surfaces

| Route | Change |
|---|---|
| `POST /api/follows` | Call `requestOrCreateFollow`. Return `{ status: "followed" \| "requested" }` so the button can switch label. Must support **pages as requesters** (`requesterPageId`) since pages can follow. |
| `POST /api/pages/[pageId]/membership` | Call `requestOrJoinPage`. Return `{ role: "MEMBER" }` (joined) or `{ status: "requested" }`. |
| `GET /api/pages/[pageId]/requests` | **New.** ADMIN/EDITOR-gated list of pending JOIN+FOLLOW requests targeting the page. |
| `GET /api/me/requests` | **New.** The current user's *incoming* FOLLOW requests (for a private user vetting followers) + a count for the badge. |
| `POST /api/pages/[pageId]/requests/[id]/approve` \| `/deny` | **New.** ADMIN/EDITOR (or EDITOR? — §8). Calls `approveRequest`/`denyRequest`. |
| `POST /api/me/requests/[id]/approve` \| `/deny` | **New.** Private user acting on their own follow requests. |
| `PUT /api/pages/[pageId]/members/[userId]` | **Add a last-admin guard** (see §5) — currently missing. |
| `GET /api/events/[id]/rsvps` | Widen organizer check from `event.userId` to **page ADMIN/EDITOR** via `canManageEntity` (§3e). |

Add route constants to [routes.ts](../src/lib/const/routes.ts) (e.g. `API_PAGE_REQUESTS`, `API_ME_REQUESTS`) — never hardcode.

### 3e. Member-scoped RSVPs — scoped conservatively

The ticket line "wire membership into … member-scoped RSVPs" is terse and the `Rsvp` model is anonymous. Two layers, recommend shipping only the first now:

1. **In scope (small, a correctness fix):** the attendee-list `GET /rsvps` currently lets *only* `event.userId` view it ([rsvps/route.ts:76](../src/app/api/events/[id]/rsvps/route.ts)) — a page admin who isn't the literal creator can't see RSVPs to their own page's event. Widen to `canManageEntity` (page ADMIN/EDITOR). This is the natural "members/admins" wiring and fixes a latent bug.
2. **Open decision (schema change — §8):** an *authenticated member RSVP* that records `Rsvp.userId` (so a private page's event RSVPs are tied to real members rather than free-text email). This is a real `Rsvp` migration and arguably its own ticket; flagged, not designed here. (ADD A NEW TICKET FOR MEATUP RELEASE)

### 3f. Notification seam (no-op today)

`approveRequest`, `denyRequest`, role-change, and request-created each call a single `emitActivity(kind, …)` placeholder that today just delegates to the existing `logAction` ([follows/route.ts:67](../src/app/api/follows/route.ts) already uses it). When the dispatcher ships, wiring is one function body, not a scatter of call sites. (ADD A FOLLOWUP TICKET FOR MEATUP)

### 3g. UI surfaces — reuse the connections + settings shells

- **Member management → a page-settings tab.** The Membership tab in `ConnectionsPageView` already lists members, gates add/remove to admins, and handles last-admin errors inline ([ConnectionsPageView.tsx:366](../src/lib/components/profile/ConnectionsPageView.tsx)). Promote this into the page's settings (`/settings` renders `ProfilePageView` today; add a "Members" tab for pages) and **add the missing role-change control** (a small ADMIN/EDITOR/MEMBER selector per row → `PUT …/members/[userId]`). `ManageConnections`/`ManageAdmins` ([ManageConnections.tsx](../src/lib/components/connections/ManageConnections.tsx)) is the generic base to extend. (PLEASE GO INTO MORE DEPTH HERE, I'm not sure what you mean. I like the connections view page since it handles all connections. Breaking it out on it's own should be clear and justifiable)
- **Requests surface → a new "Requests" tab** beside Followers/Following/Membership in the same `TabbedPanel` ([ConnectionsPageView.tsx:70](../src/lib/components/profile/ConnectionsPageView.tsx)) — pending rows with Approve / Deny actions reusing the existing `ExpandableActions` pattern ([:83](../src/lib/components/profile/ConnectionsPageView.tsx)). Shows for: a page's admins/editors, and a private user on their own profile.
- **Badge → reuse `NotificationDot`** (already in the component map for nav unread) on the page/profile manage entry, fed by the request-count endpoint. This is the "stand-alone without notifications" affordance: pull, not push.
- **Buttons → relabel, don't replace.** `ProfileButtons` Follow → "Request to follow" / "Requested" when the target is private; `JoinButton` → "Request to join" / "Requested" likewise. Both already read `useActiveProfile` and toggle on a fetched state, so this is a label/branch change driven by the `{ status }` response (§3d). (NOTE: This is a good opportunity to weigh private pages having followers AND members, so that followers could see publicly posted updates and members can see private content, but my gut says this is out of scope for Beta stage. Perhaps describe the edge, and make a note to document this as out of scope/planned in the code.)

---

## 4. UX flows

### 4a. Request → approve/deny (happy path, private page join)
1. Logged-in user opens a **private page they were linked to** → sees the **locked preview** (name, handle, avatar, headline) + "Request to join" (§4d).
2. Clicks → `POST …/membership` → `AccessRequest(JOIN)` created → button becomes **"Requested"**.
3. Page admin opens the page's **Members → Requests** tab (a count badge drew them there) → sees the requester → **Approve**.
4. `approveRequest`: `Permission(MEMBER)` created + request deleted (one tx). Requester is now a member; next load, the full page renders. (No notification today — they discover it on next visit; dispatcher will close this later.)
5. **Deny** instead → request deleted; requester's button silently resets to "Request to join"; they may ask again.

### 4b. Request → approve (private user follow)
Same shape, but the actor is the **user themselves** on their own profile's Requests tab, materializing a `Follow` on approve. Pages-as-followers (`requesterPageId`) work identically.

### 4c. Member management & role change
1. Admin opens **Members** tab → list with role badges (already rendered, [ConnectionsPageView.tsx:374](../src/lib/components/profile/ConnectionsPageView.tsx)).
2. **Add member** (existing) → instant `Permission(MEMBER)`, no request (an admin add *is* the approval).
3. **Change role** (new control) → `PUT …/members/[userId]` → role updated immediately; member sees the new badge on their next Memberships-tab load (graceful degradation, no push). Guard: can't demote the last ADMIN (§5).
4. **Remove member** (existing) → `revokePermission`; last-admin guard on self-removal already present.

### 4d. Edge path — reaching a private entity to request at all
**The tension:** a private profile is `404` to non-members ([visibility.ts:173](../src/lib/utils/server/visibility.ts)), so a stranger can't see a "Request" button. Resolution in §5 (locked preview). Happy path: the requester has the **handle/link** (private entities are never in search/lists, so access is link-only — this preserves no-enumeration). They load `/<handle>`, get the header-only stub + request button, and request. Content stays hidden until approved.

---

## 5. Edge cases & invariants

- **Locked-profile preview (the key existence-deny resolution).** Introduce a third profile state between "full view" and "404": for a `PRIVATE` entity that **exists and is reached directly by handle**, the SSR `/[handle]` page renders a **header-only stub** (name, handle, avatar, headline) + Request button, and suppresses body/collection. This is the Instagram/LinkedIn private-account model. Constraints that keep the privacy guarantee intact:
  - Global lists/search still existence-deny (`profileListWhere` unchanged) → **no enumeration**; you can only reach the stub if someone gave you the handle.
  - The JSON detail/content routes (`GET /api/pages/[pageId]`, posts/events) **still 404** for non-members — only the SSR shell shows the minimal stub.
  - `UNLISTED` is unchanged (already viewable with the link via `canViewProfile`). Only `PRIVATE` gains the stub. **Confirm with Laurel (§8)** — this is a deliberate softening of today's hard 404.
- **Last-admin, role change (a real gap to fix).** `PUT …/members/[userId]` upserts the role with **no last-admin guard** ([members/[userId]/route.ts:43](../src/app/api/pages/[pageId]/members/[userId]/route.ts)) — an admin could demote the sole ADMIN to MEMBER and orphan the page. Add the same `adminCount <= 1` guard the DELETE routes use ([admins/[permissionId]/route.ts:37](../src/app/api/pages/[pageId]/admins/[permissionId]/route.ts)).
- **Idempotent / duplicate requests.** Re-POST while pending → `@@unique` hit → return existing row as success. Never create a second.
- **Already in the relationship.** Requesting a follow you already have, or joining a page where you already hold any role, short-circuits to the existing-state response (the membership route already 409s privileged roles, [membership/route.ts:46](../src/app/api/pages/[pageId]/membership/route.ts)). Don't create an `AccessRequest` if the edge already exists.
- **Re-request after denial.** Allowed (deny deletes the row). Hard-stopping repeat requesters is **Block's** job, not this feature's.
- **Public → Private flip.** Existing followers were already converted to `MEMBER` by the visibility cascade (don't redo). No pending requests can pre-exist (none were possible while public). New access now needs approval. *Existing followers of a now-private **user*** keep their follow edge → keep access (consistent with the page rule).
- **Private → Public/Unlisted flip.** The privacy reason for pending requests is gone. **Recommend: auto-approve (materialize) all pending requests for that entity in the same transaction as the flip** — least surprising for people who already asked. (Alternative: drop them and let instant-follow resume — flagged §8.)
- **Acting "as" a page.** A page can *follow* (so `requesterPageId` is valid for FOLLOW) but cannot *join* (no page MEMBER rows). `JoinButton` already hides when acting as a page ([JoinButton.tsx:42](../src/lib/components/profile/JoinButton.tsx)); keep that.
- **EDITOR vs ADMIN authority over requests.** Adding members today is ADMIN-only (`canManagePage`). Approving join requests is the same authority class — recommend ADMIN/EDITOR may approve (matches who can manage page content), but **confirm (§8)**.
- **Visibility-layer invariant (must hold):** pending `AccessRequest` rows must **never** appear in `Follow`/`Permission` queries. Because they live in a separate table, `isFollower`/`isMember`/`getViewerContext` are untouched — this is the whole point of §3a.

---

## 6. Migration & rollout notes

- **New table + enum** (`access_requests`, `AccessRequestKind`) — additive, non-destructive. Add the exactly-one CHECK constraints in the migration (as `Follow` does).
- **No backfill** of request rows. The `PUT` last-admin guard and the RSVP `GET` widening are code-only.
- 🚨 **Prod-migration caution still applies.** The Netwerk stack already carries **breaking** schema prod doesn't have (visibility columns, email-token tables, `tokenVersion`) and must be migrated **before `develop` → `main`**, expand-then-contract, or the live site 500s — the exact gap that took prod down on 04/19 (STATUS.md; `docs/DEPLOYMENT.md`). The new `access_requests` table is additive and rides the *same* migration window — apply it in the expand phase. Do **not** merge to `main` until prod is migrated. DB ops require Laurel's approval.
- **No data loss risk** in this feature (no column drops, no edge rewrites). The visibility cascade that converts followers↔members on a flip already exists and is unchanged.

---

## 7. Suggested build sequence / ticket breakdown

Ships **independently**, P0 first:

1. **P0 — Activate MEMBER management** (no schema change): promote the Members tab into page settings, add the **role-change selector** (`PUT …/members/[userId]`), **add the last-admin guard** to that PUT, and **widen RSVP `GET`** to page admins via `canManageEntity`. Closes the P0 ticket; needs none of the request work.
2. **P1a — `AccessRequest` schema + `requests.ts` choke point**: the model, the four `requestOrX`/`approve`/`deny` utils, and the notification no-op seam. Rides the existing prod migration.
3. **P1b — Wire the branch into the two write routes** (`POST /api/follows`, `POST …/membership`): private → request, public/unlisted → instant. Relabel `ProfileButtons`/`JoinButton` from the `{ status }` response.
4. **P1c — Locked-profile preview** for `PRIVATE` profiles (the §5 stub) — prerequisite for anyone to *reach* a request button.
5. **P1d — Requests surface**: the new Requests tab + `NotificationDot` badge + the list/approve/deny routes (page + self).
6. **P1e — Private→Public flip auto-approve** of pending requests (small, in the flip transaction).

(2–6 are the P1 ticket; can be one PR or split 2+3+4 / 5 / 6.)

---

## 8. Open decisions for Laurel

1. **Member-scoped RSVP depth** — ship only the admin-can-view-RSVPs fix (§3e.1), or also add `Rsvp.userId` for authenticated member RSVPs (a schema change, arguably its own ticket)? *Recommend: fix only now.*
2. **Admin-invite acceptance** — keep admin "Add member" **instant** (today's behavior, recommended) or require the invitee to accept first? *Recommend: instant at beta.*
3. **Deny semantics** — silent **delete** (recommended, §3b) vs. keep a `DENIED` state for audit / to suppress re-asking until Block ships?
4. **Locked-profile preview** — OK to soften `PRIVATE` profiles from a hard `404` to a name+avatar+headline **stub** reachable by direct handle (§5)? This is what makes requesting possible; it's a real (small) privacy tradeoff.
5. **Private → Public flip** — **auto-approve** pending requests (recommended) or drop them?
6. **Who approves page requests** — ADMIN only, or ADMIN **and** EDITOR (recommended, matches content-management authority)?
7. **Pages as follow-requesters** — allow a page to request-to-follow a private entity (`requesterPageId`), or restrict requests to users only at beta?

---

### Block/unblock seam (noted, not designed)
Block is a separate P1 ticket. Its only contacts with this design: (a) a future `isBlocked(requester, target)` check belongs in the **`requests.ts` choke point** (§3c) — refuse request creation and follow/join there; (b) blocking should **delete any pending `AccessRequest`** between the pair. Both are single call sites by construction. No further Block design here.
