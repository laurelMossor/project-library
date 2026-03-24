# PRD: Explore Page

**Status:** Mock complete, ready for implementation
**Mock:** `/explore/mock` (run `npm run dev`)

---

## What this is

The Explore page is where someone encounters Project Library for the first time — or returns to it every week. It's the community's bulletin board: what's being made, what's coming up, who's here.

Right now it works but it feels like a database query. It shows results. It doesn't feel like a place.

---

## Who uses this

Someone at a kitchen table on a weekend morning. Part of a local maker, mutual aid, or skill-share community. They're not searching for something specific — they want to feel the pulse of what's alive. Maybe they're new and trying to understand whether this place is for them.

**What they need to do:** Wander until something catches. Spot an event that sounds like their kind of thing. See a project that makes them want to show up.

**What it should feel like:** A well-loved community corkboard. Physical. A little handmade. Warm without being precious. Not a tech product.

---

## What's wrong today

| Layer | Problem |
|---|---|
| Discovery | No topic browsing — only free-text tag input (keyboard-only, awkward) |
| Content types | Events and posts look identical — no visual hierarchy between them |
| Card design | Generic: badge → title → description → footer. Could be any platform. |
| States | Loading is plain text. Empty is plain text. No craft. |
| Language | "Loading collections..." — database vocabulary, not community vocabulary |
| Layout | CSS `columns` masonry — cards jump around, no stable reading pattern |

---

## Goals (MVP)

1. Replace text-input tag filtering with browseable topic tabs
2. Give events and posts distinct visual identities — instantly recognizable at a glance
3. Make cards feel like they came from a community, not a CMS
4. Replace all placeholder states with designed ones
5. No new data models or API changes required

**Out of scope:** Personalized feed, saved items, map view, following-only filter

---

## Design Direction

### The world this lives in

Project Library is a physical-world community platform. The colors and feel should come from that world:

| Token | Hex | What it evokes |
|---|---|---|
| `rich-brown` | #291F1E | Dark workshop wood, print ink |
| `melon-green` | #C4D6B0 | Dried sage, the plant shelf at a tool library |
| `moss-green` | #475841 | Chalkboard green, dense foliage |
| `whale-blue` | #477998 | Faded denim — a shop apron, a workshop wall |
| `alice-blue` | #D6E3EB | Pale blue chalk, blue-grey linen |
| `ash-green` | #CBD2C2 | Reclaimed wood, dried herbs |
| `grey-white` | #E6E8E6 | Chalk dust, pale linen, pinned paper |
| `soft-grey` | #CED0CE | Corkboard surface, matte paper |
| `novel-red` | #A3333D | A worn rubber stamp, urgent notice |
| `soft-blush` | #EDD4DA | Warm pink — gentle urgency for "seeking help" |
| `smokey-red` | #A06064 | Muted red text — pairs with soft-blush |

**Depth:** Surface color shifts, not shadows. Cards (`grey-white`) sit on a slightly deeper ground (`soft-grey` with subtle radial gradient washes) — paper on corkboard. No dramatic drop shadows. Borders are whisper-quiet.

**Typography:** Two registers, one loaded font:
- **Fraunces** (display, `.font-display`): Page title, card titles, empty state heading. Variable serif with optical size, warm and characterful. Heavy, tight-tracked — like a printed label.
- **System sans** (everything else): Descriptions, UI labels, inputs, buttons, tags, handles. Tailwind v4's default sans-serif. Clean, stays out of the way.
- Only one custom font loads. The hierarchy comes from weight and tracking, not from stacking multiple typefaces.

**Spacing:** 4px base. Component padding: `p-5` (20px). Section gaps: 24–32px.

### Signature elements

**Events** are recognizable by their **blue identity**. A full-width `alice-blue` banner across the top of the card with a calendar icon and date in `whale-blue`. The blue band is the first thing your eye hits — "this is something you can attend."

**Posts** are works-in-progress — that's what makes this platform different. Post cards carry a **dashed left border in `melon-green`**, like a page half-torn from a sketchbook. Posts are **content-first**: the image leads (when present), then the description, then the title. The writing and the making are the hook; the title is secondary context.

