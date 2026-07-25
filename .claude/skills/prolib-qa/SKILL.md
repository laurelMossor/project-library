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
  section), don't just adopt them — they're often **test/route-oriented**, written from the
  diff ("`GET /api/x` → 404", "unit covers the fan-out"). **Reframe each into an observable
  app scenario a user drives,** and **add the edge cases the author didn't list** — the
  empty/duplicate/over-limit input, the non-owner, the second identity, the anon viewer, the
  after-reload state. That reframe is where the real findings come from: a route-level "pass"
  hides the mislabeled button and the badge that won't refresh.
- **Otherwise, draft them from the ticket body.** The bodies are usually rich — a
  prose repro, the offending route, often a developer hypothesis about the cause.
  Extract, don't invent:
  - Bug → list the **steps to reproduce** and the **expected correct behavior**.
  - Feature → turn the description / informal checklist into observable checks.
  - **Visibility/privacy ticket → "correct" is defined by `docs/VISIBILITY_RULES.md`**
    (two-field profile/content model, locked identity stub for PRIVATE profiles,
    404-never-403 for unviewable content). Read it before drafting, so the criteria
    match the contract rather than intuition about how privacy "should" work.

Write each criterion as a **manual test scenario**, not an assertion — a concrete thing
you will *do* in the running app, plus the **observable result** that means it passed.
The goal is to exercise what was built and surface issues a unit test can't see: wrong
copy, a dead link, a stale badge, a missing refresh, a 500 in the console. Phrase them
**action-first** ("do X → see Y") so there's no way to "check" one without having driven
it. Avoid vague lines ("works well", "looks good") — they aren't checkable.

```
- [ ] As alice, open the Tools page → the "Lend a tool" button is visible and opens the form
- [ ] Submit with a blank title → inline validation error, and no listing is created (confirm via hard reload)
- [ ] Submit a valid listing → it appears in alice's "My listings" without a manual refresh
```

**A box gets checked ONLY when you drove that scenario live and saw the expected
result.** A passing unit test, reading the code, or "I wrote it so it works" are **not**
grounds to check a box — driving the real app is the entire point of this skill, because
it catches what those miss (the dead deep-link, the badge that won't clear, the edit that
re-fires). If you didn't drive a scenario, leave it unchecked and say so. Never mark one
scenario "verified" because a *sibling* scenario shares its code path — each row is its
own live drive. When the author of the code is the one QA'ing, this is the exact trap:
high confidence in the diff is not evidence from the running app.

**Show the drafted criteria to the user and wait for approval/edits before testing.**
This 10-second gate is what keeps QA honest — you're testing against *their* definition
of done, not one you made up. The approved criteria are also what gets written back in
step 6, so the next person inherits them.

### 3. Bring up the app

Use the in-app **Browser-pane tools** for everything browser-related — read the page,
click, type, run JS, read network/console — never Bash-driven curl-*of-pages* or the Chrome
MCP. (Bash `curl` is fine for the *anonymous* side of an API gate; see below.) The tools give
a text accessibility snapshot that's fast to read and reason over, which is exactly what
reproduce-and-judge needs. Tool names vary by harness — the capability→tool map is at the top
of [references/preview-tools.md](references/preview-tools.md).

Setup specifics — dev server, seeding, the **login procedure + which seeded users to
use**, the **seeded page/admin map + member edges**, and the **real route paths** — are in
[references/setup.md](references/setup.md). Read it before driving the app. Two things from
it that bite immediately: QA logs in as **alice, sam, or private-pat** (never the `laurel`
personal account), and public profiles live at bare `/<handle>` (there is no `/u/` or
`/profile` route).

**Reseed for a clean baseline before a mutating batch** (`npm run db:seed:dev`); don't carry
dirty state across batches to "reuse" earlier activity — it muddies later checks (leftover
notifications/follows from batch N confuse batch N+1). Generate the state you need fresh,
through the UI.

**Batch criteria by actor to cut login churn.** Multi-actor flows (alice → sam → pat → back)
are the biggest time sink — group everything you do *as* one identity before switching.

The Browser-pane tools have non-obvious mechanics — eval-context persistence, **stale console
logs**, ref-map resets, and **the a11y tree missing overlay/dropdown content** — plus four
verification techniques (fetch-interception, hard-reload, authenticated-`fetch` gate checks,
and direct DB-ground-truth queries). They're in
[references/preview-tools.md](references/preview-tools.md); read it before driving.

### 4. Reproduce & verify

