# Driving the preview app — gotchas & verification techniques

The `preview_*` tools are the right way to exercise the running app (never Bash-curl or
the Chrome MCP). A handful of their mechanics aren't obvious and cost retries — or, worse,
a wrong verdict — if you don't know them. Read this once before a QA run.

## Tool-usage gotchas

- **`preview_eval` takes `expression`, not `script`.** Pass a single JS expression.
- **The eval JS context persists across calls.** A `const x = …` in one call makes the
  *next* call that also declares `x` throw `Identifier 'x' has already been declared`. Use
  bare expressions, `var`, or wrap in an IIFE — don't reuse top-level `const`/`let` names.
  Reloading the page clears the context.
- **`preview_click` needs a CSS `selector`**, not the numeric nodeId from a snapshot. If
  there's no clean selector, click via eval:
  `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim()==='Edit')?.click()`
- **`preview_network` `filter` only accepts `all` or `failed`** — not an arbitrary
  substring. Fetch `all` and grep the result yourself.
- **`preview_console_logs` is cumulative and goes stale.** It replays compile/parse errors
  from *earlier* edits long after the file is fixed — the same error can appear dozens of
  times. **Never conclude a page is broken from console_logs alone.** Confirm against a
  fresh `preview_snapshot` (or a hard reload) of the actual page before calling a criterion
  failed. A clean snapshot beats a stale error log.
- **HMR can preserve stale component state** across edits (e.g. an inline field left
  "open"). If behavior looks wrong right after you've been editing, do a hard reload
  (`location.href = location.href` via eval, or re-navigate) and re-check on a clean load
  before trusting it.

## Two verification techniques worth reaching for

### 1. Intercept `fetch` to prove *where* an action goes

When a criterion is "this action persists to the right place" (e.g. a page avatar must
PUT to `/api/pages/{id}`, not `/api/me/user`), a screenshot won't prove it — the request
does. Install an interceptor, perform the action, then read the log:

```js
// call 1 — install (do this on a fresh load so it isn't double-wrapped)
window.__putLog = [];
const orig = window.fetch;
window.fetch = function(url, opts){
  if (opts && opts.method === 'PUT') window.__putLog.push({url:String(url), body:opts.body});
  return orig.apply(this, arguments);
};
'installed'
```
```js
// call 2 — after clicking Save/Remove
JSON.stringify(window.__putLog)
```

This is the decisive evidence for endpoint-routing and payload-shape criteria.

### 2. Hard-reload to prove *persistence*

`router.refresh()` / optimistic UI can show the new state without it having reached the DB.
To prove a change persisted, re-navigate to the page fresh (`location.href = '/<handle>?edit=true'`)
and re-snapshot. The avatar/headline/description "persists after reload" criteria all hinge
on this — the in-place update is necessary but not sufficient.

## Recording evidence

- `preview_screenshot` for visual results (before/after).
- A `preview_network` excerpt (status + path) for API-routing criteria.
- The `__putLog`/console excerpt for "went to the right endpoint" / "no errors" criteria.

Evidence is what lets the user trust the verdict without re-checking by hand — capture it
as you go, not after.