These two visual signatures mean you never need a label that says "EVENT" or "POST." The card tells you what it is. **No type badges or status badges on cards** — categorization happens through Topics (tags), not through metadata labels. Event type (Workshop, Skill Share, etc.) and post status (In Progress, Finished, etc.) may be added as a future feature.

---

## Proposed Design

### 1. Page Header

Background: `ash-green` — the warm entry that says "you're in a community space."

```
┌──────────────────────────────────────────────────┐
│  Explore                                         │  ← font-display text-3xl font-extrabold tracking-tight
│  See what your community is making and sharing   │  ← font-body text-sm text-misty-forest
│                                                  │
│  [ 🔍 Search workshops, projects, people... ___ ]│
└──────────────────────────────────────────────────┘
```

- Search placeholder uses community vocabulary: **"workshops, projects, people"** — not "posts, events, tags"
- Search input: inset feel (`bg-grey-white border border-soft-grey`), search icon left, ~480px max
- Typing in the search box surfaces **matching topic suggestions** in a dropdown. Clicking a suggestion toggles that topic in the "Browse by:" tabs below (activates or deactivates). Already-active topics appear bold with an "active" label. The input clears after selection.
- The search box does **not** create separate topic chips — topic state lives only in the tab row.
- `px-6 py-5 bg-ash-green` — compact header band, enough presence without eating the viewport

---

### 2. Topic Tabs

Not chips — **tabs**, like index-card dividers at a physical library. The metaphor matters.

```
Browse by:  [ Making ]  [ Tools ]  [ Growing ]  [ Learning ]  [ Mentorship ]  [ Design ]  [ Repair ] →
```

| State | Style |
|---|---|
| Resting | `bg-soft-grey/60 text-warm-grey rounded-sm` — matte, receded |
| Active | `bg-grey-white text-rich-brown font-semibold border-t-2 border-rich-brown rounded-sm shadow-sm` — lifted forward |

- Horizontally scrollable, no wrapping
- Sourced from `/api/topics`
- Multi-select (OR logic) — click to activate, click again to deactivate
- Label: **"Browse by:"** — shorter and more natural than "Browse by interest:"
- Topics can also be activated via the search typeahead (see Header above)

---

### 3. Filter Bar

```
[ All ] [ Events ] [ Posts ]          Newest ▾    [ ≡ list ] [ ⊞ grid ]
```

| Element | Style |
|---|---|
| Active type pill | `bg-rich-brown text-grey-white rounded-full px-3.5 py-1` |
| Resting type pill | `border border-soft-grey text-warm-grey rounded-full px-3.5 py-1` |
| Sort dropdown | Plain text `font-body text-warm-grey text-sm` — no decorative border |
| View toggle | Icon-only, no background containers |

Full bar: `py-3 border-b border-soft-grey/60` — separates browsing from content without a heavy break.

---

### 4. Cards

**Shared surface:** `bg-grey-white border border-soft-grey rounded-lg overflow-hidden flex flex-col`

**Hover:** `-translate-y-0.5 border-ash-green/80 transition-all duration-150` — paper lifting off a board, not a SaaS card animating.

---

**Event Card** — Blue identity, calendar-forward

```
┌──────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓ alice-blue banner ▓▓▓▓▓▓▓▓▓▓▓▓│
│ 📅                               SAT APR 5  │  ← calendar icon left, date right, all whale-blue
│──────────────────────────────────────────────│
│                                              │
│ Title of the event                           │  ← font-display text-base font-bold
│ Short description, 2 lines max...            │
│                                              │
│ 📍 Oakland Tool Library                      │
│ ──────────────────────────────────────────── │
│ [OT] @oaklandtools                           │
└──────────────────────────────────────────────┘
```

- **Blue banner** across the top: `bg-alice-blue px-5 py-3` — the card's identity before you read a word
- **Calendar icon** left, **date** right-aligned: `text-sm font-bold text-whale-blue` — the date is why you care
- No event type label — the blue banner + calendar icon is the identity
- Location: pin icon + name, `text-xs text-misty-forest`
- Avatar: initials circle `bg-melon-green text-moss-green text-[10px] font-bold`

