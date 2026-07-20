# Activity Notifications — Build Spec (v0.4 "Netwerk")

**Status:** Ready to build. Ticket: [Activity Notifications (dispatcher + in-app bell)](https://app.notion.com/p/379453d029b081239c83fdb6ae1a39a4) — P0, NETWERK.
**Supersedes** the design in `docs/scratch/ACTIVITY_NOTIFICATIONS_PRD.md` (2026-06-08), which predates comments, the `emitActivity` seam, and the current email module. Where they disagree, this doc wins.
**Author's aligned scope (2026-07-20):** messages stay on their own rail; ship four notification types; **no preferences in v0.4** (in-app only — a pass-through preference seam is enough); event reminders + cron are OUT (→ Meatup); the email channel is a separate, blocked ticket.

---

## 1. The core reconciliation — the dispatcher already exists

The single most important fact for whoever builds this: **we are not writing `notify()` from scratch.** The seam is already in the codebase and already wired.

[`src/lib/utils/server/activity.ts`](../../src/lib/utils/server/activity.ts) defines `emitActivity(action, actor, target)` — today a no-op that only logs — and it is already called from every trigger site in scope:

| Call site | `action` string | `target` (EntityRef) |
|---|---|---|
| [`requests.ts:92`](../../src/lib/utils/server/requests.ts) | `follow.created` | the followed user/page |
| [`requests.ts:96`](../../src/lib/utils/server/requests.ts) | `follow.requested` | the private profile being requested |
| [`requests.ts:113`](../../src/lib/utils/server/requests.ts) | `membership.joined` | the joined page |
| [`requests.ts:117`](../../src/lib/utils/server/requests.ts) | `membership.requested` | the private page |
| [`comment.ts:74`](../../src/lib/utils/server/comment.ts) | `comment.created` | the content owner (already suppresses self-notify) |

This ticket **evolves `emitActivity` into the real dispatcher.** We keep the public `emitActivity(action, actor, target, subject?)` signature so existing call sites barely change, and we build the persist/resolve/deliver pipeline behind it.

**Two deltas from the PRD, resolved:**

1. **Recipient resolution lives *inside* the dispatcher, not at the call site.** The PRD's `notify({ recipients })` had callers pre-resolve recipients. Reality is cleaner: callers pass a `target` `EntityRef` (`{ type: "USER" | "PAGE", id }`) and the dispatcher resolves it to recipient user IDs — including the page → ADMIN/EDITOR fan-out. Callers stay dumb; the fan-out rule lives in one place.
2. **The type set is different.** The PRD named "message received" + "event reminder" for v0.4. Both are gone from this ticket (messages stay separate per author decision; reminders moved to Meatup). The real v0.4 types map to the live `emitActivity` call sites above, plus one new RSVP emit.

---

## 2. Data model (additive migration — no cutover risk)

Purely additive: one table + one enum, **no changes to `User`/`Page` columns**, so this is a safe `prisma migrate dev` with none of the expand/contract danger the visibility rename carries. Recipient gets a real FK (cascade on user delete); the actor is a loose reference (hydrated at read time, survives actor deletion via `actorLabel`).

```prisma
enum NotificationType {
  COMMENT         // someone commented on your post/event
  FOLLOW_REQUEST  // someone asked to follow your PRIVATE profile/page
  JOIN_REQUEST    // someone asked to join your PRIVATE page
  NEW_FOLLOWER    // someone followed you (public)
  NEW_MEMBER      // someone joined your page (public)
  RSVP            // someone RSVP'd to your event
}

model Notification {
  id        String    @id @default(cuid())
  createdAt DateTime  @default(now())
  readAt    DateTime?

  // Recipient — ALWAYS a User. Page-directed activity fans out to one row per
  // ADMIN/EDITOR user (mirrors the messaging access model). Cascade on delete.
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  type NotificationType

  // Actor — who caused it. Loose reference (no FK): hydrated at read time with the
  // attribution-only embed selectors. Exactly one of the id fields is set for a
  // User/Page actor; actorLabel is the fallback for an anonymous actor (RSVP name),
  // and is also retained as a display fallback if a User/Page actor is later deleted.
  actorUserId String?
  actorPageId String?
  actorLabel  String?

  // Subject — what it's about, for building the deep link + copy. Loose (link routing
  // only, not gated storage): "POST" | "EVENT" | "PAGE" | "USER".
  entityType String?
  entityId   String?

  @@index([userId, readAt])     // unread-count poll + mark-all-read
  @@index([userId, createdAt])  // bell list (newest first)
  @@map("notifications")
}
```

Add the backref to `User` (the only edit to an existing model):

```prisma
// in model User
notifications Notification[]
```

**Why loose (un-FK'd) actor/subject columns.** Adding real relations would mean backref arrays on `User`, `Page`, `Post`, `Event`, `Comment` — churn on five hot models for what is display-only data. Instead the read API batch-hydrates actors through `publicUserEmbedFields` / `publicPageEmbedFields` ([`fields.ts`](../../src/lib/utils/server/fields.ts)), which is the sanctioned attribution-only path (VISIBILITY_RULES §8) and keeps this migration self-contained.

---

## 3. Dispatcher API

Evolve [`activity.ts`](../../src/lib/utils/server/activity.ts). Public signature (superset of today's — the extra param is optional, so the 5 sites compile unchanged and opt into `subject` when useful):

```ts
type ActorRef   = EntityRef | { type: "ANON"; label: string };
type SubjectRef = { type: "POST" | "EVENT" | "PAGE" | "USER"; id: string };

export async function emitActivity(
  action: string,
  actor: ActorRef,
  target: EntityRef,
  subject?: SubjectRef,
): Promise<void>
```

Pipeline (domain event → recipients → filter → channels → persist):

```
emitActivity(action, actor, target, subject)
  1. logAction(action, …)                       // keep the existing structured log
  2. type = ACTION_TO_TYPE[action]              // unknown action → log-only, return (never throw)
  3. recipients = resolveRecipients(type, target)   // → user IDs (page fan-out here)
  4. recipients = recipients.filter(id => !isSelfActor(id, actor))   // belt-and-suspenders
  5. recipients = filterByPreferences(recipients, type)  // PASS-THROUGH no-op seam (later ticket)
  6. for each recipient: deliverInApp(recipient, { type, actor, subject })  // writes a Notification row
     // deliverEmail(...) is the SAME seam, added by the email ticket — not built here
```

Fire-and-forget from the caller's perspective: wrap the pipeline so a dispatch failure logs but never breaks the triggering request (a comment must still succeed if notifying throws). The existing call sites already `emitActivity(...)` without awaiting the result meaningfully — keep that (it returns a settled promise; swallow rejections internally).

### 3.1 Action → type → recipient rules

`resolveRecipients` is a per-type resolver. The **role set differs by whether the recipient can act** on the event: request-type notifications go only to those who can approve (ADMIN); informational ones go to all managers (ADMIN + EDITOR). For a PAGE target, resolve users via `getResourcePermissions(pageId, PAGE)` ([`permission.ts`](../../src/lib/utils/server/permission.ts)) filtered to the role set. For a USER target, the recipient is that user.

| `action` | Type | Target | Recipients |
|---|---|---|---|
| `comment.created` | `COMMENT` | content owner (user or page) | user → self; page → ADMIN+EDITOR |
| `follow.requested` | `FOLLOW_REQUEST` | requested profile | user → self; page → **ADMIN only** |
| `membership.requested` | `JOIN_REQUEST` | requested page | **ADMIN only** (approval is ADMIN-only, per `canActOnRequest`) |
| `follow.created` | `NEW_FOLLOWER` | followed profile | user → self; page → ADMIN+EDITOR |
| `membership.joined` | `NEW_MEMBER` | joined page | ADMIN+EDITOR |
| `rsvp.created` | `RSVP` | event host (user or page) | user → self; page → ADMIN+EDITOR |

Self-suppression is already done structurally at the comment site (`comment.ts:73`) and holds for requests (you can't request to follow yourself). Step 4 is a cheap backstop, not the primary guard.

### 3.2 The RSVP wrinkle (the one genuinely new emit)

RSVPs are **anonymous** — `Rsvp` is `name` + `email`, no `userId` ([`schema.prisma:435`](../../prisma/schema.prisma), [`rsvp.ts`](../../src/lib/utils/server/rsvp.ts)) — and no `emitActivity` call exists there yet. So:

- Add the emit in the RSVP create path (route [`events/[id]/rsvps/route.ts`](../../src/app/api/events/[id]/rsvps/route.ts) after `createOrUpdateRsvp`, or inside the util). It needs the event's host identity, which the route already has via `requireViewableEvent` (`event.userId` / `event.pageId`).
- Actor is `{ type: "ANON", label: rsvp.name }` → stored as `actorLabel`, both `actorUserId`/`actorPageId` null.
- Fire **only on create**, not on every upsert/status change (`createOrUpdateRsvp` upserts) — otherwise editing an RSVP re-notifies. Return a `{ created: boolean }` from the util (upsert can't tell you; do a pre-check or compare `createdAt === updatedAt`) and emit only when created. *(When `Rsvp.userId` lands in Meatup, the actor upgrades from ANON to a real USER EntityRef for free.)*

### 3.3 Subject wiring (small edits to existing sites)

To make bell rows deep-link, pass `subject` where it's cheap:
- `comment.ts` — pass `{ type: post ? "POST" : "EVENT", id }` (the util already knows which via `data.postId`/`data.eventId`).
- `requests.ts` — subject is the requester (so the recipient can click through to who wants in): `{ type: requester.type, id: requester.id }`. Optional for v0.4; the type + actor already carry enough to render copy.
- RSVP — subject `{ type: "EVENT", id }`.

---

## 4. In-app bell (generalize `UnreadCountContext`)

The message-unread plumbing is the template. Clone, don't entangle — messages stay on their own rail.

**One deliberate simplification vs. messages:** the bell is **per-user, not per-active-profile.** Messages split `{ personal, pages }` because a page inbox is a distinct surface. Notifications don't need that: page-directed activity is *already fanned out to the managing user's own rows* in step 3. So a page admin sees the page's comment/RSVP notifications in their single personal bell regardless of which profile is active. Simpler context, simpler API. (Profile-scoped notifications are a clean future extension if the beta finds the single bell noisy for multi-page managers — noted, not built.)

### 4.1 Context — `NotificationContext.tsx`
Mirror [`UnreadCountContext.tsx`](../../src/lib/contexts/UnreadCountContext.tsx):
- 60s visibility-gated poll of the unread count; refresh on login and on a `notifications:read` window event (same imperative-refresh pattern as `messages:read`).
- Shape: `{ unreadCount: number, refresh: () => void }` — no `activePageId` dependency (per §4's per-user decision).
- Mount `NotificationProvider` in [`providers.tsx`](../../src/app/providers.tsx) as a sibling of `UnreadCountProvider`.

### 4.2 API routes (add constants to [`routes.ts`](../../src/lib/const/routes.ts))
| Route | Purpose |
|---|---|
| `GET /api/notifications` | Latest **30**, newest first, actor + subject hydrated; returns `{ items, unreadCount }` |
| `GET /api/notifications/unread-count` | `{ count }` — the cheap poll target |
| `PATCH /api/notifications/read` | Mark all the user's unread as read (`readAt = now()`); returns `{ ok }` |

Constants: `API_NOTIFICATIONS`, `API_NOTIFICATIONS_UNREAD_COUNT`, `API_NOTIFICATIONS_READ`.

**Authorization is trivial but must be exact:** every query scopes `where: { userId: session.userId }` — a user reads/marks only their own rows (VISIBILITY_RULES §10: authorize the id, not the verb). Actor hydration uses the attribution-only embed selectors (§8). No content-visibility gate is needed on the notification itself (the recipient is by construction the content owner or a page manager, i.e. always entitled to the subject); the subject *link* routes through the normal gated route, so deleted/hidden subjects 404 as usual.

### 4.3 Bell UI (dropdown — **not** a `/notifications` page)
- Bell icon in the nav, next to the existing message/profile affordances ([`NavProfileTag.tsx`](../../src/lib/components/nav-bar/NavProfileTag.tsx) is where `useUnreadCount` + `NotificationDot` already live — same neighborhood).
- Overlay [`NotificationDot`](../../src/lib/components/ui/NotificationDot.tsx) when `unreadCount > 0` (reuse as-is; it already has the accessible label).
- Click → `DropdownMenu` panel (the component NavProfileTag already uses) listing the 30 rows: actor avatar (`ProfilePicture`) + one-line copy ("Alice commented on your post", "Portland Makers Guild has a new follower", "Sam RSVP'd to your event") + relative time, each linking to the subject. Compose the copy from `type` + hydrated actor/subject in a small `notificationText()` helper (keep it out of the row component, next to the text utils in [`text.ts`](../../src/lib/utils/text.ts)).
- On open: mark all read (`PATCH …/read`) → dispatch `notifications:read` so the dot clears. Per-row read is unnecessary for MVP.

A dedicated `/notifications` page is explicitly **out of scope** — the dropdown is the whole surface for v0.4.

---

## 5. Preferences — seam only, no model

Per author decision (2026-07-20): notifications are in-app only in v0.4, so **no preference storage ships** — no `User` columns, no settings UI. The dispatcher's `filterByPreferences` step (§3, step 5) exists as a **pass-through no-op** so a later ticket adds the toggle model + UI without touching call sites — exactly how the email channel plugs into the same channel seam. Self-notification suppression is already structural (§3.1) and is independent of any preference. This keeps the PRD's "master on/off" idea alive as a seam while shipping nothing speculative.

Boundary with the **Email notifications ticket** (separate, blocked on Resend domain verification): that ticket owns the email channel *and* its on/off preference. Don't build either here. The `Notification` rows written now are the source data a future email digest reads from — nothing is lost by deferring.

---

## 6. Retention / cleanup

No scheduler is in scope (cron moved to Meatup), so the policy is deliberately low-infra:

- **Read cap is the interim safety.** The bell reads only the latest 30 rows, so unbounded growth never reaches the UI or a query.
- **Policy:** keep all unread notifications + read notifications for **90 days**; older read rows are prunable.
- **Enforcement is deferred** to the Meatup cron (when it lands, add one `deleteMany({ where: { readAt: { not: null, lt: now-90d } } })` call to the daily scan). Ship a documented `pruneReadNotifications(olderThanDays = 90)` util now so the cron is a one-liner later. For beta scale (a small group of real users) this is comfortably sufficient; don't build opportunistic pruning into the read path (adds latency and write contention for no beta-scale benefit).

---

## 7. Build sequence

A follow-up session can execute these in order; each step is independently testable.

1. **Schema** — add `NotificationType` enum + `Notification` model + `User.notifications` backref. `prisma migrate dev` (additive; no prod-cutover concern). Add a `commentWithAuthorFields`-style selector for hydrated notification rows in [`fields.ts`](../../src/lib/utils/server/fields.ts).
2. **Dispatcher** — evolve [`activity.ts`](../../src/lib/utils/server/activity.ts): `ACTION_TO_TYPE` map, `resolveRecipients` (per-type role sets + page fan-out via `getResourcePermissions`), self-drop, pass-through `filterByPreferences`, `deliverInApp` (writes a row). Keep `emitActivity` public; add optional `subject`; make failures swallow-and-log. Unit-test recipient resolution (page → ADMIN+EDITOR; request types → ADMIN only; self dropped).
3. **New/updated emit sites** — add `rsvp.created` (anonymous actor, create-only — §3.2); pass `subject` from `comment.ts` and the RSVP path (§3.3). The four request/follow sites already emit; just confirm they flow through.
4. **Read API** — `GET /api/notifications` (hydrate actor via embed selectors + `unreadCount`), `GET /api/notifications/unread-count`, `PATCH /api/notifications/read`. Route constants. Each scoped to `session.userId`. Route tests: wrong-user gets an empty list / can't mark another user's rows.
5. **Client** — `NotificationContext` + `NotificationProvider` (clone of `UnreadCountContext`, per-user, no active-profile dep); mount in [`providers.tsx`](../../src/app/providers.tsx); bell + dropdown in the nav reusing `DropdownMenu` / `ProfilePicture` / `NotificationDot`; `notificationText()` copy helper.
6. **Verify** — drive the local app: alice comments on sam's post → sam's bell shows 1, dropdown links to the post, opening clears the dot. Request-to-follow a private profile → target's bell. RSVP → host's bell. (Use alice/sam only, never the personal account.)
7. **Docs/ticket** — this spec is the record; add the STATUS line; keep the scratch PRD marked as superseded.

---

## 8. In v0.4 vs. deferred — the line

| In v0.4 (this spec) | Deferred (and to where) |
|---|---|
| `Notification` model + `NotificationType` enum | Email channel + its on/off pref → **Email notifications ticket** (blocked on Resend domain) |
| Dispatcher (evolve `emitActivity`) + per-type recipient resolvers + page fan-out | Event reminders + Vercel Cron → **Meatup** |
| 6 notification types, wired (comment / follow-request / join-request / new-follower / new-member / rsvp) | `pruneReadNotifications` scheduled enforcement → **Meatup cron** |
| Pass-through preference seam (no storage) | Preference model + settings UI → **later ticket** |
| In-app bell: per-user context, read/unread API, dropdown UI | Dedicated `/notifications` page; profile-scoped bell |
| Retention *policy* (90d) + read-cap safety | Authenticated RSVP actor (`Rsvp.userId`) → **Meatup** (upgrades RSVP actor from ANON to USER) |
| Messages **unchanged** — own unread rail | Folding messages into the bell |
