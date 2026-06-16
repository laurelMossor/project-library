# Notion: reading tickets & writing QA results back

All calls use the same auth/DB env as the rest of the repo. Load it first:

```bash
set -a && source .env.development && set +a
# NOTION_KEY = integration token, NOTION_TICKETS_DB = DB URL (contains the 32-char id)
```

API version header is always `Notion-Version: 2022-06-28`.

## Reading

To **list / filter** tickets (e.g. everything in `QA`), follow the canonical query in
`docs/PULL_TICKETS.md`. Status filter for the QA column:

```json
{ "filter": { "property": "Status", "status": { "equals": "QA" } }, "page_size": 100 }
```

To read a **single ticket's body** (repro steps, checklists, dev notes live here), fetch
its block children:

```bash
PAGE_ID="<ticket id>"   # the page id from the query results (dashed uuid)
curl -s -X GET "https://api.notion.com/v1/blocks/$PAGE_ID/children?page_size=100" \
  -H "Authorization: Bearer $NOTION_KEY" -H "Notion-Version: 2022-06-28"
```

`paragraph`, `to_do`, `bulleted_list_item`, and `heading_*` blocks carry the text under
their `<type>.rich_text[].plain_text`. `to_do` blocks also have a `checked` boolean —
that's where informal acceptance checklists show up.

## Writing back (step 6 — only on the user's say-so)

Do all three on a pass; on a fail, skip the criteria-persist if the user prefers, and
set Status as directed.

### 1. Persist approved acceptance criteria into the ticket body

Append an "Acceptance Criteria" heading + a `to_do` per criterion. Mark verified ones
`checked: true`.

```bash
curl -s -X PATCH "https://api.notion.com/v1/blocks/$PAGE_ID/children" \
  -H "Authorization: Bearer $NOTION_KEY" -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "children": [
      { "object": "block", "type": "heading_3",
        "heading_3": { "rich_text": [ { "text": { "content": "Acceptance Criteria" } } ] } },
      { "object": "block", "type": "to_do",
        "to_do": { "rich_text": [ { "text": { "content": "<criterion 1>" } } ], "checked": true } },
      { "object": "block", "type": "to_do",
        "to_do": { "rich_text": [ { "text": { "content": "<criterion 2>" } } ], "checked": false } }
    ]
  }'
```

### 2. Move Status

`Status` is a `status`-type property — use `"status"`, not `"select"`. Pass → `Done`;
fail → `In progress` (or whatever the user directs). Valid values: `Not started`, `QA`,
`In progress`, `Blocked`, `On Hold`, `Done`.

```bash
curl -s -X PATCH "https://api.notion.com/v1/pages/$PAGE_ID" \
  -H "Authorization: Bearer $NOTION_KEY" -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{ "properties": { "Status": { "status": { "name": "Done" } } } }'
```

### 3. Add a QA-result comment

A short audit trail: verdict, date, one line on what was checked. (Pass the date in
explicitly — don't rely on a generated timestamp.)

```bash
curl -s -X POST "https://api.notion.com/v1/comments" \
  -H "Authorization: Bearer $NOTION_KEY" -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": { "page_id": "'"$PAGE_ID"'" },
    "rich_text": [ { "text": { "content": "QA PASS (2026-06-15): verified inline description holds on blur and persists after Save; no console errors." } } ]
  }'
```

## Gotchas

- A malformed filter returns `0 results` **silently** (not an error) — see the filter-shape
  notes in `docs/PULL_TICKETS.md`.
- The integration must be shared with the ticket's page for writes to succeed; if a PATCH/POST
  returns a permission error, that's why — surface it to the user rather than retrying blindly.
