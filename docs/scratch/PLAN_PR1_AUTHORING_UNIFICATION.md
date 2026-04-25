# PR 1 — Authoring Pattern Unification (Code Review)

> Prerequisite work for the Page Microsite (Task 2). Establishes a single consistent pattern for creating and editing Posts, Events, and Page/User profiles.

**Depends on:** nothing — this is the foundation.
**Unblocks:** PR 2 (URL Flattening), PR 3 (Microsite proper).

---

## Goal

Replace the current mix of form-based and inline-edit authoring with one pattern applied everywhere:

> **Draft-then-inline-edit, with batched save.**

1. `/X/new` creates a minimal DRAFT row server-side and immediately redirects to the detail route.
2. The detail route is the single editing surface. Every field is click-to-edit in place.
3. Edits are tracked as dirty state within an `InlineEditSession`. Nothing is persisted until the owner clicks Save in the session's sticky save/cancel bar.
4. Save → one batched `PATCH` with every dirty field. Cancel → revert all dirty fields.
5. Publishing is a separate, deliberate affordance (a Publish button), not implicit in saving.

There is no separate "create form" anywhere in the app.

---

## Motivation

The codebase currently has three different authoring flows, which creates inconsistency and blocks microsite work:

| Resource | Create | Edit | Notes |
|---|---|---|---|
| Event | `/events/new` creates a DRAFT, redirects to `/events/[id]` | Inline editing on `/events/[id]` with per-field Save/Cancel | Good pattern, almost there |
| Post | `/posts/new` is a full 170-line form; submit creates + redirects | `/posts/[id]` is read-only | Two codebases, no inline edit |
| Page (create) | `/pages/new` is a classic form | — | — |
| Page (edit) | — | `/p/profile/edit` is a classic 300-line form PUT-ing `/api/me/page` | Duplicate path |
| User (edit) | — | `/u/profile` uses `ProfileSettingsBase` + inline `EditableProfile` with Edit button | Another duplicate path |

Microsite editing (PR 3) needs one pattern it can extend with PageElement add/edit/delete. It can't live on top of this inconsistency.

---

## Target pattern — detail

### "Draft-then-inline-edit" in concrete terms

```
User clicks "New Post"
    ↓
POST /api/posts { status: DRAFT }   (server-side, from /posts/new route)
    ↓
201 → redirect to /posts/[id]
    ↓
Detail route renders inline-editable fields
    ↓
Owner fills in title, content, tags — each field becomes dirty
    ↓
Sticky "Save / Cancel" bar appears
    ↓
Save → PATCH /api/posts/[id] with all dirty fields in one payload
    ↓
Bar disappears, fields return to view mode
    ↓
Separate "Publish" button flips status to PUBLISHED when the owner is ready
```

Same flow for events (already works this way, needs batched-save refactor) and pages.

### Public visibility of drafts

- Posts with `status: DRAFT` are hidden from all public collection queries (`getPostsByPage`, `getPostsByUser`, explore feeds). Only the author can see them, on their own profile and on the draft's detail route.
- This matches how Events already work (`EventStatus.DRAFT` hidden from public views).
- User/Page profiles don't need a DRAFT concept — they're always visible once the user/page exists. The `/pages/new` flow creates the Page row with empty-ish defaults and redirects; there is no interstitial "create then edit."

---

## Schema changes

### `Post.status` (new)

```prisma
enum PostStatus {
  DRAFT
  PUBLISHED
}

model Post {
  // ...existing fields...
  status PostStatus @default(DRAFT)
  // ...
}
```

Migration: add column with default `DRAFT`, **then** backfill existing rows to `PUBLISHED` (since every existing post is already considered published). This order is important to avoid a window where every existing post becomes a draft.

Public queries in `lib/utils/server/post.ts` (`getPostsByPage`, `getPostsByUser`, `getPostsByEvent`, any explore queries) filter on `status: PUBLISHED`. Owner-scoped queries (on your own profile) return both draft and published — same convention as Event.

No other schema changes in PR 1.

---

## New primitive — `InlineEditSession`

The batched-save pattern needs a new abstraction layered on top of the existing `InlineEditable`.

### Shape

