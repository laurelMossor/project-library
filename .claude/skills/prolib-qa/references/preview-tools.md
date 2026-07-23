# Driving the app for QA — tools, gotchas & verification techniques

Exercise the running app through the in-app **Browser pane** tools, never Bash-curl-of-pages
(for *page* views) or the Chrome MCP. This page covers which tool does what, the non-obvious
mechanics that cost retries or a wrong verdict, and the verification techniques that make a
verdict decisive. Read it once before a QA run.

> **Tool names vary by harness — this doc is capability-first.** The concepts below are
> stable; the concrete tool names differ between environments. In the current harness the
> Browser-pane tools are:
>
> | Capability | Tool | Notes |
> |---|---|---|
> | start / attach the dev server | `preview_start` (by `name` from `.claude/launch.json`) | returns a `tabId` — pass it to every other call |
> | go to a URL / back / forward | `navigate` | needs `tabId` |
> | read the page (accessibility tree) | `read_page` | returns `ref_N` handles for elements |
> | click / type / screenshot / scroll | `computer` (`left_click`, `type`, `screenshot`, `scroll`, …) | click by `ref` (from read_page) or `coordinate` |
> | fill a form field | `form_input` | by `ref` |
> | run JS in the page | `javascript_tool` (`javascript_exec`, arg `text`) | the workhorse for assertions |
> | network requests | `read_network_requests` | list, or fetch one body by id |
> | console messages | `read_console_messages` | cumulative — see below |
>
> Older versions of this doc named these `preview_eval` / `preview_click` /
> `preview_snapshot` / `preview_network` / `preview_console_logs` / `preview_screenshot` /
> `preview_fill`; if you see those, they map onto the row above.

## Tool-usage gotchas

- **`navigate` and every `computer` / `read_page` call need the `tabId`** returned by
  `preview_start`. Omitting it errors.
- **Click by `ref` from a *fresh* `read_page`.** After any navigation the ref map resets
  ("ref map not initialized; call read_page first"), and opening a menu/expander changes
  the refs — re-read before clicking. If there's no clean handle, click via JS:
  `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim()==='Edit')?.click()`
- **`read_page` (the a11y tree) misses portal/overlay content.** Autocomplete dropdowns,
  popovers, menus, and toast results often don't appear in the tree even when they're on
  screen. **Before concluding "no results" / "nothing happened," confirm with a `computer`
  screenshot** — an empty tree is *not* proof of an empty UI. (This one bit a real run: a
  member-search dropdown was showing a result the tree didn't list.)
- **The JS eval context persists across calls.** A top-level `const x = …` makes the *next*
  call that also declares `x` throw `Identifier 'x' has already been declared`. Use bare
  expressions, `var`, or wrap in an IIFE. Reloading the page clears it.
- **Console messages are cumulative and go stale.** They replay compile/parse errors from
  *earlier* edits long after the file is fixed. **Never conclude a page is broken from the
  console alone** — confirm against a fresh `read_page` or a hard reload of the actual page.
- **HMR can preserve stale component state** across edits. If behavior looks wrong right
  after editing, hard-reload (`location.href = location.href` via JS, or re-navigate) and
  re-check on a clean load before trusting it.
- **Form typing:** `form_input` sets the value directly; for debounced inputs that need
  real keystroke events (search boxes), use `computer` `type`. Don't do both to one field —
  you'll get "patpat". To replace a field's contents, `triple_click` it first, then `type`.

## Verification techniques — reach for these

Screenshots and the a11y tree prove *what the user sees*. For where an action goes, whether
it persisted, and invariants with no UI, use the four below.

### 1. Intercept `fetch` to prove *where* an action goes

When a criterion is "this action persists to the right place" (e.g. a page role change must
`PUT /api/pages/{id}/members/{userId}`), a screenshot won't prove it — the request does.
Install an interceptor on a fresh load, perform the action, then read the log:

```js
// call 1 — install (fresh load, so it isn't double-wrapped)
(function(){ window.__mut=[]; const o=window.fetch; window.fetch=function(u,opt){
  if(opt&&opt.method&&opt.method!=='GET'){window.__mut.push({m:opt.method,url:String(u),body:opt.body});}
  return o.apply(this,arguments);}; return 'installed'; })()
```
```js
// call 2 — after clicking Save/Approve/Remove
JSON.stringify(window.__mut)
```

Decisive evidence for endpoint-routing and payload-shape criteria.

### 2. Hard-reload to prove *persistence*

`router.refresh()` / optimistic UI can show the new state without it reaching the DB, and
some views don't refetch after a mutation (see the connections stale-count bug). To prove a
change persisted, re-navigate fresh and re-read — or confirm in the DB (technique 4).

### 3. Authenticated `fetch()` to assert an API gate directly

For invariant checks with **no UI surface** — a permission returns 403, a non-member gets
404, the last-admin guard returns 400, an endpoint returns 200 for a member — a same-origin
`fetch()` from the logged-in session is faster and more decisive than constructing the UI
path. The session cookie rides along, so it asserts the gate *as the logged-in user*.

```js
(async () => {
  const out = {};
  out.demoteLastAdmin = (await fetch('/api/pages/PMG_ID/members/ALICE_ID',
    {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({role:'MEMBER'})})).status;  // expect 400
  out.privatePostAsMember = (await fetch('/api/posts/PRIVATE_POST_ID')).status;  // expect 200 as member
  return JSON.stringify(out);
})()
```

For the **anonymous** side of a gate (anon → 404), a plain Bash `curl` (no session cookie)
is the cleanest way to hit it logged-out:
`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/posts/<id>`.

**This is for invariant/gate assertions, not for the feature itself.** A user-facing
criterion ("clicking Join creates a request") must be driven through the **UI** — see the
UI-first rule in SKILL.md. Use `fetch` for the raw-status checks the UI can't show, never to
skip the button.

### 4. Query the dev DB for ground truth

When "did it actually happen" matters — a Follow materialized after approve, a Permission
role changed, an AccessRequest was deleted on deny — read the DB directly instead of
inferring from a UI whose counts can be stale.

**Gotcha that costs a call:** a naive `new PrismaClient()` throws — the app uses a pg
adapter. Import the app's configured client and run via `tsx` with dev env loaded:

```bash
set -a && source .env.development && set +a
npx tsx -e '
import { prisma } from "./src/lib/utils/server/prisma";
(async () => {
  const perms = await prisma.permission.findMany({
    where: { resourceType: "PAGE" },
    include: { user: { select: { handle: true } } },
  });
  console.log(JSON.stringify(perms, null, 2));
  await prisma.$disconnect();
})();
' 2>&1 | grep -v dotenv
```

Use it for setup (arranging preconditions) *and* truth (verifying an effect) — but the
*behavior under test* still goes through the UI.

### Embed-leak check — what "attribution-only" means

When a criterion is "embedded author/page objects carry no sensitive fields," the **allowed**
attribution keys are: `id`, `handle`, `displayName`/`name`, `firstName`, `lastName`,
`avatarImage` (+`avatarImageId`). Anything else — `bio`, `location`, `interests`,
`aboutContent`, `email`, `headline`, `profileVisibility`, `contentVisibility` — is a leak.
Fetch the content JSON and diff the embed's keys against that forbidden set.

## Recording evidence

- `computer` screenshot for visual results (before/after) — and to confirm overlay UI.
- A `read_network_requests` excerpt (status + path) for API-routing criteria.
- The `__mut` / console excerpt for "went to the right endpoint" / "no errors" criteria.
- A DB-query result for "the effect actually persisted."

Evidence is what lets the user trust the verdict without re-checking by hand — capture it as
you go, not after.
