# PR 3 — Page Microsite (SPATS Task 2 + 2a) - Pending

> The actual Page microsite feature: composable `PageElement`s on the public profile, an About subpage, and a synthetic About card in the collection. Implements most of `docs/scratch/PAGE_MICROSITE_PRD.md` at MVP scope.

**Depends on:**
- PR 1 — `InlineEditSession` primitive, inline-editable profile fields, no more form-based edit routes.
- PR 2 — flat `/[handle]` routing. All URLs below assume this has landed; if not, paths move back under `/p/[slug]/`.

**Unblocks:** SPATS Launch milestone completion (Task 2 + 2a).

---

## Goal

Turn a Page from "a profile row" into "their microsite" by adding:

1. **Composable `PageElement`s** — a defined set of blocks (social links, CTA, text) a Page owner can add, edit, and remove on their public profile.
2. **About subpage** — a longform markdown body at `/[handle]/about`, prescribed as the only subpage kind.
3. **Synthetic About card** — the About surfaces in the Page's collection alongside posts and events when it has content, linking to the subpage.
4. **A few structural-field touch-ups** — `bio` becomes a short tagline (no "About" heading), `parentTopic` renames to `category`.

All editing happens inline on the public profile by the Page owner, using `InlineEditSession` from PR 1. No separate editor route.

---

## Guiding principles

- **The profile IS the microsite, and the profile IS the editor.** There's no secondary "manage your microsite" route.
- **Prescribed, not open-ended.** About is the only subpage kind. Element kinds come from a fixed list. No custom fields, no custom subdomains, no theming.
- **MVP rings the bell.** Ship a small set of element kinds that cover 80% of real page shapes. Everything in PRD P1/P2 is deferred.
- **Warm like a notebook, not like a CMS.** Editing affordances appear on hover, disappear when not needed. The save bar is the only persistent chrome.

---

## Schema changes

### Page table additions

```prisma
model Page {
  // ...existing fields...

  // Renamed from parentTopic (PRD: "category powers directory filtering")
  category String?

  // Longform "about me" markdown body. Null means no About page.
  aboutContent String?

  // ...
  elements PageElement[]
}
```

Migration steps, in order:

1. Add `aboutContent String?` (nullable default).
2. Rename `parentTopic` → `category` (Prisma migration `renameColumn`). No data transformation — it's a simple rename.
3. Add the `PageElement` relation.

`bio` is **not** dropped. In PR 3 it is visually relabeled as "tagline" in the edit UI and no longer rendered under an "About" heading in `ProfileBody`. The field name in the schema stays `bio` to avoid a disruptive rename.

### New model — `PageElement`

```prisma
enum PageElementKind {
  SOCIAL_LINK
  CTA
  TEXT
}

model PageElement {
  id        String          @id @default(cuid())
  pageId    String
  kind      PageElementKind

  label     String?
  value     String
  caption   String?
  url       String?
  sortOrder Int
  visible   Boolean         @default(true)

  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  page      Page            @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([pageId, sortOrder])
  @@map("page_elements")
}
```

Design notes:

- `sortOrder` is `Int`, compacted 0..N on any ordering change. Element counts per page are small (< ~30 expected), no need for gap-based ordering tricks.
- `visible` allows hiding without deleting. Not exposed in MVP UI — reserved for a later "hide without losing" affordance. Schema-first, UI-second.
- Cardinality (e.g. "one CTA max") enforced in application code, not in the schema, per PRD. The Add UI will prevent adding a second CTA rather than letting it be inserted and then rejected.
- No type-specific columns. Per-kind validation and rendering lives in code: `label`/`value`/`caption`/`url` cover every kind's data needs for MVP.

### MVP element kinds

