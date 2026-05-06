# PR 3 — Profile Microsite (SPATS Task 2 + 2a)

> Composable `ProfileElement`s on public profiles (User and Page), an About subpage, and a synthetic About card in the collection. Implements most of `docs/scratch/PAGE_MICROSITE_PRD.md` at MVP scope — extended to cover both entity types.

**Depends on:**
- PR 1 — `InlineEditSession` primitive, inline-editable profile fields, no more form-based edit routes.
- PR 2 — flat `/[handle]` routing. All URLs below assume this has landed.

**Unblocks:** SPATS Launch milestone completion (Task 2 + 2a).

---

## Goal

Turn profiles from "a data row" into "a microsite" by adding:

1. **Composable `ProfileElement`s** — a defined set of blocks (social links, CTA, text) that both Users and Page admins can add, edit, and remove on their public profile.
2. **About subpage** — a longform markdown body at `/[handle]/about`, the only subpage kind.
3. **Synthetic About card** — the About surfaces in the profile's collection alongside posts and events when it has content, linking to the subpage.
4. **Structural field touch-ups** — `bio` becomes a short tagline (no "About" heading), Page `parentTopic` renames to `category`.

All editing happens inline on the public profile using `InlineEditSession` from PR 1. No separate editor route.

**Scope change from the original draft:** Profile elements and the About subpage apply to **both User and Page profiles**, not just Pages. The schema, components, and API routes are designed for both from the start.

---

## Guiding principles

- **The profile IS the microsite, and the profile IS the editor.** There's no secondary "manage your microsite" route.
- **Prescribed, not open-ended.** About is the only subpage kind. Element kinds come from a fixed list. No custom fields, no custom subdomains, no theming.
- **MVP rings the bell.** Ship a small set of element kinds that cover 80% of real profile shapes. Everything in PRD P1/P2 is deferred.
- **Warm like a notebook, not like a CMS.** Editing affordances appear on hover, disappear when not needed. The save bar is the only persistent chrome.
- **One permission model.** For Pages: if you have ADMIN access via `canManagePage()`, you can edit the profile. Period. No owner vs. editor distinction for microsite features. For Users: you edit your own profile.

---

## Schema changes

### User table additions

```prisma
model User {
  // ...existing fields...

  // Longform "about me" markdown body. Null means no About page.
  aboutContent String?

  // ...
  elements ProfileElement[]
}
```

### Page table additions

```prisma
model Page {
  // ...existing fields...

  // Renamed from parentTopic (PRD: "category powers directory filtering")
  category String?

  // Longform "about me" markdown body. Null means no About page.
  aboutContent String?

  // ...
  elements ProfileElement[]
}
```

Migration steps, in order:

1. Add `aboutContent String?` to both `User` and `Page` (nullable default).
2. Rename `parentTopic` → `category` on `Page` (Prisma migration `renameColumn`). No data transformation — it's a simple rename.
3. Add the `ProfileElement` model and relations.

**`parentTopic` → `category` propagation** — the rename touches these files:

| File | What changes |
|---|---|
| `prisma/schema.prisma` | Field rename |
| `src/app/api/me/page/route.ts` | 3 references in PUT/PATCH body parsing |
| `src/lib/types/page.ts` | `PublicPage` type field |
| `src/lib/validations.ts` | `validatePageData` / `validatePageUpdateData` |
| `src/lib/utils/server/page.ts` | `pageFields` selector |
| `src/lib/utils/server/permission.ts` | `getPagesForUser` selector |

`bio` is **not** dropped. In PR 3 it is visually relabeled as "tagline" in the edit UI and no longer rendered under an "About" heading in `ProfileBody`. The field name in the schema stays `bio` to avoid a disruptive rename.

### New model — `ProfileElement`

```prisma
enum ProfileElementKind {
  SOCIAL_LINK
  CTA
  TEXT
}

model ProfileElement {
  id        String             @id @default(cuid())
  kind      ProfileElementKind

  // Polymorphic ownership — exactly one must be set
  userId    String?
  pageId    String?

  label     String?
  value     String
  caption   String?
  url       String?
  sortOrder Int
  visible   Boolean            @default(true)

  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt

  user      User?              @relation(fields: [userId], references: [id], onDelete: Cascade)
  page      Page?              @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([userId, sortOrder])
  @@index([pageId, sortOrder])
  @@map("profile_elements")
}
```

