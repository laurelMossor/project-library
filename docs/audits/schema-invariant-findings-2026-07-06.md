# Schema-Invariant Enforcement Audit — Findings

**Date:** 2026-07-06
**Scope:** Report-only. For each documented schema invariant, trace every create AND update write path and classify enforcement as **ENFORCED** (a DB constraint or a shared server-util guard makes a bad write impossible), **CALLER-DISCIPLINE** (works only because the caller happens to pass the right thing), or **UNGUARDED** (a bad write would succeed silently).
**Method:** Orchestrator verified the DB-constraint layer directly (read all 23 migrations); four read-only subagents traced the API routes under `src/app/api/` and the server utils under `src/lib/utils/server/`. No code was changed.

---

## Headline findings

1. **The claimed DB-CHECK layer does not exist.** Five invariants have `schema.prisma` comments asserting a DB CHECK constraint enforces them (Post XOR at `:344`, Follow at `:446–448`, ConversationParticipant at `:593`/design, ProfileElement at `:655`/design, Handle at `:274–278`). **None of these constraints were ever written into a migration.** The *only* exactly-one CHECKs in the entire tree are on `access_requests` (`prisma/migrations/20260628000000_add_access_requests/migration.sql:49–53`) — and that migration's own comment ("mirrors the Follow model's hand-added CHECKs") is false; the Follow CHECKs it references never existed. Every one of these invariants therefore rests entirely on application code.

2. **One invariant is exploitable through the public API today — not just latent.** `INV-6 ProfileElement` update path spreads client keys straight into `prisma.profileElement.update`, so `PUT /api/me/user` can set both `userId` and `pageId`, null out the owner, or reassign an element to another user. Every other gap is a *latent* hole (a new/refactored caller would trip it) rather than a live one.