| Kind | What it's for | `label` usage | `value` usage | `caption` usage | `url` usage |
|---|---|---|---|---|---|
| `SOCIAL_LINK` | Instagram, website, Bandcamp, etc. | Auto-derived from URL domain at render time (e.g. "Instagram"). Not user-editable in MVP. | The URL itself (also stored in `url` for consistency). | — | The link target. |
| `CTA` | "Book now", "Join the newsletter", "Open house Saturday" | The headline ("Now Booking") | The body ("Booking open for July") | The fine print ("Waitlist open for August") | Optional link target. |
| `TEXT` | Hours, pronouns, rates, accessibility notes, studio rules, one-off things | Optional custom heading ("Studio Hours") | The text content ("Wed–Sat 11–7") | Optional supporting text | Optional. |

Dropped from PRD P0 for MVP:

- `SCHEDULE` — covered by `TEXT` with a "Studio Hours" label. Promote later if usage justifies structured hours.
- All P1/P2 kinds (`banner_image`, `tags`, `gallery_image`, `date`, `members`, `affiliation`).

---

## Rendering

### Page profile (`/[handle]/page.tsx`)

Structure, top to bottom:

```
ProfileHeader          [avatar, name, category badge]
  │
ProfileBody            [tagline (was bio), location, interests, tags,
                        address, "open to collaborators" badge]
  │
PageElementList        [ordered, visible elements rendered per-kind]
  │
ProfileCollectionSection  [synthetic About card, then pinned posts/events,
                           then the rest of the collection]
```

**Key changes:**

- `ProfileBody` no longer renders an "About" heading over `bio`. `bio` renders as a short italic line directly beneath the headline, same visual weight as a byline.
- `PageElementList` is new, inserted between `ProfileBody` and the collection. When the owner is viewing their own page, the list ends with a `+ Add to page` button.
- `ProfileCollectionSection` accepts a `prependCards` prop. The Page route passes `[{ kind: "ABOUT", ... }]` when `aboutContent` is non-null.

### About subpage (`/[handle]/about/page.tsx`)

A new server component. Same `CenteredLayout` as existing routes. Structure:

```
  ← Back to [Page name]

  [Page avatar + name]  (quiet, small — this page isn't about identity, it's about content)

  # Markdown body
  rendered from page.aboutContent, or "Write about your page" placeholder
  if empty and the viewer is the owner
```

When the viewer is the Page owner, the markdown body is a single `InlineEditable` registered with an `InlineEditSession`. Edit mode swaps the rendered markdown for a plain textarea (monospace, comfortable line height, generous padding). Save → batched PATCH → back to rendered mode.

When the viewer is not the owner and `aboutContent` is empty or null, the route 404s. No empty About pages visible to the public.

### `PageElement` rendering (per kind)

Visual consistency across all kinds: same card spacing, same border weight, same hover affordance. Differences are internal layout only.

- **SOCIAL_LINK** — icon (from domain) + display handle/URL + arrow. No label shown (derived). Clicking anywhere on the card opens the URL in a new tab.
- **CTA** — a distinctive highlighted block: `label` as a small uppercase eyebrow, `value` as a prominent headline, `caption` as subtle supporting text, a single button if `url` is set. This is the only element kind with a called-out visual weight — it's a CTA, after all.
- **TEXT** — `label` (if present) as a small heading, `value` as body text, `caption` as muted supporting text below. Quiet, notebook-like.

All three use the same outer card container so the list reads as one vocabulary.

### Synthetic About card in the collection

New card kind: `ABOUT`. Renders in the same grid/list/map slot as post and event cards.

```
[About card]
  "About this page"
  first ~200 chars of aboutContent (plain-text excerpt)
  "Read more →"
```

Links to `/[handle]/about`. Rendered first in the collection list (prepended before posts/events). Not sortable, not pinnable — its position is fixed.

Implementation: `ProfileCollectionSection` accepts `prependCards`. The Page route loader checks `page.aboutContent` and prepends a synthetic descriptor:

```ts
const prependCards = page.aboutContent
  ? [{ kind: "ABOUT" as const, pageSlug: page.slug, excerpt: excerpt(page.aboutContent, 200) }]
  : [];
```