```tsx
// Provider
<InlineEditSession
  resource={event}
  onSave={async (patch) => updateEvent(event.id, patch)}
  onSaved={(updated) => setEvent(updated)}
  canEdit={isOwner}
>
  {/* fields register themselves via context */}
  <InlineEditable fieldName="title" ... />
  <InlineEditable fieldName="content" ... />
  <InlineEditable fieldName="location" ... />

  {/* the sticky bar renders itself when dirtyCount > 0 */}
</InlineEditSession>
```

### What the session owns

- `dirtyFields: Record<string, unknown>` — a map of fieldName → new value
- `saving: boolean`, `error: string | null`
- `saveAll()` — builds the patch, calls `onSave`, resets dirty on success
- `cancelAll()` — clears all dirty state, triggers each field to revert
- Global `Escape` key handler → calls `cancelAll` (confirm if dirty)
- `beforeunload` handler when dirty → browser "unsaved changes" prompt

### What `InlineEditable` becomes

After the refactor, `InlineEditable` is a thin field-level wrapper:

- Tracks its own local view/edit state (click to open, Escape to close per-field)
- Holds its own pending value
- **On value change, pushes into `session.dirtyFields[fieldName]`** via context
- No longer renders per-field Save/Cancel buttons
- No longer calls a per-field `onSave`
- Still renders the `canEdit` hover affordance and per-field edit UI

One save button, one cancel button, one sticky bar per session. The primitive is reusable for User profiles, Page profiles, Event detail, Post detail, and Microsite elements (PR 3).

### The sticky save/cancel bar

A separate component `<InlineEditSessionBar />` rendered inside the provider, auto-hidden when `dirtyCount === 0`. Fixed position at the bottom of the viewport, above content, with a translucent backdrop. Shows:

```
  [N] unsaved changes     [Cancel]  [Save]
```

During save: Save button → "Saving…", disabled. On error: inline error text above the bar. On success: bar animates out, fields return to view mode.

Craft note: the bar is the only persistent chrome introduced by editing. It should feel like a notebook margin note, not a banner ad. Warm background, subtle top border, matches the existing `moss-green` / `rich-brown` palette.

---

## File-by-file changes

### New files

- `src/lib/components/inline-editable/InlineEditSession.tsx` — provider + context
- `src/lib/components/inline-editable/InlineEditSessionBar.tsx` — sticky save/cancel UI
- `src/lib/hooks/useInlineEditSession.ts` — consumer hook

### Modified files

**Inline editing primitive:**
- `src/lib/components/inline-editable/InlineEditable.tsx` — drop Save/Cancel buttons, register with session context on value change
- `src/lib/components/inline-editable/TagInputField.tsx` — no change (already a controlled input)

**Post:**
- `prisma/schema.prisma` — add `PostStatus` enum, `Post.status` field
- `prisma/migrations/…_add_post_status.sql` — column + backfill
- `src/lib/utils/server/post.ts` — all public queries filter `status: PUBLISHED`; add `createDraftPost()` helper
- `src/lib/utils/server/fields.ts` — add `status` to `postCollectionFields` for owner views
- `src/app/api/posts/route.ts` — `POST` creates DRAFT by default
- `src/app/api/posts/[id]/route.ts` — `PATCH` accepts a batch of fields; new `POST /api/posts/[id]/publish` action
- `src/app/posts/new/page.tsx` — **shrink to ~10 lines.** Server action calls `createDraftPost()`, redirects to `/posts/[id]`
- `src/app/posts/[id]/page.tsx` — rewrite as inline-edit surface wrapped in `InlineEditSession`
- `src/lib/components/post/EditPostForm.tsx` — **delete**
- `src/lib/components/post/PostPageClient.tsx` (new) — analogous to `EventPageClient`, owns inline edit state for a post

**Event:**
- `src/lib/components/event/EventPageClient.tsx` — refactor per-field save into `InlineEditSession`. No functional change for users, just removes the per-field Save/Cancel buttons.
- `src/lib/utils/event-client.ts` — `updateEvent()` signature already accepts a partial patch; no change needed.

