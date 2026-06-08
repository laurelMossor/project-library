# Activity Notifications — PRD (Ticket B)

**Status:** Scoped, not started. Depends on **Ticket A (Transactional Email Foundation)** shipping first.
**Milestone:** Netwerk Release (social/communication infrastructure).
**Created:** 2026-06-08

---

## Why this is a separate ticket

The original email ticket conflated two genuinely different things:

| | Transactional / auth (**Ticket A**) | Activity notifications (**this ticket**) |
|---|---|---|
| Triggered by | a token request (verify, reset) | a domain event (message, follow, RSVP…) |
| In-app bell entry? | No | **Yes** |
| Respects user preferences? | **Never** (can't opt out of a password reset) | **Yes** |
| Recipient | the one person who asked | resolved from the event (participants, followers…) |
| Channels | email only | in-app (now) + email digest (later) |

Ticket A builds the low-level **sender service** (`src/lib/email/sendEmail`) and proves it with verify/reset. This ticket builds the **notification layer** on top of it: persistence, a dispatcher, the in-app bell, and preferences.

---

## Goal

A single notification dispatcher that downstream features hook into instead of calling the email client (or writing bell state) directly. Persist notifications to the DB so the in-app bell and future email digests read from **the same source of truth**.

```
domain event → resolve recipients → filter by preferences → fan out to channels → persist + deliver
```

## In scope

1. **`Notification` model** — the spine. One row per (recipient, event). Fields roughly:
   - `userId` (recipient), `type` (enum), `actorId?` (who caused it), `entityType?`/`entityId?` (what it's about), `readAt?`, `createdAt`.
   - Notifications are per-**user**; page-directed activity fans out to the page's ADMIN/EDITOR users (mirrors the messaging access model).
2. **Notification dispatcher** — `notify({ type, recipients, actor, entity })` server util.
   - Recipient resolution per type (e.g. message → conversation participants minus sender; follow → followed user).
   - Preference filtering (see below).
   - Channel fan-out: always write a `Notification` row; **email digest deferred** (see "Deferred within this ticket").
3. **In-app bell** — extend the existing `UnreadCountContext` pattern (60s visibility-gated poll, profile-scoped, `notifications:read` event). The plumbing already exists for unread *messages*; generalize it to notifications. A bell UI surfaces the list; `NotificationDot` already exists.
4. **Preferences** — beta scope is deliberately minimal:
   - Master on/off.
   - "No notifications about my own activity."
   - Store as two booleans on `User` (not a separate model — only two toggles). Verify/reset ignore preferences entirely (they live in Ticket A and never touch this path).
5. **Event reminders** — "a week before" and "2 days before" a published event.
   - Requires a **scheduler**: Vercel Cron → daily API route that scans upcoming events + RSVPs and dispatches reminders. This is net-new infra (not event-driven).
6. **Notification types (this ticket):**
   - Message received (in-app bell only for now).
   - Event reminder (week + 2 days).

## Near-term, next (same model, incremental):

- Follower requests
- Comment notifications
- Event RSVPs (notify the host)

Each is "add an enum value + a recipient resolver + a template" — the dispatcher absorbs them.

## Deferred within this ticket

- **Email digests for messages.** Decision (2026-06-08): in-app bell only for now; no message emails. When added, the clean pattern is a *delayed unread digest* ("you have N unread messages" if unread after ~X min) driven by the same reminders cron — **not** one email per message (spam trap). The `Notification` rows written now become the digest's source data, so nothing is lost by deferring.

---

## Design decisions (carry forward)

- **Dispatcher handles activity only.** Transactional auth mail (Ticket A) calls the sender service directly and never flows through here.
- **Persist first, deliver second.** The in-app row is the source of truth; email is a derived channel.
- **Reuse, don't reinvent:** in-app delivery generalizes `UnreadCountContext`; tokens (if any) follow the `SignupInvite` hash/expiry pattern; the email channel is Ticket A's `sendEmail`.
- **Enum tension noted:** `NotificationType` grows as features are added (each new value is a migration). Acceptable — it's a bounded, type-safe set, not an open-ended string column.

## Open questions for when we pick this up

- Notification retention / cleanup policy (cap rows per user? TTL?).
- Reminder idempotency: how to guarantee a reminder fires exactly once per (event, offset) — a `sent` ledger vs. a query window.
- Digest cadence + the "only if offline / unread after X min" threshold.
- Bell UX: dropdown list vs. dedicated `/notifications` page.
