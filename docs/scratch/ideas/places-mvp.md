# Places Feature — MVP Plan

## Data Model

Two tables:

### `Place`
```
id, slug, name, address, neighborhood, placeType, description,
accessInfo, topicTags[], submittedById, lastVerifiedAt, createdAt, published
```

### `PlaceSuggestion`
```
id, placeId (nullable), changes (JSON), note, submittedById,
status (pending | approved | rejected), reviewedById, createdAt
```

`placeId` being nullable is the key move — a null `placeId` means it's a suggestion to *create* a new Place, not edit an existing one. Everything flows through the same queue.

`changes` is a JSON diff of only the fields being proposed, making it easy to show a reviewer exactly what changed.

---

## Routes

```
/places               — directory, filterable by topic/type
/places/[slug]        — single place view + suggestion form
/places/new           — submit a new place (creates a suggestion)
/admin/suggestions    — mod queue
```

---

## API

```
GET    /api/places              — list, with tag/type filters
POST   /api/suggestions         — submit new place or edit (authed)
GET    /api/suggestions         — mod only, filter by status
PATCH  /api/suggestions/[id]    — approve or reject (mod only)
```

Approval handler: if `status → approved`, either create the Place (if `placeId` was null) or merge `changes` into the existing Place record and update `lastVerifiedAt`.

---

## Auth

Lean on existing auth. Two permission checks:

- Submitting a suggestion: any logged-in user
- Reviewing suggestions: `role === 'mod'` or `role === 'admin'`

---

## UI

**`/places`** — card grid. Each card shows name, neighborhood, type badge, topic tags. Same tag-filter pattern used elsewhere.

**`/places/[slug]`** — place details, then a collapsible "Suggest a correction" form below. Pre-fills current values, user edits whatever's wrong, submits.

**`/places/new`** — blank version of the same form with a note that it goes to review.

**`/admin/suggestions`** — table of pending suggestions. Each row shows: submitter, place name (or "New Place"), a diff of proposed changes, approve/reject buttons.

---

## Out of Scope for MVP

- Map view
- Unauthed submissions
- Edit history / audit log (data exists for it, just no UI yet)
- Verified badge or staleness warnings

---

## Open Question

Does a submitted new Place go live immediately on approval, or start as `published: false` and need a separate publish step? Recommendation: auto-publish on approval for MVP.