**Page (profile):**
- `src/app/pages/new/page.tsx` — shrink to ~10 lines, server action creates the Page and redirects
- `src/app/p/profile/edit/page.tsx` — **delete** the edit form entirely
- `src/app/p/[slug]/page.tsx` — wrap the owner-view in `InlineEditSession`, pass `canEdit` computed from `canManagePage`
- `src/lib/components/profile/ProfileBody.tsx` — each field wrapped in `InlineEditable`, registered with session
- `src/lib/components/profile/ProfileHeader.tsx` — name, headline wrapped in `InlineEditable`
- `src/lib/components/profile/profile-settings/ProfileSettingsBase.tsx` — **keep**, but remove:
  - The `onEditClick` / `isEditing` props
  - The second `SettingsSection` (Profile Information) block entirely
  - The "Edit Profile" button in the first settings section
- `src/app/p/profile/PageProfileSettingsContent.tsx` — remove its inline profile-edit pass-through

**User (profile):**
- `src/app/u/profile/page.tsx` — similar treatment; inline editing on the public view when the owner is logged in
- `src/app/u/profile/edit/page.tsx` — **delete** if it exists (or shrink to a redirect back to public profile)
- `src/app/u/[username]/page.tsx` — wrap owner view in `InlineEditSession`

### Files that do not change

- `src/lib/utils/server/permission.ts` — `canManagePage` etc. already correct
- `src/lib/contexts/ActiveProfileContext.tsx` — identity layer stays as-is
- Avatar upload (already a modal, stays as-is; outside the session)

---

## Task breakdown (sequenced)

1. **Add `PostStatus` + migration.** Backfill all existing rows to PUBLISHED. Tests: `getPostsByPage` returns only published for public callers, returns both for owner.
2. **Build `InlineEditSession` + `InlineEditSessionBar`.** Pure primitives, unit tests, no wiring yet.
3. **Refactor `InlineEditable`** to register with session context. Drop its own Save/Cancel. Existing Event page tests should still pass.
4. **Refactor `EventPageClient`** to use the session. Regression test: editing title, content, location, tags, date in the same "session" batches into one PATCH.
5. **Rewrite `/posts/new`** as a server action. Delete `EditPostForm`.
6. **Rewrite `/posts/[id]`** as the single post surface with `InlineEditSession`. Adds Publish button. Owner sees draft + published, visitors see only published.
7. **Rewrite `/pages/new`** as a server action; delete `/p/profile/edit`.
8. **Wrap `/p/[slug]` in session** when viewed by owner. Update `ProfileBody` / `ProfileHeader` fields to be inline-editable. Delete profile-edit form refs from `ProfileSettingsBase`.
9. **Same treatment for `/u/[username]`** and any user-profile-edit route.
10. **Update tests** — Playwright E2E for post authoring via drafts, page profile inline editing, event inline editing batched save.

Each step should be independently green before moving on.

---

## Out of scope for PR 1

- Renaming or reshaping any field (bio stays bio, headline stays headline) — visual relabels happen in PR 3.
- Adding new fields to Page (`aboutContent`, `category`, etc.) — PR 3.
- URL pattern changes (`/u/`, `/p/`) — PR 2.
- PageElement table — PR 3.
- Any new element kinds — PR 3.
- Any rich-text editing — PR 3.

---

## Risks / open questions

- **Batched-save diff correctness.** The session must track dirty fields accurately. Risk: a user edits a field, reverts it to the original value, the field is still marked dirty. Mitigation: compare against a snapshot of the original value on register; if current value deep-equals original, clear dirty for that field.
- **Error recovery.** If Save fails, the session stays dirty. The bar shows an error message and the fields stay in edit state. The user can retry or cancel. Confirm with the user whether fields should also show per-field error if the server rejects a specific one (probably not for MVP).
- **Navigation guards.** If the user has dirty fields and clicks a link, they lose data. Mitigation: `beforeunload` for full navigations; for in-app navigation, either a Next.js route guard or deliberately unmount the session on navigation. Simplest MVP: `beforeunload` only.
- **Concurrency.** If two owners of a Page edit simultaneously, last-write-wins. Acceptable for MVP. Flag for later if it becomes a real problem.
- **Publish-while-dirty?** If a Post is dirty and the user clicks Publish, what happens? My vote: Publish is disabled while dirty. User must Save first. This keeps the state machine simple.
