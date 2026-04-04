# Pages: Microsite Feature — Product Doc

## Overview

A **Page** on Project Library is a lightweight microsite — a self-contained, shareable web presence for a person, project, group, or business. Pages are discoverable within the Project Library directory and designed to stand alone as a link someone would share as "their page."

Pages serve a wide variety of creators: improv collectives, tattoo artists, mutual aid projects, small businesses, pet profiles, personal projects, and use cases we haven't imagined yet. The design must be flexible enough to support all of these without becoming a page builder.

---

## Core Principles

- **Identity, not a listing.** A Page should feel like a destination, not a row in a database.
- **Owned by the creator.** The person behind the page controls what's shown and how it's described.
- **Connected to the ecosystem.** Pages are discoverable in the directory and linked to other Project Library features (events, other Pages).
- **Structured flexibility.** Creators choose from a defined set of building blocks rather than freeform layout. The platform controls the vocabulary; the creator controls the content.

---

## Page Schema

Each Page has two layers: **structural fields** (columns on the Page table) and **composable elements** (rows in a related PageElement table).

### Structural Fields (columns on Page)

These fields exist on every page, are rendered in consistent positions (header, directory cards), and are queryable at the platform level.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID / PK | |
| `slug` | STRING, unique | URL path, e.g. `/pages/berkeley-improv-collective` |
| `display_name` | STRING | |
| `tagline` | STRING, nullable | One-liner: what this page is |
| `profile_image` | STRING, nullable | URL/path to logo, headshot, photo |
| `category` | ENUM or STRING | Self-selected type label (e.g. "improv group", "tattoo artist", "mutual aid"). Powers directory filtering. |
| `pinned_post` | RICH TEXT, nullable | Freeform "about me" content block. Displayed prominently on the page. Solves the customization problem without building a page builder. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### Composable Elements (PageElement table)

Everything beyond the structural fields is a **PageElement** — a flexible, orderable, toggleable building block.

```
PageElement {
  id:         PK
  page_id:    FK → Page
  kind:       ENUM
  label:      STRING | NULL   — heading displayed above the value
  value:      STRING          — the content itself
  caption:    STRING | NULL   — supporting text displayed below the value
  url:        STRING | NULL   — optional link target
  sort_order: INT             — controls vertical display order (ORDER BY sort_order ASC)
  visible:    BOOL            — allows hiding without deleting
}
```

**Label / Value / Caption** are three layers of text per element:
- `label` = what goes above (the heading): *"Hours of Operation"*
- `value` = the thing itself: *"Wed–Sat 11am–7pm"*
- `caption` = what goes below (the small print): *"Closed holiday weeks"*

All optional except `value`.

### Element Kinds

| Kind | Label example | Value example | Caption example | URL usage | Cardinality |
|---|---|---|---|---|---|
| `social_link` | *(auto from URL)* | `instagram.com/bee_tattoo` | — | — | Many |
| `cta` | "Now Booking" | "Booking open for July" | "Waitlist open for August" | Link to booking page | One (recommended) |
| `schedule` | "Studio Hours" | "Wed–Sat 11-7" | "By appointment only on Mondays" | — | One |
| `banner_image` | — | `/uploads/banner.jpg` | — | — | One |
| `gallery_image` | — | `/uploads/flash1.jpg` | "Flash sheet, 2024" | — | Many |
| `tags` | — | "short-form, longform, sketch" | — | — | One |
| `date` | "Founded" | "2019" | — | — | Few |
| `members` | "Core Team" | "Jake, Sofia, Ari" | "Open to new members" | — | One |
| `affiliation` | — | "Bay Area Improv Coalition" | — | Link to their Page or external site | Many |
| `text` | *(user-defined)* | *(user-defined)* | *(optional)* | Optional | Many |

**`text` is the escape hatch.** Any field a user needs that doesn't fit an existing kind (rates, pronouns, accessibility info, service area, etc.) can be expressed as a `text` element with a custom label.

**Cardinality** (one vs. many per page) is enforced in application code, not the schema.

---

## sort_order Usage

- Elements render top-to-bottom in ascending `sort_order`.
- Editing UI allows drag-to-reorder (or up/down controls).
- On reorder, re-index all elements 0 through N. (Page element counts are small enough that spacing tricks like incrementing by 10 are unnecessary.)
- Users can freely interleave element kinds. No forced grouping.

---

## Auto-Populated Sections

**Events:** Pages with associated events display an auto-populated upcoming events section. This is not a PageElement — it's a platform-level feature driven by the events system. This is what makes Pages feel alive rather than static.

---

## Prioritization

### P0 — MVP (launch with these)

Structural: slug, display_name, tagline, profile_image, category, pinned_post

Elements: `social_link`, `cta`, `schedule`, `text`

Plus: auto-populated events section, basic directory listing with category filtering

### P1 — Fast Follow

Elements: `banner_image`, `tags`

Features: richer directory search, category refinement

### P2 — Later

Elements: `gallery_image`, `date`, `members`, `affiliation`

Features: bidirectional Page-to-Page relationships, structured tag filtering, members linking to other Pages

---

## Explicit Non-Goals for MVP

- **No theming or color customization.** Identity comes from content, not color schemes. Keeps the directory visually coherent.
- **No custom field definitions.** Users pick from the defined set of kinds. `text` covers edge cases.
- **No page builder / drag-and-drop layout.** Elements are vertically stacked in user-defined order. That's it.
- **No structured data for schedules, members, or tags.** All freeform text for now. Can be upgraded to structured editing later without schema changes.