---

**Post Card** — Content-first, sketchbook signature

```
┌──┬───────────────────────────────────────────┐
│  │ [ image if present, edge-to-edge, h-36 ]  │  ← image FIRST, before any text
│  │                                            │
│  │ Title of the project                       │  ← font-display text-[15px] font-bold
│  │ Description of what they're making,        │  ← font-body, the substance of the post
│  │ 3 lines max...                             │
│  │ ────────────────────────────────────────── │
│  │ [MB] @miriambuild     [ tag ] [ tag ]      │
└──┴───────────────────────────────────────────┘
```

- **Dashed left border:** `border-left: 3px dashed #C4D6B0` — the sketchbook signature. Only post cards have this.
- **Image leads** when present — edge-to-edge at the top of the card, `h-36`
- **Title then description** — title orients you, description is the substance
- No status badge — categorization is through topic tags only
- Tags: `bg-melon-green/25 text-moss-green text-[11px] rounded-full px-2.5 py-0.5`

---

### 5. Layout

**Masonry** via `react-masonry-css` — stable left-to-right reading order, no column-reflow jumping. Cards have natural variable heights (posts with images are taller, text-only posts are compact) and the masonry layout keeps things visually interesting.

| Breakpoint | Columns |
|---|---|
| Mobile (<640px) | 1 column |
| Tablet (640–1024px) | 2 columns |
| Desktop (>1024px) | 3 columns |

List view: single column, max-width `42rem`.

Gap: 20px between cards in grid, 16px in list.

---

### 6. Empty State

```
         Nothing pinned here yet.
   Change your topic or search term —
   or add something to the board.

   [ Share a project ]   [ Post an event ]
```

- **"Nothing pinned here yet"** — corkboard vocabulary, `font-display text-xl font-bold`
- **"Share a project"** and **"Post an event"** — active community verbs, not system verbs
- Primary CTA (Post an event): `bg-rich-brown text-grey-white hover:bg-muted-brown`
- Secondary CTA (Share a project): `border border-rich-brown text-rich-brown hover:bg-rich-brown hover:text-grey-white`

---

### 7. Loading State

6 skeleton cards in the masonry grid. No text, no "Loading..." — the layout builds toward content.

Some skeletons include a tall image-height block to mimic the variable-height masonry. All blocks `animate-pulse bg-soft-grey rounded`.

---

### 8. Corkboard Background

The content area below the header uses a subtle textured background instead of flat `soft-grey`:

```css
background-color: #CED0CE;
background-image:
    radial-gradient(ellipse at 20% 50%, rgba(203,210,194,0.4) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(214,227,235,0.3) 0%, transparent 40%),
    radial-gradient(circle at 50% 80%, rgba(196,214,176,0.15) 0%, transparent 35%);
```

Layered radial gradients in ash-green, alice-blue, and melon-green tones create subtle color shifts across the surface — paper on corkboard, not a flat digital slab.

---

## Content types reference

| Type | Key data fields | Visual signature |
|---|---|---|
| Event | title, description, eventDateTime, location, tags, images | Blue (`alice-blue`) banner with calendar icon and date |
| Post | title, description, createdAt, tags, images, updates | Dashed left border in `melon-green`, content-first (image → description → title) |

Categorization happens through **Topics (tags)**, not through type badges or status labels. Event type and post status badges may be added as a future feature.

*No schema changes required.*

---

## Technical notes

- **Masonry library:** `react-masonry-css` (~1KB) for stable left-to-right masonry without column-reflow jank
- **Fonts:** One Google Font loaded — `Fraunces` (display headings only). All body text uses Tailwind's default sans. In production, move to `next/font` for self-hosting.
- **No new API endpoints** — topics from `/api/topics`, events and posts from existing endpoints
- **Mock location:** `src/app/explore/mock/page.tsx` — uses hardcoded sample data, toggle buttons for skeleton/empty states
