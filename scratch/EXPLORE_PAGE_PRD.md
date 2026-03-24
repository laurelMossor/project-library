# PRD: Explore Page

**Status:** Design direction defined, mock in progress
**Run locally:** `npm run dev`

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
2. Give events and posts distinct visual identities — scan at a glance
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

**Depth:** Surface color shifts, not shadows. Cards (`grey-white`) sit on a slightly deeper ground (`soft-grey`) — paper on corkboard. No dramatic drop shadows. Borders are whisper-quiet.

**Typography:** Weight and tracking do the work. Heading: heavy, tight-tracked — like a printed label. Badges: uppercase, wide tracking — the rubber-stamp register. Body: comfortable reading weight.

**Spacing:** 4px base. Component padding: `p-5` (20px). Section gaps: 24–32px.

### Signature element

Posts are works-in-progress — that's what makes this platform different from every other content feed. Post cards carry a **dashed left border in `melon-green`**, like a page half-torn from a sketchbook. This visual language exists nowhere else and can only mean one thing here.

---

## Proposed Design

### 1. Page Header

Background: `ash-green` — the warm entry that says "you're in a community space."

```
┌──────────────────────────────────────────────────┐
│  Explore                                          │  ← font-bold tracking-tight text-4xl
│  See what your community is making and sharing   │  ← alive, not a taxonomy
│                                                  │
│  [ Search workshops, projects, people... ______] │
└──────────────────────────────────────────────────┘
```

- Search placeholder uses community vocabulary: **"workshops, projects, people"** — not "posts, events, tags"
- Search input: inset feel (`bg-grey-white border border-soft-grey`), left-aligned, ~480px max
- `px-6 py-10 bg-ash-green` — full-width header band

---

### 2. Topic Tabs

Not chips — **tabs**, like index-card dividers at a physical library. The metaphor matters.

```
Browse by:  [ All ]  [ Making ]  [ Tools ]  [ Growing ]  [ Learning ]  [ Mentorship ]  [ Design ]  [ Repair ] →
```

| State | Style |
|---|---|
| Resting | `bg-soft-grey text-warm-grey` — matte, receded |
| Active | `bg-grey-white text-rich-brown font-semibold border-t-2 border-rich-brown` — lifted forward |

- Horizontally scrollable, no wrapping
- Sourced from `/api/topics`
- Multi-select (OR logic)
- Label: **"Browse by:"** — shorter and more natural than "Browse by interest:"

---

### 3. Filter Bar

```
[ All ] [ Events ] [ Posts ]          Newest ▾    [ ≡ list ] [ ⊞ grid ]
```

| Element | Style |
|---|---|
| Active type pill | `bg-rich-brown text-grey-white rounded-full px-3 py-1` |
| Resting type pill | `border border-soft-grey text-warm-grey rounded-full px-3 py-1` |
| Sort dropdown | Plain text `text-warm-grey text-sm` — no decorative border |
| View toggle | Icon-only, no background containers |

Full bar: `py-3 border-b border-soft-grey` — separates browsing from content without a heavy break.

---

### 4. Cards

**Shared surface:** `bg-grey-white border border-soft-grey rounded-lg p-5 flex flex-col`

**Hover:** `translate-y-[-2px] border-ash-green transition-all duration-150` — paper lifting off a board, not a SaaS card animating.

---

**Event Card**
```
┌──────────────────────────────────────────────┐
│ [ Workshop ]                      SAT MAR 28 │  ← badge left, date right — date is the hook
│                                              │
│ Title of the event                           │
│ Short description, 2 lines max...            │
│                                              │
│ ◎ Oakland Tool Library                       │
│ ──────────────────────────────────────────── │
│ [ML] @makersloft                             │
└──────────────────────────────────────────────┘
```

- **Badge** uses event type from data — not the word "EVENT":
  `Workshop · Open Studio · Skill Share · Lending · Talk`
- Badge style: `bg-alice-blue text-whale-blue text-xs tracking-wide uppercase px-2 py-0.5 rounded`
- **Date** right-aligned, `text-sm font-semibold text-rich-brown` — the date is why you care
- Location: `◎` icon + name, `text-xs text-warm-grey`
- Avatar: initials circle `bg-melon-green text-moss-green text-xs font-semibold`

---

**Post Card**
```
┌──┬───────────────────────────────────────────┐
│  │ [ In Progress ]                            │  ← dashed left border = sketchbook signature
│  │ Title of the project                       │
│  │                                            │
│  │ [ image if present, rounded, h-32 ]        │
│  │                                            │
│  │ Short description, 2 lines max...          │
│  │ ────────────────────────────────────────── │
│  │ [RL] @rosalopez        [ tag ] [ tag ]     │
└──┴───────────────────────────────────────────┘
```

- **Dashed left border:** `border-l-2 border-dashed border-melon-green` — the sketchbook signature. Only post cards have this.
- **Badge** uses post status — not the word "POST":
  `In Progress · Finished · Seeking Help · Sharing`
- Badge style: `bg-ash-green text-moss-green text-xs tracking-wide uppercase px-2 py-0.5 rounded`
- Tags: `bg-melon-green/30 text-moss-green text-xs rounded-full px-2 py-0.5`

---

### 5. Grid

CSS Grid — stable rows, not masonry jumping.

| Breakpoint | Layout |
|---|---|
| Mobile | `grid-cols-1 gap-4` |
| Tablet | `grid-cols-2 gap-5` |
| Desktop | `grid-cols-3 gap-6` |

---

### 6. Empty State

```
         Nothing pinned here yet.
   Change your topic or search term —
   or add something to the board.

   [ Share a project ]   [ Post an event ]
```

- **"Nothing pinned here yet"** — corkboard vocabulary
- **"Share a project"** and **"Post an event"** — active community verbs, not system verbs
- Primary CTA (Post an event): `bg-rich-brown text-grey-white` — time-sensitive, leads
- Secondary CTA (Share a project): `border border-rich-brown text-rich-brown`

---

### 7. Loading State

6 skeleton cards in the grid. No text, no "Loading..." — the layout builds toward content.

Each skeleton: badge-width block + title block + optional image block + two description lines + footer row. All `animate-pulse bg-soft-grey rounded`.

---

## Content types reference

| Type | Key data fields | Badge vocabulary | Visual signature |
|---|---|---|---|
| Event | title, description, eventDateTime, location, tags, images | Workshop · Open Studio · Skill Share · Talk · Lending | Date prominent top-right |
| Post | title, description, createdAt, tags, images, updates | In Progress · Finished · Seeking Help · Sharing | Dashed left border in `melon-green` |

*No schema changes required.*
