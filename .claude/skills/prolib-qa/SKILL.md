---
name: prolib-qa
description: >-
  QA / acceptance verification for The Project Library tickets. Use this whenever
  the user wants to QA, verify, test, retest, accept, or "check" a ticket — or sweep
  the QA column — in the ProLib Tickets Notion DB. Triggers include "/prolib-qa",
  "QA this ticket", "verify the inline-edit fix", "does this bug still repro?",
  "what's in the QA queue?", "is this ready to mark Done?", or pasting a ProLib
  ticket URL and asking to check it. The skill pulls the ticket, drafts acceptance
  criteria when the ticket has none (the normal case), gets your approval, drives
  the running local dev app to reproduce/verify, reports pass/fail with evidence,
  then writes Status + acceptance criteria + a QA note back to the ticket immediately
  after each result (no separate confirmation needed). Use it even when the user doesn't
  say the word "QA" but is clearly asking to confirm a finished piece of work behaves
  correctly in the app.
---

# ProLib QA

Verify that a finished ticket actually behaves correctly in the running app, then
record the result. This is **judgment-based acceptance testing**, not a test suite:
you exercise the real flow, *read* what happens, and decide whether it matches intent.

The reason this skill exists: tickets pile up in the **QA** column because most of
them have no written acceptance criteria, so there's no definition of "pass" to check
against. This skill's core move is to **draft that definition from the ticket itself,
get the user to bless it, then verify against it** — which both unblocks the ticket
now and leaves criteria behind for next time.

## Ticket types are flexible

The QA column holds whatever the user is working on — bugs, features, polish, infra.
Detect the kind from the ticket and adapt, rather than forcing one shape:

- **Bug fix** (most common today) → the criteria *are* "the reported bad behavior no
  longer happens, and the correct behavior does." Reproduce the original steps and
  confirm the fix.
- **Feature** → check the feature does what it set out to do. The ticket body often
  already has an informal checklist (`[x] uploads, [ ] captions`) — normalize that.
- **Anything else** (polish, copy, infra) → judge against the ticket's stated intent.

Don't over-think the taxonomy — read the ticket, figure out what "working" means, and
make that concrete and checkable.

---

## Workflow

### 1. Select the ticket(s)

- If the user gave a ticket URL or ID, use it.
- If they said "the QA queue" / "what's in QA" / gave nothing, query the ProLib DB for
  **Status = `QA`** and list what's there (title, priority, epic), then ask which to
  run — or offer to go through them in priority order.

Pull tickets via the REST API, not `notion-search` (which silently returns a partial
set). Follow **`docs/PULL_TICKETS.md`** for the query pattern. Note: `QA` is a real
`Status` value even though that doc's schema table predates it. To get a ticket's full
body (where the repro steps live), fetch its block children — see
[references/notion.md](references/notion.md).

### 2. Draft acceptance criteria → get approval (the normal path)

Most tickets arrive with **no** criteria, so this step is the rule, not the exception.

- **If the ticket already has criteria** (a checklist or an "Acceptance Criteria"
  section), use them as-is.
- **Otherwise, draft them from the ticket body.** The bodies are usually rich — a
  prose repro, the offending route, often a developer hypothesis about the cause.
  Extract, don't invent:
  - Bug → list the **steps to reproduce** and the **expected correct behavior**.
  - Feature → turn the description / informal checklist into observable checks.

Good criteria are **concrete and browser-observable** — each line is something you can
actually drive and see. Avoid vague ones ("works well", "looks good"); they aren't
checkable. Aim for a short checklist:

```
- [ ] Logged-in user can open the "Lend a tool" form from the Tools page
- [ ] Submitting with a blank title shows a validation error; no row is created
- [ ] On success the tool appears in the owner's "My listings" without a reload
```

**Show the drafted criteria to the user and wait for approval/edits before testing.**
This 10-second gate is what keeps QA honest — you're testing against *their* definition
of done, not one you made up. The approved criteria are also what gets written back in
step 6, so the next person inherits them.

### 3. Bring up the app