`CollectionCard` (or its parent renderer) adds an `ABOUT` branch alongside the existing `POST` and `EVENT` branches.

---

## Editing UX — the part that needs design attention

This is the interaction the user called out specifically. Three affordances:

### 1. "+ Add to page" button

A single button appearing at the end of `PageElementList` when the viewer is the owner. Visual: same warm border style as other owner affordances, plus icon, label "Add to page". Unobtrusive when not needed.

**On click:** opens a **kind picker**. Not a modal (too heavy). Not a dropdown (not quite right for three visually distinct options). Recommended pattern: a small popover anchored to the button, showing the three kinds as tappable tiles:

```
  ┌───────────────────────────────┐
  │  🔗  Social link              │
  │  ✨  Call to action           │
  │  📝  Text                     │
  └───────────────────────────────┘
```

Each tile shows an icon + name + one-line description ("A link to Instagram, your website, …"). Clicking a tile:

1. Immediately creates a draft PageElement server-side with `visible: false`, sortOrder `max + 1`, minimal default values.
2. Returns the new element id.
3. Scrolls to the new element in the list.
4. Puts the new element into edit mode (the per-kind form is open, focus in the first field).
5. The new element is dirty in the current `InlineEditSession` — it will be saved (or cancelled) along with any other pending edits.

If the owner cancels the session without saving, the draft element is deleted (or `visible` stays false and is swept later — implementation detail). Recommendation for MVP: cancel → deletes any session-created drafts server-side.

**Craft note:** the picker should feel like pulling a block off a shelf. No spinner. No "Are you sure?" No multi-step wizard. One click → the thing exists and is ready to type into.

### 2. Hover to reveal element actions

On any existing `PageElement` card, when the owner hovers (or focuses via keyboard):

- A **trash icon** appears in the top-right corner. Button, not a hover-only element — it's actionable.
- Click → inline confirm. Either a tiny popover ("Delete this? [Cancel] [Delete]") or an optimistic delete with an "Undo" toast. Recommendation: the toast pattern — less friction, easier recovery, feels lighter. Toast has a 5–8s window before the delete commits.
- Delete marks the element for removal in the session's dirty state. Save commits, cancel reverts.

No edit icon needed — the element card itself is click-to-edit via `InlineEditable`. Click the card body → edit mode. Click the trash → delete.

### 3. Click to edit in place

Clicking the card body enters per-kind edit mode. Each kind has its own form component rendered inside the `editContent` slot of `InlineEditable`:

- `SocialLinkEditor` — one field (URL), with live validation + derived domain display.
- `CtaEditor` — four fields (label, value, caption, url) in a compact vertical stack.
- `TextEditor` — three fields (label, value, caption) in a compact vertical stack.

Each editor, on any field change, pushes the element's updated state into the `InlineEditSession` as `dirtyFields[element-${id}]`. The session batches changes across multiple elements into one PATCH that updates them all.

### The session handles everything

All of the above — adding, editing, deleting, reordering-if-we-had-it — flows through one `InlineEditSession` wrapping the whole page. One Save button, one Cancel button, one sticky bar. The bar counts every kind of pending change equally:

```
  3 unsaved changes       [Cancel]  [Save]
```

Cancel blows away every pending create, edit, and delete. Save commits everything in one request.

### What we're deliberately not building for MVP

- **Reorder.** No drag-and-drop, no up/down chevrons. Order is creation order. Note in UI: "Reorder coming soon" → no, actually, say nothing. Just ship it without.
- **Hide without deleting.** Schema supports `visible: false`, UI doesn't surface it. Delete is the only remove option.
- **Per-element visibility toggle.** Same — schema has it, UI doesn't.
- **Bulk actions, multi-select.** Not needed at microsite scale.
- **Image elements** (`banner_image`, `gallery_image`). Deferred to a later PR.
- **Undo stack beyond the current session.** Cancel reverts the session, but there's no "undo yesterday's delete."

