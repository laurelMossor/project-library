# Task: Align Inline Editable Elements with Final Published Form

## What this is about

The event page (`EventPageClient.tsx`) is both the creation form and the published view. Authors create events by editing fields inline on the same page that will eventually be published. The idea is good — the form IS the final product. But right now, the editable elements don't actually look like their final counterparts.

## How to understand the problem

1. Read `docs/guidance/PROJECT_GUIDELINES.md`
2. Invoke the `interface-design:critique` and `frontend-design` skills and let their output shape your approach — do NOT write a plan first
3. Log in as dolores (email: `dolores.example@example.com`, password: `dolores`)
4. Create a new event (pencil icon in nav bar, or navigate to `/events/new`)
5. Observe the draft page with all empty fields
6. Fill in the title and body, then publish
7. Compare the published event to an existing fully-built event like "Woodworking Tools Swap & Sale" (find it on `/explore`)
8. Now go back and compare the DRAFT form to the PUBLISHED page — that's where the problems are

## Key design principles

- **The form should look like the post it will become.** Empty areas should have presence and shape — like blank spaces on a bulletin board waiting to be filled
- **Spatial continuity between states.** Padding, position, and dimensions should match between display and edit modes. No layout shift when clicking to edit
- **Use the project's warm palette** (`ash-green`, `soft-grey`, `rich-brown`, etc.) — not generic Tailwind grays. This is a craft-oriented site
- **The cover image gradient placeholder is the gold standard** — it fills space with atmosphere and has a clear CTA. Other empty fields should match that level of intentionality
- Only the owner ever sees empty placeholder states on drafts — no need for `isOwner` conditionals in placeholder text

## Relevant files

- `src/lib/components/inline-editable/InlineEditable.tsx` — generic wrapper, handles hover/edit/save states. Should stay generic.
- `src/lib/components/event/EventPageClient.tsx` — the event page. Contains all the `displayContent` and `editContent` props for each inline field. This is where most changes go.
- `src/lib/components/event/CoverImageEditor.tsx` — reference for how empty state is done well
- `src/app/globals.css` — project color definitions in `@theme` block