Use the **native preview tools** for everything browser-related (`preview_start`,
`preview_snapshot`, `preview_click`, `preview_fill`, `preview_console_logs`,
`preview_network`, `preview_screenshot`, …) — never Bash-driven curl-of-pages or the
Chrome MCP. The preview tools give a text accessibility snapshot that's fast to read
and reason over, which is exactly what reproduce-and-judge needs.

Setup specifics — dev server, seeding, and the **login procedure + seeded test users**
— are in [references/setup.md](references/setup.md). Read it before driving the app so
the login step is exact.

### 4. Reproduce & verify

Walk each acceptance criterion in the running app:

- **Translate any production URL to a local repro.** Ticket bodies link to *production*
  records (`theprojectlibrary.com/...` or older `theprojectlibrary.vercel.app/...`)
  whose IDs do **not** exist in your local seed DB. Don't open those links. Instead
  recreate the scenario locally — e.g. "create a fresh post as alice and reproduce the
  field-clearing there." This is the single most common way an agent gets QA wrong here.
- Drive the flow with preview tools; after each meaningful action take a `preview_snapshot`
  to confirm state.
- **Watch `preview_console_logs` and `preview_network` as you go** — a clean-looking UI
  can still be throwing errors or failing requests underneath. A criterion isn't "pass"
  if the console is erroring.
- Mark each criterion **pass / fail / blocked**, capturing evidence: a `preview_screenshot`
  for visual results, a log/network excerpt for errors. Evidence is what lets the user
  trust the verdict without re-checking by hand.
- If something is **ambiguous** (criterion underspecified, behavior arguably-correct,
  needs design judgment) — flag it for the user, don't guess a verdict.

### 5. Report to the user

Report the result in chat. Use this shape:

```
## QA: <ticket title>  (<priority> · <epic>)

Verdict: PASS / FAIL / NEEDS REVIEW

| Criterion | Result | Evidence |
|---|---|---|
| <criterion 1> | ✅ pass | <screenshot / note> |
| <criterion 2> | ❌ fail | <what happened + console/network excerpt> |

Notes: <anything ambiguous, out-of-scope observations, flaky behavior>
```

If the verdict is **NEEDS REVIEW** or the result is ambiguous, pause and ask the user
before writing anything. Otherwise proceed directly to step 6.

### 6. Write back to Notion — immediately after each ticket

Write to Notion right after reporting each ticket's result. Don't batch across tickets
or wait for a separate user confirmation. Do all three:

1. **Check off the acceptance criteria in the ticket body.** Fetch the ticket's block
   children, find the `to_do` blocks under the "Acceptance Criteria" heading, and PATCH
   each one to `checked: true`. If the criteria haven't been written yet (step 2 was
   skipped or deferred), append them now with `checked: true` for passed items.
2. **Move Status** — `Done` on pass, `In progress` (or as directed) on fail.
3. **Add a QA-result comment** — the verdict + date + a one-line summary of what was
   checked.

The exact REST recipes (fetch blocks, PATCH to_do checked, PATCH status, POST comment)
are in [references/notion.md](references/notion.md).

**Exception:** if the user explicitly says to defer Notion writes (e.g. "don't touch
Notion yet"), respect that for the current run.

### 7. Optional: lock in a regression test

When a bug fix passes and the repro is now known and stable, offer to promote it into a
permanent Playwright spec under `tests/` so it can't silently regress. The repro you
just performed *is* the test script. Don't do this for every ticket — reserve it for
flows worth guarding (auth, posting, events, messaging, anything previously broken).
See `tests/TESTING.md` for the existing suite's conventions and helpers.

---

## Things that trip up QA here (read once)

- **Prod URLs ≠ local data.** Recreate the scenario locally; never test against the prod
  link in the ticket. (Restated because it's the #1 failure mode.)
- **Login is `username:username`.** Seeded users log in with email `<user>@example.com`
  and password equal to the username. See [references/setup.md](references/setup.md).
- **Signup is rate-limited** (5/hr per IP, keyed `signup:unknown` locally). If a criterion
  needs a brand-new account and you hit the limit, note it rather than treating it as a fail.
- **Console-clean counts.** Treat console errors / failed network calls during a flow as a
  failed criterion even if the visible UI looks fine.
- **One worker, shared dev DB.** If you create test data, clean it up (or note it) so the
  next run starts clean — see the cleanup patterns in `tests/TESTING.md`.
