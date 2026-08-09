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

## Writing back (step 6 — immediately after each ticket)

Do **both** on a pass; on a fail, skip checking off criteria if the user prefers, and
set Status as directed. (There is no third step — do **not** post a comment; see below.)

### 1. Check off existing acceptance criteria in the ticket body

The criteria were written as unchecked `to_do` blocks in step 2. After testing, fetch
the ticket's block children, find the `to_do` blocks, and PATCH each to `checked: true`:

```bash
# First, fetch block children to get the to_do block IDs
curl -s "https://api.notion.com/v1/blocks/$PAGE_ID/children?page_size=100" \
  -H "Authorization: Bearer $NOTION_KEY" -H "Notion-Version: 2022-06-28" \
  | jq '[.results[] | select(.type=="to_do") | {id:.id, text:(.to_do.rich_text[0].plain_text)}]'

# Then PATCH each to_do block to checked: true
BLOCK_ID="<block id from above>"
curl -s -X PATCH "https://api.notion.com/v1/blocks/$BLOCK_ID" \
  -H "Authorization: Bearer $NOTION_KEY" -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"to_do": {"checked": true}}'
```

If criteria haven't been written yet, append them now (already checked for passes):

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

### ~~3. Add a QA-result comment~~ — DON'T

Do **not** post a comment. This integration lacks comment-insert, so `POST /v1/comments`
returns `403 "Insufficient permissions for this endpoint."` **every time** — a
guaranteed-failing call, not something to attempt-and-note. The **checked-off criteria +
Status are the durable audit trail**; put the verdict/date summary in your chat report to
the user instead. (If the integration is ever granted comment-insert, revisit this.)

## Gotchas

- A malformed filter returns `0 results` **silently** (not an error) — see the filter-shape
  notes in `docs/PULL_TICKETS.md`.
- **If you write back with the Notion MCP tools** instead of curl (`notion-update-page`
  rather than the PATCH recipes above), a bulk checkbox flip uses `update_content` with
  **`replace_all_matches: true`** on `"- [ ]" → "- [x]"` — the field is `replace_all_matches`,
  **not** `replace_all` (that name silently no-ops / errors on multiple matches). Both the
  curl path above and the MCP path get the same result; just don't guess the field name.
- The integration must be shared with the ticket's page for writes to succeed; if a PATCH/POST
  returns a permission error, that's why — surface it to the user rather than retrying blindly.
- **Never post comments — they 403 unconditionally.** PATCH page Status and PATCH `to_do`
  `checked` both work, but `POST /v1/comments` returns `"Insufficient permissions for this
  endpoint."` **every time** (the integration lacks comment-insert). Don't attempt it — it's not
  a "note it and move on" case, it's a call to skip. The Status move + checked criteria are the
  durable record. (If the user enables comment-insert on the integration later, revisit.)