---

## File-by-file changes

### New files

**Schema + server:**
- `prisma/schema.prisma` — additions above
- `prisma/migrations/…_add_page_element.sql`
- `src/lib/types/page-element.ts` — `PageElement`, `PageElementKind`, per-kind value shapes
- `src/lib/utils/server/page-element.ts` — CRUD helpers
- `src/app/api/pages/[id]/elements/route.ts` — `GET` list, `POST` create draft
- `src/app/api/pages/[id]/elements/[elementId]/route.ts` — `PATCH`, `DELETE`
- `src/app/api/pages/[id]/about/route.ts` — `PATCH` aboutContent (or roll into existing `/api/me/page` PATCH)
- `scripts/markdown-sanitize.md` — short doc on the markdown rendering decisions

**Components:**
- `src/lib/components/page-element/PageElementList.tsx` — wrapper + map + Add button
- `src/lib/components/page-element/PageElementCard.tsx` — per-kind dispatcher + shared frame
- `src/lib/components/page-element/editors/SocialLinkEditor.tsx`
- `src/lib/components/page-element/editors/CtaEditor.tsx`
- `src/lib/components/page-element/editors/TextEditor.tsx`
- `src/lib/components/page-element/AddElementButton.tsx` — the button + popover
- `src/lib/components/page-element/AddElementPicker.tsx` — the popover itself
- `src/lib/components/page-element/DeleteToast.tsx` — undo-toast primitive (or reuse an existing toast lib if one exists)
- `src/lib/components/collection/cards/AboutCard.tsx` — the synthetic collection card
- `src/lib/components/markdown/MarkdownBody.tsx` — thin `react-markdown` wrapper with a whitelist of safe elements (no raw HTML, no images for MVP)
- `src/app/[handle]/about/page.tsx` — server component

### Modified files

- `src/lib/components/profile/ProfileBody.tsx`
  - Drop the "About" heading for `bio`. Render `bio` as italic tagline under headline.
  - Render `PageElementList` when profile type is PAGE.
- `src/app/[handle]/page.tsx` (the PR 2 new route)
  - Load elements alongside posts/events.
  - Prepend synthetic About card when `aboutContent` is non-null.
  - Wrap owner view in `InlineEditSession`.
- `src/lib/components/collection/ProfileCollectionSection.tsx`
  - Accept `prependCards` prop.
  - `CollectionCard` renderer adds `ABOUT` branch.
- `src/lib/components/collection/CollectionCard.tsx` — `ABOUT` branch rendering the `AboutCard`.
- `src/lib/validations.ts` — validators for each element kind's data shape.
- `src/lib/const/routes.ts` — `PUBLIC_PAGE_ABOUT(handle)` constant.
- `src/lib/utils/server/page.ts` — `getPageBySlug` includes `elements` (ordered, visible filter for public viewers).
- `src/lib/utils/server/fields.ts` — `pageWithElementsFields` selector.
- `prisma/seed.ts` — seed a couple of PageElements on example pages so the feature has something to show at `npm run db:seed:dev`.

### Dependencies

- `react-markdown` (and `remark-gfm` for basic github-flavored markdown). Small, well-maintained, tree-shakeable. No `dompurify` for MVP because we're whitelisting element types (no raw HTML), which makes sanitization mostly unnecessary. Add a check in `MarkdownBody` to reject `<script>`, etc., belt-and-suspenders.

### Unchanged

- `InlineEditable`, `InlineEditSession` — reused as-is from PR 1.
- Permission layer — `canManagePage` still gates everything.
- Auth — no changes.

---

## Task breakdown (sequenced)

