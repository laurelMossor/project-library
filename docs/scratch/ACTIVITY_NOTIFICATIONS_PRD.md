# Activity Notifications — PRD

**Status:** Aligned, ready to plan. Ticket → In progress. ([ProLib ticket](https://app.notion.com/p/379453d029b081239c83fdb6ae1a39a4) — P0, NETWERK.)
**Milestone:** Netwerk Release (social/communication infrastructure).
**Created:** 2026-06-08 · **Reconciled with the live codebase:** 2026-07-20.

> This PRD was originally written before comments landed, before the `emitActivity` seam
> existed, and before the current email module. The 2026-07-20 pass reconciled it with what's
> actually in the code and with the v0.4 scope decisions below. Once we're settled on it, the
> file-by-file build sequence gets written separately as a Claude plan — this doc stays at the
> what/why/scope altitude.

---

## Why this is a separate ticket

The original email ticket conflated two genuinely different things:

| | Transactional / auth (**Email Foundation**) | Activity notifications (**this ticket**) |
|---|---|---|
| Triggered by | a token request (verify, reset) | a domain event (comment, follow, RSVP…) |
| In-app bell entry? | No | **Yes** |
| Respects user preferences? | **Never** (can't opt out of a password reset) | Yes (eventually — see scope) |
| Recipient | the one person who asked | resolved from the event (owner, managers, host…) |
| Channels | email only | in-app (now) + email (later ticket) |

The Email Foundation ticket already shipped the low-level **sender service** ([`src/lib/utils/server/email/`](../../src/lib/utils/server/email/) — `sendEmail`) and proved it with verify/reset. This ticket builds the **notification layer**: persistence, a dispatcher, the in-app bell.

---

## The key reconciliation — the dispatcher already exists

The most important thing to know before building: **we are not writing the dispatcher from scratch.** The seam already exists in the codebase and is already wired into every trigger site in scope.

[`src/lib/utils/server/activity.ts`](../../src/lib/utils/server/activity.ts) defines `emitActivity(action, actor, target)` — today a no-op that only logs — and it's already called from:

| Call site | `action` | `target` |
|---|---|---|
| [`requests.ts`](../../src/lib/utils/server/requests.ts) | `follow.created`, `follow.requested` | the followed/requested profile |
| [`requests.ts`](../../src/lib/utils/server/requests.ts) | `membership.joined`, `membership.requested` | the joined/requested page |
| [`comment.ts`](../../src/lib/utils/server/comment.ts) | `comment.created` | the content owner (already suppresses self-notify) |

**This ticket evolves `emitActivity` into the real dispatcher.** Two consequences that override the original PRD's design:

1. **Recipients are resolved *inside* the dispatcher, not by the caller.** The original `notify({ recipients })` shape had callers pre-resolve. Reality is cleaner: callers already pass a `target` `EntityRef` (`{ type: "USER" | "PAGE", id }`), and the dispatcher turns that into recipient user IDs — including the page → ADMIN/EDITOR fan-out. The fan-out rule lives in one place; callers stay dumb.
2. **The type set follows the live call sites, not the original "message + reminder."** Comments (which now drive this) didn't exist when the PRD was written.

---

## Goal

A single dispatcher that downstream features hook into (`emitActivity`) instead of writing bell state or calling the email client directly. Persist a `Notification` row per (recipient, event) so the in-app bell — and a future email channel — read from **one source of truth**.

```
domain event → resolve recipients → filter by preferences → fan out to channels → persist + deliver
```

---

## In scope (v0.4)

1. **`Notification` model + `NotificationType` enum.** Per-**user** rows (recipient is always a User); page-directed activity fans out to one row per ADMIN/EDITOR user, mirroring the messaging access model. Carries: recipient, type, actor (who caused it), subject (what it's about, for the deep link), `readAt`, `createdAt`. **Additive migration — no changes to existing `User`/`Page` columns** (see the no-preferences decision), so none of the prod-cutover risk the visibility rename carries.

2. **Dispatcher** — evolve `emitActivity(action, actor, target, subject?)`:
   - **Recipient resolution per type**, with the role set keyed to *who can act*: request-type notifications go to those who can approve (**ADMIN only**); informational ones go to all managers (**ADMIN + EDITOR**).
   - **Preference filtering** — a **pass-through no-op seam** for now (see the decision below).
   - **Channel fan-out** — always write a `Notification` row (in-app). The email channel plugs into the same seam in a later ticket; not built here.
   - Dispatch failures log but never break the triggering request.

3. **The six types that ship**, each mapping to an `emitActivity` action:

   | Type | Action | Recipient |
   |---|---|---|
   | `COMMENT` | `comment.created` | content owner (user; or page ADMIN+EDITOR) |
   | `FOLLOW_REQUEST` | `follow.requested` | requested profile (user; or page ADMIN only) |
   | `JOIN_REQUEST` | `membership.requested` | page **ADMIN only** (approval is ADMIN-only) |
   | `NEW_FOLLOWER` | `follow.created` | followed profile (user; or page ADMIN+EDITOR) |
   | `NEW_MEMBER` | `membership.joined` | page ADMIN+EDITOR |
   | `RSVP` | `rsvp.created` | event host (user; or page ADMIN+EDITOR) |

4. **In-app bell** — generalize the existing `UnreadCountContext` polling pattern (60s visibility-gated poll, imperative `notifications:read` refresh). One deliberate simplification vs. messages: the bell is **per-user, not per-active-profile** — page activity is already fanned out to the managing user's own rows, so a single personal bell shows everything and there's no `{ personal, pages }` split. A read/unread API backs it; the UI is a **dropdown** (reuses `NotificationDot`, which already exists). No dedicated `/notifications` page.

5. **Retention policy** — keep all unread + read-for-90-days; the bell reads only the latest ~30 (bounded read is the interim safety). Scheduled enforcement is deferred to the Meatup cron (a one-line `deleteMany` when it lands); no scheduler is built here.

---

## The two wrinkles worth flagging

- **RSVP is the one genuinely new emit.** RSVPs are **anonymous** — `Rsvp` is name + email, no `userId` ([`schema.prisma`](../../prisma/schema.prisma), [`rsvp.ts`](../../src/lib/utils/server/rsvp.ts)) — and nothing emits there today. So the actor is a bare name label (not a User/Page `EntityRef`), and it must fire **create-only**, not on the upsert's update branch, or editing an RSVP re-notifies. *(When authenticated RSVP — `Rsvp.userId`, a filed Meatup follow-up — lands, the actor upgrades from anonymous to a real user for free.)*
- **`JOIN_REQUEST` notifies ADMINs only, not EDITORs** — because request approval is ADMIN-only (`canActOnRequest` in `requests.ts`), so notifying EDITORs is noise they can't act on. This is why the recipient role set is per-type, not a flat "all managers."

---

## Out of scope / deferred

| Deferred item | Where it goes |
|---|---|
| **Preferences** (model + settings UI) | A later ticket. In-app only for now, so a pass-through preference seam in the dispatcher is enough. *(Self-notification suppression is already structural at the emit sites — independent of any preference.)* |
| **Email channel** + its on/off pref | The **Email notifications** ticket (blocked on Resend domain verification). The `Notification` rows written now are its future source data. |
| **Event reminders** (week-before / 2-days-before) + **Vercel Cron** | **Meatup** — they're event-flavored and need net-new scheduler infra. |
| **Messages in the bell** | Stays out — messages keep their own unread rail (per-message `readAt`, the existing dot). The bell is activity-only. |
| Dedicated `/notifications` page; profile-scoped bell | Future, if the single per-user dropdown proves noisy for multi-page managers. |
| Scheduled retention enforcement | Attach to the Meatup cron. |

---

## Design decisions (carry forward)

- **Evolve the seam, don't reinvent.** `emitActivity` is the dispatcher's public face; the 5 existing call sites barely change (the new `subject` param is optional). The original PRD's `notify({ recipients })` signature is **superseded** by resolving recipients inside the dispatcher from the `target` EntityRef.
- **Dispatcher handles activity only.** Transactional auth mail calls `sendEmail` directly and never flows through here.
- **Persist first, deliver second.** The in-app row is the source of truth; email is a derived channel added later at the same seam.
- **Reuse:** in-app delivery generalizes `UnreadCountContext`; page fan-out uses the existing permission helpers (`getResourcePermissions`); actor hydration uses the attribution-only embed selectors (`publicUserEmbedFields` / `publicPageEmbedFields`, per VISIBILITY_RULES §8).
- **Recipient scoping is the whole visibility story.** The recipient is by construction the content owner or a page manager — always entitled to the subject — so no content-visibility gate is needed on the notification itself; the read API just scopes strictly to `session.userId`, and the subject *link* routes through the normal gated route (deleted/hidden subjects 404 as usual).
- **Enum tension, accepted.** `NotificationType` grows by one value per new activity — a bounded, type-safe set, not an open-ended string column. Each new type is "add an enum value + a recipient resolver + a copy string."

---

## Open questions — resolved

- ~~Retention / cleanup policy~~ → 90-day read retention, bounded latest-30 read, scheduled prune deferred to Meatup cron.
- ~~Bell UX: dropdown vs. `/notifications` page~~ → **dropdown**; no page.
- ~~Preferences scope~~ → **none in v0.4**; pass-through seam only.
- ~~Reminder idempotency / digest cadence~~ → **out of scope** (reminders → Meatup; email digests → email ticket).

## Still open (for the build-plan step)

- Actor/subject storage: loose id columns hydrated at read time (leans this way — keeps the migration self-contained, no backref churn on hot models) vs. real FKs. Settle when we write the plan.
- Read semantics: mark-all-read on dropdown open (simplest) vs. per-row read. Leaning mark-all-on-open for MVP.
