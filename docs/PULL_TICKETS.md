# Pull Notion Tickets

How to query the **ProLib Tickets** Notion database for any combination of Priority / Status / Epic. Use this any time you need a complete, filtered view of work — bug triage, P0/P1 sweep, "everything in SPATS that's not done," etc.

## Why this doc exists

The Notion MCP `notion-search` tool does **semantic** relevance ranking, not property filtering. It silently returns *some* matching tickets — typically only ~25% of the actual set — and gives no signal that the result is incomplete. For any "give me all X" query, **always query the Notion REST API directly**.

## Database

- **Auth + DB:** both come from `.env.development` — `NOTION_KEY` (the integration token) and `NOTION_TICKETS_DB` (the database URL/ID). Load with `set -a && source .env.development && set +a`.
- **API version header:** `Notion-Version: 2022-06-28`
- **Endpoint:** `POST https://api.notion.com/v1/databases/{db-id}/query`
- **Extracting the DB ID from the env value:** `NOTION_TICKETS_DB` is a URL — pull the 32-char hex out of it and dash-format it `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. The shell snippet below does this inline so you don't have to hardcode anything.

## Schema

| Property | Type | Values |
|---|---|---|
| `Name` | title | (free text) |
| `Priority` | select | `P0`, `P1`, `P2`, `P3`, `Backlog` |
| `Status` | status | `Not started`, `QA`, `In progress`, `Blocked`, `On Hold`, `Done` |
| `Epic` | select | `🎭 SPATS`, `𝚫 ORGS`, `👩‍💻 OPEN_SOURCE`, `🐞 BUGS`, `🌳 TOPICS`, `📜 DOCUMENTATION`, `💡 IDEAS`, `✨ POLISH`, `🥩 MEATUP`, `⌘ NETWERK` |
| `Multi-select` | multi_select | `Feature`, `Design`, `Flair`, `Interface`, `Post`, `Bug`, `Event`, `User`, `Messaging`, `Topics`, `Backend`, `Collections`, `Pages`, `Docs`, `Testing & Security`, `External` |

Note: `Status` uses Notion's `status` property type (not `select`). Filter syntax uses `"status": { ... }`, not `"select": { ... }`.

## The canonical query pattern

```bash
set -a && source .env.development && set +a && \
RAW=$(echo "$NOTION_TICKETS_DB" | grep -oE '[a-f0-9]{32}') && \
DB_ID="${RAW:0:8}-${RAW:8:4}-${RAW:12:4}-${RAW:16:4}-${RAW:20:12}" && \
curl -s -X POST "https://api.notion.com/v1/databases/$DB_ID/query" \
  -H "Authorization: Bearer $NOTION_KEY" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '<filter-json>'
```

Replace `<filter-json>` with one of the recipes below. The `RAW`/`DB_ID` lines extract and dash-format the database ID from `NOTION_TICKETS_DB` so the secret stays in `.env.development`.

## Filter recipes

### All active P0 + P1 (most common — what's left before beta)

```json
{
  "filter": {
    "and": [
      { "or": [
        { "property": "Priority", "select": { "equals": "P0" } },
        { "property": "Priority", "select": { "equals": "P1" } }
      ]},
      { "property": "Status", "status": { "does_not_equal": "Done" } }
    ]
  },
  "page_size": 100
}
```

### All P0 only (any status)

```json
{ "filter": { "property": "Priority", "select": { "equals": "P0" } }, "page_size": 100 }
```

### Everything in a specific epic, active only

```json
{
  "filter": {
    "and": [
      { "property": "Epic", "select": { "equals": "🐞 BUGS" } },
      { "property": "Status", "status": { "does_not_equal": "Done" } }
    ]
  },
  "page_size": 100
}
```

### By Multi-select tag (e.g. all messaging tickets)

```json
{ "filter": { "property": "Multi-select", "multi_select": { "contains": "Messaging" } }, "page_size": 100 }
```

## Filter-shape gotchas

- **Top-level compound is `and` / `or`.** A property filter (`{"property":..., "select":{...}}`) cannot have `and`/`or` inside it. To combine "Priority is P0 OR P1" with "Status ≠ Done", you need an outer `and` containing a nested `or`:
  ```json
  { "and": [ { "or": [ ...priorities ] }, { ...status } ] }
  ```
  A malformed filter returns `0 results` silently — not an error.
- **Status uses `"status"`, not `"select"`** in the filter body even though it looks like a select in Notion.
- **Status `does_not_equal: "Done"`** captures all four active states (Not started / In progress / Blocked / On Hold) in one filter.
- **Epic strings include the emoji** — `"🎭 SPATS"` not `"SPATS"`.
- **Pagination:** Default page size is 100 (max). Most queries fit in one page; if not, the response includes `next_cursor` for pagination.

## Parsing the response

A minimal Python pretty-print:

```bash
| python3 -c "
import json, sys
d = json.load(sys.stdin)
for p in d.get('results', []):
    props = p['properties']
    title = ''.join(t['plain_text'] for t in props['Name']['title']) if props['Name'].get('title') else ''
    pri = (props.get('Priority',{}).get('select') or {}).get('name','?')
    st = (props.get('Status',{}).get('status') or {}).get('name','?')
    epic = (props.get('Epic',{}).get('select') or {}).get('name','—')
    print(f'[{pri}] [{st}] [{epic}] {title}')
    print(f'    {p.get(\"url\",\"\")}')"
```

## Existing in-app endpoint

`GET /api/notion/tickets` ([src/app/api/notion/tickets/route.ts](../src/app/api/notion/tickets/route.ts)) implements this same pattern but is **hardcoded to `Priority=P0` + `Epic=𝚫 ORGS`**. Useful as a reference; not useful as a generic sweep tool unless extended to accept query params.

## Don't use these for completeness

- **`notion-search` MCP tool** — semantic only. Fine for "find tickets about photo captions"; useless for "all P0 tickets."
- **Notion's web UI search bar** — same limitation.

If you need a complete filtered list, always go through the REST API.