Design notes:

- **Polymorphic ownership** follows the same pattern as `Follow` (mutually exclusive nullable FKs). Exactly one of `userId` or `pageId` is set.
- `sortOrder` is `Int`, compacted 0..N on any ordering change. Element counts per profile are small (< ~30 expected).
- `visible` allows hiding without deleting. Not exposed in MVP UI — schema-first, UI-second.
- Cardinality (e.g. "one CTA max") enforced in application code, not in the schema. The Add UI prevents adding a second CTA rather than letting it be inserted and then rejected.
- No type-specific columns. Per-kind validation and rendering lives in code: `label`/`value`/`caption`/`url` cover every kind's data needs for MVP.

### MVP element kinds

| Kind | What it's for | `label` usage | `value` usage | `caption` usage | `url` usage |
|---|---|---|---|---|---|
| `SOCIAL_LINK` | Instagram, website, Bandcamp, etc. | Auto-derived from URL domain at render time (e.g. "Instagram"). Not user-editable in MVP. | The URL itself (also stored in `url` for consistency). | — | The link target. |
| `CTA` | "Book now", "Join the newsletter", "Open house Saturday" | The headline ("Now Booking") | The body ("Booking open for July") | The fine print ("Waitlist open for August") | Optional link target. |
| `TEXT` | Hours, pronouns, rates, accessibility notes, studio rules, one-off things | Optional custom heading ("Studio Hours") | The text content ("Wed-Sat 11-7") | Optional supporting text | Optional. |

Dropped from PRD P0 for MVP:

- `SCHEDULE` — covered by `TEXT` with a "Studio Hours" label. Promote later if usage justifies structured hours.
- All P1/P2 kinds (`banner_image`, `tags`, `gallery_image`, `date`, `members`, `affiliation`).

---

## InlineEditSession extension

PR 3 requires the session to handle more than flat scalar field patches. This section describes changes to `InlineEditSession` that affect ALL inline-editable resources (profiles, events, posts), not just microsite features. These changes land first and are then consumed by the profile element work.

### Blur behavior fix

**Current problem:** When a user edits a field and then clicks away (Escape or clicking another field), the edit UI closes and the display reverts to the original value — even though the edit IS still held in `dirtyFields`. This makes it look like the edit was lost.

**Desired behavior:** When you click out of an editing field, the edit UI closes, the dirty value stays in the session, and the **display shows the pending edit** (not the original). The user can edit multiple fields, see all their pending changes reflected, and then Save or Cancel.

**Implementation approach:**

