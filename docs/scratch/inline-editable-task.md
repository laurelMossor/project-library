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

## The actual problems

### Content body — the biggest issue
- **Published**: Body text is a clean paragraph flowing naturally in the page
- **Draft empty**: "What should people know?" appears as a plain sentence floating in space — no shape, no container, no spatial presence
- **Draft editing**: Click it and a bordered textarea with padding appears out of nowhere — completely different shape and size from the display state
- **The fix**: The empty AND filled display states need to share spatial characteristics with the edit-mode textarea (padding, min-height, container shape) so clicking into edit mode feels like clicking *into* the same space, not summoning a new element

### Title
- **Published**: Bold, large, dark (`text-4xl font-bold text-rich-brown`)
- **Draft empty**: "Event name" is styled identically — same weight, same color. It looks like the event is actually called "Event name"
- **The fix**: Empty placeholder should be clearly distinguishable — lighter weight, muted color — while maintaining the same size and position so it reads as "your title goes here at this scale"

### Location
- **Published**: Location name in a bordered card — this container is already good
- **Draft empty**: "Add a location" inside the card is styled the same as a real location name
- **The fix**: Placeholder text should be visually distinct from filled content (muted, italic)

## Key design principles

- **The form should look like the poster it will become.** Empty areas should have presence and shape — like blank spaces on a bulletin board waiting to be filled
- **Spatial continuity between states.** Padding, position, and dimensions should match between display and edit modes. No layout shift when clicking to edit
- **Use the project's warm palette** (`ash-green`, `soft-grey`, `rich-brown`, etc.) — not generic Tailwind grays. This is a craft-oriented site
- **The cover image gradient placeholder is the gold standard** — it fills space with atmosphere and has a clear CTA. Other empty fields should match that level of intentionality
- Only the owner ever sees empty placeholder states on drafts — no need for `isOwner` conditionals in placeholder text

## Relevant files

- `src/lib/components/inline-editable/InlineEditable.tsx` — generic wrapper, handles hover/edit/save states. Should stay generic.
- `src/lib/components/event/EventPageClient.tsx` — the event page. Contains all the `displayContent` and `editContent` props for each inline field. This is where most changes go.
- `src/lib/components/event/CoverImageEditor.tsx` — reference for how empty state is done well
- `src/app/globals.css` — project color definitions in `@theme` block

## What a reusable solution looks like

Consider creating an `InlinePlaceholder` component in `src/lib/components/inline-editable/` that handles the filled-vs-empty rendering with appropriate styling for each state. This pattern will be reused across events, posts, user profiles, and pages throughout the site.

## Tags note

Tags are a separate element and not part of this task. Focus on title, content body, and location.