**Test the app, not the API.** Every user-facing acceptance criterion must be driven through
the **UI a real user exercises** — the composer, the Join button, the RSVP form — because a
`fetch`/DB "pass" hides broken client wiring (a button on the wrong handler, a form that never
submits, a link with the right `href` that lands on the wrong screen). `fetch()` and direct DB
reads are legitimate **only** for assertions with *no* UI surface: a raw status code
(403/404/400), a DB invariant, an embed's field shape. If a human would click it, you click it.

**Setup ≠ the feature under test.** Arranging preconditions via DB/script — make pat an editor,
add an event banner, remove a membership, reseed — is fine and expected. The line: *setup* may
use any tool; the *behavior being accepted* goes through the UI. "I inserted the row" is setup;
"the button creates the row" is the test.

**Follow deep-links to their destination — don't trust the `href`.** A link/notification can
carry the correct URL and still land on the wrong screen (a tab that defaults elsewhere, a race,
a redirect). Click it and confirm where you actually end up.

Walk each acceptance criterion in the running app:

- **Translate any production URL to a local repro.** Ticket bodies link to *production*
  records (`theprojectlibrary.com/...` or older `theprojectlibrary.vercel.app/...`)
  whose IDs do **not** exist in your local seed DB. Don't open those links. Instead
  recreate the scenario locally — e.g. "create a fresh post as alice and reproduce the
  field-clearing there." This is the single most common way an agent gets QA wrong here.
- Drive the flow through the UI; after each meaningful action **read the page** to confirm
  state. **The a11y tree misses overlay/dropdown/popover content** — if a menu or
  autocomplete "looks empty," take a screenshot before concluding nothing rendered.
- **Watch console + network as you go** — a clean-looking UI can still be throwing errors or
  failing requests underneath, and a criterion isn't "pass" if the console is erroring.
  **But** the console log is cumulative and replays *stale* compile errors long after a fix —
  never fail a criterion on the log alone; confirm against a fresh page read or hard reload.
- **To prove persistence, hard-reload** (or read the DB) — `router.refresh()`/optimistic UI
  can show the new value without it reaching the DB, and some views don't refetch after a
  mutation. **To prove an effect actually happened, query the DB directly.** To prove an
  endpoint-routing criterion, intercept `fetch`. All in
  [references/preview-tools.md](references/preview-tools.md).
- Mark each criterion **pass / fail / blocked**, capturing evidence: a screenshot for visual
  results, a network/console excerpt for errors, a DB-query result for "the effect persisted."
- **Surface design/UX/scope issues, not just functional bugs.** The highest-value QA output is
  often *not* a checkmark — it's noticing that two features overlap confusingly, a label reads
  wrong, or a shipped behavior contradicts an unwritten product decision. Name it and (with the
  user) file it, even though no AC covers it.
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

1. **Check off the scenarios you drove and passed.** Fetch the ticket's block children,
   find the `to_do` blocks under the "Acceptance Criteria" heading, and PATCH `checked:
   true` **only for scenarios you actually drove live and that passed**. Leave un-driven
   or failed scenarios unchecked — an unchecked box is honest signal, not a gap to paper
   over. If the criteria weren't written yet, append them now, checking only the driven-
   and-passed ones. Never label the section "verified live" unless every checked row was.
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
- **Log in as alice, sam, or private-pat — never `laurel`** (the owner's personal/admin
  account). All three QA actors follow `username:username` (`<user>@example.com` / password =
  username; pat is `pat@example.com` / `pat`). Only alice, sam, private-pat, and laurel are
  seeded — george/dolores/fiona/iris don't exist. Full user + page/admin/member map in
  [references/setup.md](references/setup.md).
- **Routes:** public profiles are bare `/<handle>` (no `/u/`, no `/profile`); owner edit
  mode is `/<handle>?edit=true` (the `edit` param is the source of truth). See setup.md.
- **Signup is rate-limited** (5/hr per IP, keyed `signup:unknown` locally). If a criterion
  needs a brand-new account and you hit the limit, note it rather than treating it as a fail.
- **Console-clean counts — but the log is stale.** Console errors / failed requests during
  a flow fail a criterion; however the console log is cumulative and replays old compile
  errors, so confirm against a fresh page read before failing on it. See
  [references/preview-tools.md](references/preview-tools.md).
- **Notion comments may be permission-blocked.** The integration can move Status and check
  off `to_do` criteria, but POSTing a comment can return "Insufficient permissions" — if so,
  note it and move on; Status + checked criteria are the durable record, the comment is a
  nice-to-have, not a blocker.
- **One worker, shared dev DB.** If you create test data, clean it up (or note it) so the
  next run starts clean — see the cleanup patterns in `tests/TESTING.md`.