1. `InlineEditable` gets a `commitOnBlur` behavior: when the user clicks outside or another field opens, the current field closes but dirty state persists. (This is already mechanically true — `onCancel` doesn't call `clearDirty`. The issue is visual.)

2. Each field's `displayContent` reads from dirty state when available. The `*ProfileClient` components change their display rendering from:
   ```tsx
   // Before: always shows original
   displayContent={<p>{page.headline}</p>}
   ```
   to:
   ```tsx
   // After: shows dirty value if pending, otherwise original
   displayContent={<p>{(dirtyFields.headline as string) ?? page.headline}</p>}
   ```

3. This is a rendering change in `PageProfileClient`, `UserProfileClient`, `EventPageClient`, and `PostPageClient`. No changes to `InlineEditSession` or `InlineEditable` themselves for this fix.

### Element operation tracking

The session gains three new pieces of state for tracking element-level operations:

```typescript
// New state in InlineEditSessionContextType
pendingCreates: ElementDraft[];     // new elements, client-side only until Save
pendingDeletes: string[];           // IDs of existing elements marked for deletion

// New methods
addCreate: (draft: ElementDraft) => void;
removeCreate: (tempId: string) => void;
updateCreate: (tempId: string, field: string, value: unknown) => void;
markDeleted: (elementId: string) => void;
unmarkDeleted: (elementId: string) => void;
```

Element edits (updates to existing elements) use the existing `setDirty` with namespaced keys: `setDirty("element:abc123:label", "New label", originalLabel)`. The session doesn't need to interpret these — the `onSave` handler parses them.

### Structured save payload

`onSave` changes from `(patch: Partial<T>) => Promise<T | void>` to:

```typescript
type SavePayload = {
  fields: Record<string, unknown>;
  elements?: {
    create?: ElementCreate[];
    update?: Array<{ id: string } & Record<string, unknown>>;
    delete?: string[];
  };
};

onSave: (payload: SavePayload) => Promise<T | void>;
```

`saveAll()` constructs this payload by:
1. Collecting scalar `dirtyFields` into `fields`
2. Extracting element-namespaced dirty fields (`element:*:*`) and grouping by element ID into `elements.update`
3. Mapping `pendingCreates` into `elements.create`
4. Copying `pendingDeletes` into `elements.delete`

**Migration of existing callers:** All `onSave` handlers (`PageProfileClient`, `UserProfileClient`, `EventPageClient`, `PostPageClient`) update from `onSave(patch)` to `onSave({ fields, elements? })`. For resources that don't have elements yet (events, posts), the handler reads `payload.fields` and ignores `payload.elements`. This is backward-compatible in behavior — just a shape change.

### Save bar change count

The save bar's `dirtyCount` becomes a unified count:

```
changeCount = Object.keys(dirtyFields).length
            + pendingCreates.length
            + pendingDeletes.length
```

This replaces the current `dirtyCount` and makes the bar count "every kind of pending change equally."

### Undo on the save bar

The save/cancel bar gains an **Undo** button, visible only when there are pending deletes. Clicking Undo reverts the most recent `markDeleted` call (stack-based, most recent first). The bar layout:

```
  3 unsaved changes       [Undo]  [Cancel]  [Save]
```

- **Undo** — pops the last pending delete, un-greys the element. Disappears when `pendingDeletes` is empty.
- **Cancel** — reverts everything (all dirty fields, all creates, all deletes).
- **Save** — commits everything in one request.

---

## Batch PATCH endpoints

Each profile type gets a batch PATCH endpoint that accepts the structured payload from `InlineEditSession`:

### `PATCH /api/pages/[id]` (existing route, extended)

Request body:
```json
{
  "fields": { "name": "New Name", "headline": "..." },
  "elements": {
    "create": [{ "kind": "SOCIAL_LINK", "value": "https://...", "url": "https://...", "sortOrder": 0 }],
    "update": [{ "id": "elem123", "label": "Updated" }],
    "delete": ["elem456"]
  }
}
```

Server-side:
1. Validate caller has `canManagePage()` for the page.
2. Apply `fields` as a Prisma `update` on the Page.
3. Process `elements.create` as `ProfileElement.createMany` with `pageId`.
4. Process `elements.update` as individual `ProfileElement.update` calls (verify each element belongs to this page).
5. Process `elements.delete` as `ProfileElement.deleteMany` (verify ownership).
6. Wrap in a transaction.
7. Return the updated Page with elements.

### `PUT /api/me/user` (existing route, extended)

Same structure, but `userId` is read from session. Same transactional pattern.

### Future: events and posts

The `SavePayload` shape is designed to work when events and posts gain their own element-like features. For now, their `onSave` handlers receive `{ fields: {...} }` with no `elements` key and process `fields` exactly as they do today.

---

## Rendering

### Profile body as container (`ProfileBody`)

`ProfileBody` becomes the container for all profile content between the header and the collection. Rendering order, top to bottom:

```
ProfileHeader          [avatar, name, handle, category badge (Page only)]
  |
ProfileBody            [tagline (was bio), location, interests, tags (Page),
                        address (Page), "open to collaborators" badge (Page),
                        FollowStats,
                        ProfileElementList]
  |
ProfileCollectionSection  [synthetic About card, then pinned items,
                           then the rest of the collection]
```

`ProfileBody` renders `ProfileElementList` at the end, after FollowStats and Page-specific fields. The element list is the same component for both User and Page profiles — it receives `elements[]` and checks for `InlineEditSession` context to decide whether to show edit affordances.

### Owner vs. viewer rendering

Both User and Page profiles have two rendering paths in `/[handle]/page.tsx`:

- **Can-edit path:** `UserProfileClient` or `PageProfileClient` wraps everything in `InlineEditSession`. All fields and elements are editable. For Pages, "can edit" = `canManagePage()` (ADMIN role). For Users, "can edit" = viewing your own profile.
- **Viewer path:** `ProfileHeader` + `ProfileBody` + `ProfileCollectionSection` rendered read-only. Elements display but have no edit affordances.

Both paths render the same `ProfileElementList` component. In the can-edit path, the component detects the session context and shows edit UI. In the viewer path, it renders read-only.

### About subpage (`/[handle]/about/page.tsx`)

A new server component. Same `CenteredLayout` as existing routes. Works for both User and Page profiles.

```
  <- Back to [Profile name]

  [Avatar + name]  (quiet, small)

  # Markdown body
  rendered from aboutContent, or "Write about yourself/your page"
  placeholder if empty and the viewer can edit
```

When the viewer can edit, the markdown body is a single `InlineEditable` registered with an `InlineEditSession`. Edit mode swaps the rendered markdown for a plain textarea. Save -> `PATCH /api/profiles/[type]/[id]/about` -> back to rendered mode.

The About subpage has its **own API route** rather than piggybacking on the profile PATCH. It's its own route, its own rendering context, and its own `InlineEditSession` instance — separate from the profile page's session. The endpoint accepts `{ aboutContent: string }` and returns the updated entity.

When the viewer cannot edit and `aboutContent` is empty or null, the route 404s.

### `ProfileElement` rendering (per kind)

Visual consistency across all kinds: same card spacing, same border weight, same hover affordance. Differences are internal layout only.

- **SOCIAL_LINK** — icon (from domain) + display handle/URL + arrow. Clicking anywhere opens the URL in a new tab.
- **CTA** — a distinctive highlighted block: `label` as a small uppercase eyebrow, `value` as a prominent headline, `caption` as subtle supporting text, a single button if `url` is set.
- **TEXT** — `label` (if present) as a small heading, `value` as body text, `caption` as muted supporting text below. Quiet, notebook-like.

All three use the same outer card container so the list reads as one vocabulary.

**Deleted elements** render with reduced opacity and a light grey overlay to indicate they will be removed on save. They are not interactive — clicking them does nothing. The Undo button on the save bar reverts the most recent deletion.

### Synthetic About card in the collection

New card kind: `ABOUT`. Renders in the same grid/list slot as post and event cards.

```
[About card]
  "About [Profile name]"
  first ~200 chars of aboutContent (plain-text excerpt)
  "Read more ->"
```

Links to `/[handle]/about`. Rendered first in the collection list (prepended before posts/events). Not sortable, not pinnable — its position is fixed.

Implementation: `ProfileCollectionSection` accepts `prependCards`. The route loader checks `aboutContent` and prepends a synthetic descriptor:

```ts
const prependCards = entity.aboutContent
  ? [{ kind: "ABOUT" as const, handle: entity.handle, excerpt: excerpt(entity.aboutContent, 200) }]
  : [];
```

`CollectionCard` (or its parent renderer) adds an `ABOUT` branch alongside the existing `POST` and `EVENT` branches.

---

## Editing UX

### "+ Add to page" button

A single button appearing at the end of `ProfileElementList` when the viewer can edit. Visual: same warm border style as other edit affordances, plus icon, label "Add to profile."

**On click:** opens a small popover anchored to the button, showing the three kinds as tappable tiles:

```
  +-------------------------------+
  |  Social link                  |
  |  Call to action               |
  |  Text                         |
  +-------------------------------+
```

Each tile shows a name + one-line description. Clicking a tile:

1. Creates a draft `ElementDraft` client-side via `session.addCreate()`. No server call.
2. Scrolls to the new element in the list.
3. Puts the new element into edit mode (the per-kind form is open, focus in the first field).
4. The new element is tracked in `pendingCreates` — it will be saved (or cancelled) along with any other pending changes.

If the user clicks Cancel, all `pendingCreates` are discarded (client-side only, nothing to clean up server-side).

### Trash icon on elements

Each `ProfileElement` card, when the viewer can edit, shows a small **trash icon** to the right of the element content. The icon uses `TransparentCTAButton` styling (or extends it) for visual consistency.

- Click -> `session.markDeleted(elementId)` -> the element immediately renders greyed out (reduced opacity, grey overlay).
- The save bar gains an "Undo" button (see InlineEditSession extension section above).
- Save commits the delete server-side. Cancel reverts the grey-out.

No confirmation modal. No toast. The greyed-out state + Undo on the banner is the safety net.

### Click to edit in place

Clicking the card body enters per-kind edit mode. Each kind has its own form component rendered inside the `editContent` slot of `InlineEditable`:

- `SocialLinkEditor` — one field (URL), with live validation + derived domain display.
- `CtaEditor` — four fields (label, value, caption, url) in a compact vertical stack.
- `TextEditor` — three fields (label, value, caption) in a compact vertical stack.

Each editor, on any field change, pushes the element's updated state into the session via `setDirty("element:<id>:<field>", value, original)`. The session batches changes across multiple elements into one save.

### What we're deliberately not building for MVP

- **Reorder.** No drag-and-drop, no up/down chevrons. Order is creation order.
- **Hide without deleting.** Schema supports `visible: false`, UI doesn't surface it. Delete is the only remove option.
- **Bulk actions, multi-select.** Not needed at microsite scale.
- **Image elements** (`banner_image`, `gallery_image`). Deferred to a later PR.
- **Undo stack beyond the current session.** Cancel reverts the session, but there's no "undo yesterday's delete."

---

## File-by-file changes

### New files

**Schema + server:**
- `prisma/schema.prisma` — additions above
- `prisma/migrations/..._add_profile_element.sql`
- `src/lib/types/profile-element.ts` — `ProfileElement`, `ProfileElementKind`, `ElementDraft`, `ElementCreate`, per-kind value shapes
- `src/lib/utils/server/profile-element.ts` — CRUD helpers (create, update, delete, list by owner)
- `src/app/api/pages/[id]/elements/route.ts` — `GET` list (public, visible only)
- `src/app/api/pages/[id]/elements/[elementId]/route.ts` — individual `PATCH`, `DELETE` (admin-gated; used for standalone operations if needed outside batch)
- `src/app/api/users/[id]/elements/route.ts` — same shape, session-gated to own user
- `src/app/api/profiles/[type]/[id]/about/route.ts` — `PATCH` for `aboutContent`. Polymorphic: `type` is `user` or `page`. Validates edit permission (own user or `canManagePage`). Accepts `{ aboutContent: string }`, returns updated entity.

**Components:**
- `src/lib/components/profile-element/ProfileElementList.tsx` — wrapper + map + Add button (session-aware: read-only if no session)
- `src/lib/components/profile-element/ProfileElementCard.tsx` — per-kind dispatcher + shared frame + trash icon
- `src/lib/components/profile-element/editors/SocialLinkEditor.tsx`
- `src/lib/components/profile-element/editors/CtaEditor.tsx`
- `src/lib/components/profile-element/editors/TextEditor.tsx`
- `src/lib/components/profile-element/AddElementButton.tsx` — the button + popover + kind picker
- `src/lib/components/collection/cards/AboutCard.tsx` — the synthetic collection card
- `src/lib/components/markdown/MarkdownBody.tsx` — thin `react-markdown` wrapper with a whitelist of safe elements (no raw HTML, no images for MVP)
- `src/app/[handle]/about/page.tsx` — server component, works for both User and Page

**Deleted from original plan:**
- `DeleteToast.tsx` — replaced by Undo on the save bar. No toast system needed.

### Modified files

**InlineEditSession stack (foundation changes — Task 1):**
- `src/lib/components/inline-editable/InlineEditSession.tsx`
  - Add `pendingCreates`, `pendingDeletes`, `elementUpdates` state
  - Add `addCreate`, `removeCreate`, `updateCreate`, `markDeleted`, `unmarkDeleted` methods
  - Change `saveAll` to construct structured `SavePayload`
  - Compute unified `changeCount`
- `src/lib/components/inline-editable/InlineEditSessionBar.tsx`
  - Add Undo button (visible when `pendingDeletes.length > 0`)
  - Use `changeCount` instead of `dirtyCount`
- `src/lib/components/profile/PageProfileClient.tsx`
  - Update `handleSave` to accept `SavePayload` (read `payload.fields`, process `payload.elements`)
  - Update display content to show dirty values when pending
  - Load and render `ProfileElementList` inside the body section
- `src/lib/components/profile/UserProfileClient.tsx`
  - Same changes as PageProfileClient (adapted for User)
  - Load and render `ProfileElementList`
- `src/lib/components/event/EventPageClient.tsx`
  - Update `handleSave` to accept `SavePayload` (read `payload.fields`, ignore `payload.elements`)
- `src/lib/components/post/PostPageClient.tsx`
  - Same `SavePayload` migration

**Profile rendering:**
- `src/lib/components/profile/ProfileBody.tsx`
  - Drop the "About" heading for `bio`. Render `bio` as italic tagline under headline.
  - Render `ProfileElementList` at the end (read-only; receives elements from profile data).
- `src/app/[handle]/page.tsx`
  - Load elements alongside posts/events for both User and Page branches.
  - Prepend synthetic About card when `aboutContent` is non-null.
  - Pass elements to `ProfileBody` (non-owner) and `*ProfileClient` (owner).

**Collection:**
- `src/lib/components/collection/ProfileCollectionSection.tsx`
  - Accept `prependCards` prop.
- `src/lib/components/collection/CollectionCard.tsx`
  - Add `ABOUT` branch rendering the `AboutCard`.

**Validation + routing + server utils:**
- `src/lib/validations.ts` — validators for each element kind's data shape; `parentTopic` -> `category` rename
- `src/lib/const/routes.ts` — `PUBLIC_PROFILE_ABOUT(handle)` constant
- `src/lib/utils/server/page.ts` — `getPageByHandle` includes `elements` (ordered, visible filter for public viewers); `parentTopic` -> `category` rename
- `src/lib/utils/server/user.ts` — `getUserByHandle` includes `elements`
- `src/lib/utils/server/fields.ts` — element select fields
- `src/lib/utils/server/permission.ts` — `parentTopic` -> `category` rename
- `src/lib/types/page.ts` — `parentTopic` -> `category` rename
- `src/app/api/me/page/route.ts` — `parentTopic` -> `category` rename; extend PATCH to handle `elements` in structured payload (About content handled by its own route, not here)
- `src/app/api/me/user/route.ts` — extend PUT to handle `elements` in structured payload (About content handled by its own route, not here)

**Seed:**
- `prisma/seed.ts` — seed `ProfileElement`s on example users and pages; seed `aboutContent` on at least one example of each so the About card and subpage are testable.

### Dependencies

- `react-markdown` + `remark-gfm` — needs `npm install`. Small, well-maintained, tree-shakeable. No `dompurify` for MVP because we're whitelisting element types (no raw HTML), which makes sanitization mostly unnecessary. Belt-and-suspenders check in `MarkdownBody` to reject `<script>`, `<iframe>`, etc.

### Unchanged

- `InlineEditable` — reused as-is from PR 1. No changes needed for blur fix (that's a rendering change in the callers).
- Permission layer — `canManagePage` still gates Page editing. User self-editing still uses session check.
- Auth — no changes.

---

## Task breakdown (sequenced)

**Foundation (changes that affect existing behavior):**

1. **InlineEditSession extension.** Add element tracking state (`pendingCreates`, `pendingDeletes`), structured `SavePayload` type, unified `changeCount`, Undo button on the bar. Migrate all four existing callers (`PageProfileClient`, `UserProfileClient`, `EventPageClient`, `PostPageClient`) to the new `onSave({ fields, elements? })` signature. Fix blur display: update display content in all `*ProfileClient` components to show dirty values when pending. Verify all existing inline editing still works after migration.

2. **Schema migration.** Add `aboutContent` to User and Page, rename `parentTopic` -> `category` on Page, add `ProfileElement` table. Propagate `parentTopic` -> `category` across the 6 files listed above. Run locally, verify seed still works.

**New features (builds on foundation):**

3. **Profile element server utilities + batch API.** `ProfileElement` CRUD helpers. Extend `PATCH /api/pages/[id]` and `PUT /api/me/user` to accept `elements` in the structured payload. Transaction wrapping. Unit test each operation.

4. **Markdown renderer.** `MarkdownBody` component + tests. `npm install react-markdown remark-gfm`. Verify it handles empty, plain paragraph, headers, links, lists.

5. **About subpage route + API + inline editor.** `/[handle]/about/page.tsx` with its own `InlineEditSession` (separate from the profile page session). New `PATCH /api/profiles/[type]/[id]/about` endpoint for saving `aboutContent`. Can-edit user sees editor, visitor reads rendered markdown. 404 for empty + non-editor.

6. **Synthetic About card.** Add `ABOUT` kind to `CollectionCard`, `prependCards` prop on `ProfileCollectionSection`, wire into `/[handle]/page.tsx` for both User and Page branches. Seed `aboutContent` on example profiles.

7. **ProfileElementCard + per-kind renderers.** Read-only rendering first. Seed data makes this visible. No editing yet. `ProfileElementList` added to `ProfileBody` for viewer path and `*ProfileClient` for editor path.

8. **ProfileBody cleanup.** Drop "About" heading, bio as tagline. Render `ProfileElementList` in the read-only body.

9. **ProfileElementCard edit mode.** Click to edit, per-kind form editors, registration into `InlineEditSession` via namespaced dirty keys. Batched save works end-to-end.

10. **Trash icon + delete.** Trash icon on each element card (TransparentCTA styling). Click marks element for deletion (greyed-out rendering). Undo on the save bar reverts the most recent delete. Cancel reverts all. Save commits deletes server-side.

11. **AddElementButton + kind picker.** Click -> creates a draft element client-side (`addCreate`), opens it in edit mode, registers with session. Cancel -> discards all drafts (no server cleanup needed).

12. **Playwright E2E.** One full microsite authoring flow: visit your own profile, add a social link, add a CTA, edit a text element, delete an element, save, verify everything persisted. Second flow: visit someone else's profile, see the elements, click the About card, read the About subpage. Third flow: Page admin edits page profile elements.

---

## Out of scope for PR 3

- All PRD P1 and P2 element kinds (`banner_image`, `tags`, `gallery_image`, `date`, `members`, `affiliation`, `schedule`)
- `pinned_post` column from the PRD — `aboutContent` replaces it
- Reorder UX (no DnD, no chevrons)
- Hide-without-delete UI
- Auto-populated "upcoming events" section as a distinct rendering block
- Page category filtering on the directory / explore page — the `category` field exists and is editable, but directory-side filtering is a separate improvement
- Markdown image embeds in About (text only for MVP)
- Any theming, color customization, or layout control
- Any import of content from another platform
- Elements on events or posts (schema supports it via the generic pattern, but no UI in this PR)

---

## Risks / open questions

- **`InlineEditSession` migration scope.** Changing `onSave` to structured payloads touches four existing client components. Low risk (each handler just wraps its existing logic in `.fields`), but needs careful manual testing of all existing inline editing paths: page profile, user profile, event, post.
- **Blur display values.** Showing dirty values in display mode means each field's `displayContent` needs to read from session context. This is a pattern change across many fields in `PageProfileClient` and `UserProfileClient`. Tedious but mechanical — test by editing, clicking away, and verifying the display reflects the edit.
- **Element kind growth.** Schema uses an enum for `kind`. Adding new kinds is a migration. Acceptable — we want the compile-time guarantee in the UI dispatcher.
- **Mobile editing.** Hover-reveals don't work on touch. Mitigation: on touch devices, show the trash icon persistently, or require tap-to-select before delete is available. Worth prototyping early.
- **Accessibility.** Click-to-edit cards need keyboard handlers (Enter -> edit mode, Escape -> cancel). Trash icons need clear labels. The add picker needs keyboard nav. Don't defer any of this; add it during implementation.
- **Markdown security.** `react-markdown` disallows raw HTML by default. Verify `remark-gfm` doesn't re-enable anything. Belt-and-suspenders: reject `<script>`, `<iframe>`, etc.
- **The "About card in collection" feels like a placeholder for the real microsite directory.** Deliberate — PR 3 ships the MVP. The directory story is out of scope and lives in a later milestone.