1. **Schema migration.** Add `aboutContent`, rename `parentTopic` → `category`, add `PageElement` table. Run locally, verify seed still works.
2. **Page element server utilities + API routes.** `GET` list, `POST` create draft, `PATCH`, `DELETE`. Unit test each.
3. **Markdown renderer.** `MarkdownBody` component + tests. Verify it handles empty, plain paragraph, headers, links, lists.
4. **About subpage route + inline editor.** `/[handle]/about/page.tsx`, `InlineEditSession` wrapping the body. Owner can edit, visitor reads. 404 for empty+non-owner.
5. **Synthetic About card.** Add `ABOUT` kind to `CollectionCard`, `prependCards` prop on `ProfileCollectionSection`, wire into `/[handle]/page.tsx`.
6. **PageElementCard + per-kind renderers.** Read-only rendering first. Seed data makes this visible. No editing yet.
7. **PageElementCard edit mode.** Click to edit, per-kind forms, registration into `InlineEditSession`. Batched save works.
8. **Hover delete.** Trash icon, undo-toast delete, cancel reverts.
9. **AddElementButton + AddElementPicker.** Click → creates a draft element, opens it in edit mode, registers with session. Cancel → deletes drafts.
10. **ProfileBody cleanup.** Drop "About" heading, bio as tagline.
11. **Playwright E2E.** One full microsite authoring flow: visit your own page, add a social link, add a CTA, edit a text element, delete an element, save, verify everything persisted. Second flow: visit someone else's page, see the elements, click the About card, read the About subpage.

---

## Out of scope for PR 3

- All PRD P1 and P2 element kinds (`banner_image`, `tags`, `gallery_image`, `date`, `members`, `affiliation`, `schedule`)
- `pinned_post` column from the PRD — `aboutContent` replaces it; naming is cleaner and collision with `Post.pinnedAt` is avoided.
- Reorder UX (no DnD, no chevrons)
- Hide-without-delete UI
- Auto-populated "upcoming events" section as a distinct rendering block (PRD calls this out; for MVP, events already render in the collection. Pulling them into a dedicated hero section is a nice later win, not a shipping blocker.)
- Page category filtering on the directory / explore page — the `category` field exists and is editable, but directory-side filtering is a separate explore-page improvement.
- Markdown image embeds in About (text only for MVP — users can link to images but not inline them)
- Any theming, color customization, or layout control
- Any import of content from another platform
- Structured analytics for the About page

---

## Risks / open questions

- **Adding elements within a session — server state vs. session state.** If the Add button creates the element server-side immediately and Cancel is supposed to remove it, you can end up with orphan elements if the user closes the tab mid-session. Mitigation options: (a) use `visible: false` as a "draft flag" and sweep unseen invisible elements on a cron; (b) create elements entirely client-side and only persist on Save — this is cleaner but requires the session to represent creates-as-JSON too. **Recommendation: (b) for MVP.** It keeps server state clean and matches the session's semantics ("nothing is real until you Save").
- **Undo toast timing.** 8 seconds is the default. Tune after real use.
- **Markdown security.** `react-markdown` disallows raw HTML by default — good. Verify `remark-gfm` doesn't re-enable anything. Lint: reject `<script>`, `<iframe>`, anything on an allowlist mismatch.
- **Element kind growth.** Schema supports any string for `kind`, but we're using an enum. Adding new kinds is a migration. Acceptable — we want the compile-time guarantee in the UI dispatcher. Document in the plan that adding a kind = schema migration + new editor component + new renderer branch.
- **Mobile editing.** Hover-reveals don't work on touch. Mitigation: on touch devices, show the trash icon persistently, or require tap-to-select before delete is available. Worth prototyping early.
- **Accessibility.** Click-to-edit cards need keyboard handlers (Enter → edit mode, Escape → cancel). Trash icons need clear labels. The add picker needs keyboard nav. Don't defer any of this; add it during implementation.
- **The "About card in collection" feels like a placeholder for the real microsite directory.** Deliberate — PR 3 ships the MVP. The directory story is out of scope and lives in a later milestone.