3. **INV-3 and INV-13 are the same root cause.** A reply to a page-hosted post is stored with `pageId: null` (the create route never derives the child's `pageId` from its parent). That single write-time gap is *also* why `syncDescendantVisibility` misses the child when the page flips to PRIVATE — producing a LISTED child of a PRIVATE parent, served unfiltered. Enforcing "child `pageId` = parent `pageId`" at write time closes both.

4. **The house rule is followed for the *decision* but not the *write*.** `permission.ts:2–6` says route every authorization decision through a helper here — and the four route handlers do. But the checks live in the routes, while `post.ts` still carries three page/visibility-accepting write utils (`createPost:123`, `createDraftPost:192`, `publishPost:210`) with no guard inside them — the exact "second, divergent write path" that `event.ts:87–90` documents having deleted on the event side.

---

## Master table

| # | Invariant | Status | Where enforced (or gap) | Recommended home for fix |
|---|-----------|--------|--------------------------|--------------------------|
| 1 | Post `parentPostId` XOR `eventId` | **UNGUARDED** | Claimed DB CHECK (schema.prisma:344) absent; create route validates each FK independently, never rejects both | **DB CHECK** on `posts` + 400 in `posts/route.ts` |
| 2 | Post updates cannot nest | CALLER-DISCIPLINE | Guard only in `posts/route.ts:205`; `createPost` util has none | Move guard into `createPost` (post.ts) |
| 3 | Child post `pageId` in sync with parent | **UNGUARDED** | Never derived from parent on create; parent-edit cascade syncs visibility only, not pageId; child `pageId` directly editable | Server-util guard on create + extend PATCH cascade |
| 4 | Follow: one follower AND one followee | CALLER-DISCIPLINE | No DB CHECK (all 3 follow migrations verified); shared mappers are sound but not mandatory | **DB CHECK** on `follows` (×2) |
| 5 | ConversationParticipant: one of userId/pageId | CALLER-DISCIPLINE | No DB CHECK; each call site passes a single-key object by construction | **DB CHECK** on `conversation_participants` |
| 6 | ProfileElement: one of userId/pageId | **UNGUARDED (live)** | Update spreads client keys (`profile-element.ts:68–72`); reachable via `PUT /api/me/user` | Whitelist keys in `updateProfileElement` + DB CHECK |
| 7 | Handle: one of userId/pageId; always lowercase | CALLER-DISCIPLINE | No DB CHECK (plain unique indexes, not partial); lowercasing done at route edges, utils explicitly punt | Lowercase inside utils + DB CHECK (`handle = lower(handle)` and exactly-one) |
| 8 | Page-authored content needs ADMIN/EDITOR | CALLER-DISCIPLINE | All 4 live HTTP paths call `canPostAsPage`; but `createPost`/`createDraftPost` utils accept `pageId` with no check | Move check into write utils (or delete unused utils) |
| 9 | Page create auto-creates Permission(ADMIN) atomically | **ENFORCED** | Single `$transaction` in `page.ts:114–140` | None needed |
| 10 | Only PUBLISHED surfaces; publish validates non-empty | posts: CALLER-DISCIPLINE / events: **UNGUARDED** | Post PATCH validates; `publishPost` util does not. Event PATCH publishes empty drafts (`events/[id]/route.ts:163`) | `validatePublishable()` in event PATCH; guard/delete `publishPost` |
| 11 | Rsvp unique per [eventId, email] | **ENFORCED** | DB unique index (`20260323055100…:35`) + single upsert path | None (optional: `lower(email)` index) |
| 12 | emailVerified gates login; reset bumps tokenVersion | **ENFORCED** | `auth.ts:47–49`, `85–92`; `reset-password/route.ts:49–52` single-statement bump | None (optional atomicity hardening) |
| 13 | Visibility cascade + inheritance integrity | resolve: CALLER-DISCIPLINE / sync: **UNGUARDED** | `resolveParentVisibility` called on all live creates but `@default(LISTED)` masks omissions; `syncDescendantVisibility` has no POST parent type and mis-targets pageId-null children | Funnel creates through one util; add POST parent type to cascade |

---

## Detailed findings

### Cluster 1 — content tree (INV-1, 2, 3, 10, 11)

**INV-1 — Post `parentPostId` XOR `eventId` · UNGUARDED**
The DB CHECK claimed at `prisma/schema.prisma:344` does not exist in any migration (`v03_schema_init` and `v04_schema_migration` add only PK/FKs on `posts`). `posts/route.ts:182–214` validates `eventId` and `parentPostId` *independently*; both flow into the create at `:237–238` with nothing rejecting both-set. `createPost` (`post.ts:132–152`) has the same shape. PATCH never accepts these FKs (`posts/[id]/route.ts:150`), so edits are safe.
- **Bad write:** `POST /api/posts` with `{content, eventId: <own event>, parentPostId: <own post>}` → row with both FKs.
- **Fix home:** DB CHECK on `posts` (matches the schema comment + AccessRequest precedent) + a friendly 400 in `posts/route.ts`.

**INV-2 — Updates cannot nest · CALLER-DISCIPLINE**
Enforced only at `posts/route.ts:205–207`. The shared `createPost` (`post.ts:144–152`) selects `{id}` on the parent with no depth check; it is safe today only because its one caller (`events/[id]/posts/route.ts:72`) never passes `parentPostId`.
- **Bad write:** any future `createPost(userId, {parentPostId: <a child post>, content})` → grandchild.
- **Fix home:** move the depth guard into `createPost`.

**INV-3 — Child post `pageId` sync · UNGUARDED (create and edit)**
Create sets `pageId: pageId || null` from the client payload (`posts/route.ts:236`, `post.ts:160`); the parent's `pageId` is fetched for the permission check (`:200, 208–210`) but never copied to the child. On parent edit, the child cascade (`posts/[id]/route.ts:242–247`) syncs `contentVisibility` only, not `pageId`. PATCH also lets a child be directly re-pointed to any page (`:153–163, 211–217`).
- **Bad writes:** (1) reply omitting pageId → `pageId:null` child under a page parent; (2) move parent page A→B → children keep A; (3) PATCH child to page B while parent on A.
- **Fix home:** server-util guard — derive child `pageId` from parent on create (ignore client value when `parentPostId` set), extend the PATCH cascade to set `pageId`, reject direct `pageId` edits on child posts. **This also closes INV-13 Gap 1/2.**

**INV-10 — Publish gating · posts CALLER-DISCIPLINE / events UNGUARDED**
Post PATCH validates the transition server-side (`posts/[id]/route.ts:224–231`), but the exported `publishPost` util (`post.ts:210–217`) flips DRAFT→PUBLISHED with zero content validation (currently no server callers — a loaded gun). Events are worse: `validateEventUpdateData` only checks the status enum; `events/[id]/route.ts:163` sets `status = PUBLISHED` with no check that stored title/content/location are non-empty. Draft events are created empty (`events/route.ts:128–132`). Public read filters themselves are correct (`events/route.ts:56`, `posts/route.ts:91–93`, etc.).
- **Bad write:** `POST /api/events {isDraft:true}` then `PATCH …{status:"PUBLISHED"}` → empty event publicly listed.
- **Fix home:** `validatePublishable(entity)` in event PATCH before `:163` (mirror the post path); guard or delete `publishPost`. A partial DB backstop is feasible: `CHECK (status = 'DRAFT' OR length(trim(content)) > 0)`.

**INV-11 — Rsvp uniqueness · ENFORCED**
DB unique index `rsvps_eventId_email_key` (`20260323055100_add_event_status_and_rsvp/migration.sql:35`) + the sole write path `createOrUpdateRsvp` upserts on that key (`rsvp.ts:11–32`). Case-insensitivity relies on the util's `.toLowerCase()`; optional hardening = a `lower(email)` functional unique index.

### Cluster 2 — polymorphic XOR (INV-4, 5, 6, 7)

**INV-4 — Follow one-follower/one-followee · CALLER-DISCIPLINE**
No DB CHECK on `follows` (all three migrations read in full: `v03_schema_init`, `v04_schema_migration`, `page_follows`). App writes go through sound mappers — `followEdgeData` (`requests.ts:35–42`) and `materialize` (`requests.ts:203–210`, which inherits the access_requests CHECK) — but nothing forces new code through them.
- **Bad write:** `prisma.follow.create({data:{followerId, followerPageId, followingUserId}})` (or all-null) succeeds from any new call site.
- **Fix home:** migration adding `follows_one_follower` / `follows_one_followee` CHECKs.

**INV-5 — ConversationParticipant one-of · CALLER-DISCIPLINE**
No DB CHECK (`v04_schema_migration:66–77` = indexes + FKs). All writes pass single-key literal objects (`messages/route.ts:114–126`; dead `createConversation` at `message.ts:124–137`). Seed's `{userId: p.userId ?? null, pageId: p.pageId ?? null}` (`seed.ts:817–825`) would write a both-null row if `resolveHandle` ever returned empty.
- **Fix home:** DB CHECK on `conversation_participants`.

**INV-6 — ProfileElement one-of · UNGUARDED (LIVE)**
No DB CHECK. Create paths are compile-time-safe via the `ElementOwner` union. **The update path is a live hole:** `updateProfileElement` (`profile-element.ts:54–74`) does an ownership check, then spreads client-controlled `rest` straight into `prisma.profileElement.update` (`:68–72`). `ElementUpdate` is `{id} & Record<string, unknown>` (`inline-edit.ts:15–17`) and `saveMyProfile` whitelists only the profile `fields`, never element keys — so `userId`/`pageId` pass through.
- **Bad write (works today):** `PUT /api/me/user` body `{"fields":{},"elements":{"update":[{"id":"<own element>","pageId":"<any page>"}]}}` → element with both owners. Variants: `{"userId":null}` orphans it; `{"userId":"<victim>"}` reassigns ownership.
- **Fix home:** whitelist mutable keys (`label/value/caption/url/sortOrder/visible/kind`) inside `updateProfileElement` + DB CHECK. **Highest-priority item in this audit.**

**INV-7 — Handle one-of + lowercase · CALLER-DISCIPLINE (both)**
No DB CHECK; `handles` has plain unique indexes (not partial) — the schema comment at `:274–275` is wrong on both counts (indexes aren't partial, and unique indexes don't enforce mutual exclusion). XOR holds only because every write is a nested `handleRecord: {create}` from the owning entity. Lowercasing is done at the route edges (`signup/route.ts:70`, `pages/route.ts:45`, seed) with `validateHandle` as a route-level backstop; the shared utils explicitly punt ("Caller is responsible for lowercasing" — `user.ts:147`, `signup-invite.ts:50`, `page.ts:96`). No handle-rename path currently exists.
- **Bad write:** a future rename endpoint or admin script calling `createUser({handle:"FooBar"})` stores mixed case → row permanently unreachable at `/[handle]` (lookups lowercase) and `isHandleTaken` misses it, allowing a colliding twin. Raw `handle.create` with both FKs violates XOR.
- **Fix home:** lowercase inside the shared utils; migration adding `CHECK (handle = lower(handle))` + exactly-one CHECK.

### Cluster 3 — authz / identity (INV-8, 9, 12)

**INV-8 — Page-authored content needs ADMIN/EDITOR · CALLER-DISCIPLINE**
Every live HTTP path calls `canPostAsPage` before the write — create (`posts/route.ts:174–179`, `events/route.ts:113–118`) and author-switch PATCH, including page→page moves (`posts/[id]/route.ts:153–158`, `events/[id]/route.ts:101–106`). But the checks live per-route, not structurally: `createPost` (`post.ts:123`, writes `pageId` at `:160`) and `createDraftPost` (`post.ts:192`) accept `pageId` with **no** `canPostAsPage` call, and `publishPost` (`post.ts:210`) has no auth at all. `createDraftPost`/`publishPost` currently have zero callers.
- **Bad write (latent):** any refactor calling `createPost(userId, {pageId:X, content})` where the user lacks permission on X → page-authored post created silently.
- **Fix home:** move `canPostAsPage` inside `createPost`/`createDraftPost`, or delete the unused utils and make `createPost` reject `pageId` (its one caller never passes it).

**INV-9 — Page create atomic auto-permission · ENFORCED**
`createPage` (`page.ts:103–141`) is the only app `page.create` site; `tx.page.create` (with nested Handle) and `tx.permission.create({role: ADMIN})` sit in one `$transaction` (`:114–140`). No orphan page possible. (Dev `seed.ts:434–508` does these non-transactionally — acceptable, dev-only.)

**INV-12 — emailVerified + tokenVersion · ENFORCED (all three legs)**
(a) `authorize` throws `EmailNotVerifiedError` when `!user.emailVerified` (`auth.ts:47–49`); it's the only provider. (b) Session callback re-reads `tokenVersion` per request and refuses to set `session.user.id` on mismatch (`auth.ts:85–92`), which every route inherits via `getSessionContext` (`session.ts:28–36`). (c) Reset increments `tokenVersion` in the same single `user.update` as the password swap (`reset-password/route.ts:49–52`).
- **Nuance (not a break):** the reset token is consumed in a transaction that commits *before* the password update (`auth-tokens.ts:149–155` then `route.ts:49`); a crash in between burns the single-use token without changing the password — an availability annoyance, not a security hole. Optional fix: fold the password update into `consumeUserToken`'s `onConsume` hook, as the email-verify flow already does (`auth-tokens.ts:130–132`).

### Cluster 4 — visibility integrity (INV-13)

**`resolveParentVisibility` (visibility.ts:377–397) · CALLER-DISCIPLINE**
Called on all five live create paths (`posts/route.ts:244`, `post.ts:154`, `post.ts:193`, `events/route.ts:134`, `events/route.ts:206`), but there is no structural funnel: two parallel post-create implementations each remember to call it separately, and `contentVisibility @default(LISTED)` (`schema.prisma:105,219,356,399`) silently absorbs any create path that forgets — the exact failure mode behind the 2026-07-03 "born LISTED" finding. Birth-consistency wrinkles: a post with both `pageId` and `eventId` derives from precedence/update-order not state (`visibility.ts:383–394`); a child stored with `pageId:null` is born consistent but becomes unsyncable; re-parent re-derivation ignores `parentPostId` (`posts/[id]/route.ts:214`).

**`syncDescendantVisibility` (visibility.ts:409–457) · UNGUARDED**
All callers are transactional and every parent-mutation route calls *something*, but the helper has **no POST parent type**, so post-parent descendants can't be expressed, and its USER/PAGE branches both miss and mis-target `pageId:null` child posts of page posts.
- **Gap 1 (concrete leak):** page admin creates page post P (LISTED), adds a reply C without pageId (`pageId:null`, born LISTED), then flips the page to PRIVATE via `PUT /api/me/page` → P goes PRIVATE (`visibility.ts:420`) but **C stays LISTED**, and `getPostUpdates` (`post.ts:47–54`) serves it with no visibility filter.
- **Gap 2:** the USER branch `{userId, pageId:null, eventId:null}` (`visibility.ts:436–439`) *includes* those same page-post children, so flipping the author's personal visibility rewrites C too — C's visibility ends up keyed to whichever of {user, page} flipped last.
- **Gap 3:** the only post-parent cascade is the inline `updateMany` at `posts/[id]/route.ts:242–247` — a second implementation outside the visibility module.
- **Fix home:** add a `"POST"` parent type to `syncDescendantVisibility` and route `posts/[id]/route.ts:242` through it; fix the USER/PAGE branch targeting. **Stronger:** enforce child `pageId` = parent `pageId` at write time (INV-3), which makes the existing pageId-keyed cascades complete.
- **Minor:** `processElementsPayload` runs on the global client inside `updateProfileWithCascade` despite the "wrapped by this tx" comment (`profile-update.ts:51–53`) — a rollback wouldn't undo element ops.

---

## Action items

### Priority 1 — live exposure
- **[INV-6] Whitelist mutable keys in `updateProfileElement` (`profile-element.ts:68`).** Exploitable now via `PUT /api/me/user` to reassign, orphan, or double-own a ProfileElement. Add a DB CHECK as backstop.
- **[INV-13 Gap 1] Page→PRIVATE leaves LISTED child replies visible.** Reachable by a normal page admin flipping visibility; `getPostUpdates` serves the stale child unfiltered. Fix via INV-3 (write-time child `pageId`) + POST parent type in the cascade.

### Priority 2 — integrity gaps a normal user can reach
- **[INV-10 events] Empty published events surface publicly.** Add `validatePublishable()` to `events/[id]/route.ts` before `:163`.
- **[INV-3] Child `pageId` desync** on create and on parent/child edit — underlies INV-13; fix at the write util.
- **[INV-1] Post `parentPostId`+`eventId` both settable.** Add the DB CHECK the schema already claims, plus a 400.

### Priority 3 — latent (a future/refactored caller trips these)
- **[INV-4, 5, 7] Add the missing exactly-one DB CHECKs** on `follows`, `conversation_participants`, `handles` (+ `handle = lower(handle)`), matching the `access_requests` precedent. Reconcile the false schema comments.
- **[INV-8, 2, 10 posts] Consolidate the post write utils.** Move `canPostAsPage` and the nest-depth guard into `createPost`; delete or guard the unused `createDraftPost`/`publishPost`. Eliminates the "second divergent write path."
- **[INV-7] Lowercase handles inside the shared utils** rather than trusting each route.

### Optional hardening
- **[INV-11]** `lower(email)` functional unique index on `rsvps`.
- **[INV-12]** Fold the password reset into the token-consume transaction to close the burned-token window.

---

## Cross-cutting themes

1. **Aspirational schema comments.** Five "DB CHECK" / "mutually exclusive via constraint" comments describe constraints that were never migrated. Either add the constraints or correct the comments — right now they read as guarantees that don't exist.
2. **`@default(LISTED)` hides forgotten derivations.** Because a forgotten `resolveParentVisibility` yields LISTED rather than an error, visibility bugs fail *open* and silently. Consider dropping the default so a missed derivation fails loudly.
3. **Decisions are funneled; writes are not.** Authorization *checks* route through `permission.ts`, but the *writes* they protect live in multiple places (inline route creates + `post.ts` utils). A single write util per entity — the pattern `event.ts:87–90` already adopted — would convert most CALLER-DISCIPLINE rows to ENFORCED.
4. **DB constraints are the durable home for the polymorphic XOR family.** INV-1/4/5/6/7 are all "exactly one of these columns" invariants that Postgres CHECKs express cleanly and cheaply; the `access_requests` migration is the working template.

*Out of scope (not addressed here): fixing anything; visibility access-control leaks beyond INV-13's integrity angle; performance.*
