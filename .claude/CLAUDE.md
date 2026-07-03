# Agent bootstrap — The Project Library

You are a build partner on **The Project Library**: a website for creativity, mutuality, and lifelong learning where people share what they're making, run events, lend tools, and find mentors and collaborators.

## How to work here

Skills, referenced files, and live observation of the app are **inputs to your thinking**, not finishing touches. When the user names a skill, points at a file, or asks you to look at the running app:

1. Read the referenced files and guidelines first.
2. Invoke the named skills and let their output shape the plan.
3. Look at the running app when asked, before forming conclusions.

Form your plan *from* those inputs. This produces solutions grounded in the actual codebase and product instead of plausible-looking guesses.

---

## Session start bootstrap

At the start of a new session, before responding to the first substantive request, read these in parallel:

1. `docs/guidance/PROJECT_GUIDELINES.md` — tech stack, conventions, schema tree
2. `docs/guidance/STATUS.md` — current milestone, what's done, what's in flight, blockers. Infer the state of active work from here rather than loading specific tickets upfront.
3. `docs/guidance/JOURNAL.md` — most recent ~5 entries for session-over-session continuity

When the request touches **visibility, privacy, authorization, or any route that reads/lists/mutates user, page, event, post, message, or image data**, also read **`docs/guidance/VISIBILITY_RULES.md`** first — the durable contract for the three-tier model (PUBLIC/UNLISTED/PRIVATE). All enforcement lives in `src/lib/utils/server/visibility.ts`; you *apply* its helpers, never re-implement a gate in a route. The point-in-time leak audit is `docs/audits/visibility-findings-2026-07-03.md`.

When the request touches the closed beta plan specifically, also fetch:

- **Google Doc — Beta Launch Plan**: `1Zjz7i0VSmv1Twy9otR_oq6KHtPexHettzY183VB9zLw` (via `google_drive_fetch`)
- **Notion — ProLib Tickets database**: for any complete filtered list of tickets (by Epic / Priority / Status), follow **`docs/PULL_TICKETS.md`** — query the REST API, not `notion-search` (which silently returns incomplete results).

When tickets sit in the **`QA`** status and the user wants to verify, retest, or accept finished work, use the **`/prolib-qa`** skill. It drafts acceptance criteria from the ticket (most have none), gets the user's approval, drives the local dev app to reproduce/confirm, reports pass/fail with evidence, then writes Status + criteria + a QA note back to Notion immediately after each ticket — no separate confirmation needed.

When the user wants to **plan, triage, sequence, or hand off work** rather than do it inline — "what's next?", "pull the NETWERK tickets and let's plan", "bundle these", "draft a brief for a fresh session", "spec this feature out" — use the **`/prolib-pm`** skill. It loads the project-manager/orchestrator role, runs the session bootstrap, grounds itself in the live codebase, and produces self-contained agent briefs another session can act on cold. It triages and delegates; it does not write feature code.

## Updating ProLib Tickets

Keeping the **Notion — ProLib Tickets** database (`2d6453d0-29b0-80e9-9ebf-fce9169b18c6`, data source `collection://2d6453d0-29b0-803e-a998-000b1568e9c8`) in step with the work is an **expected, authorized part of the workflow** — not a one-off external action. When you implement, QA, or change the scope of a ticket, reflect it on the ticket:

- **Fetch first** (`notion-fetch`) to get the exact property names/schema and current content, then update with `notion-update-page` (`update_properties` for Status/Priority, `insert_content`/`update_content` for body and acceptance criteria).
- Write **grounded** acceptance criteria — tie each to the real route/helper/test and note what was verified (e.g. "`GET /api/pages/{id}` → 404 anon / 200 member"), not aspirational prose.
- Move Status as work lands (e.g. → `QA` when implemented, with AC the user can check against the running app).
- Notion writes are surfaced to the user for awareness; if a write is blocked by the permission classifier mid-task, say what you're updating and why rather than silently dropping it.

## Verifying memory before citing

Memory files carry a 21-day staleness warning, so confirm specifics against the source of truth before relying on them. Before citing any memory that names a specific file, function, field, or enum value:

- Check `prisma/schema.prisma` for schema claims.
- Check current code (via `Grep` / `Read`) for file or function claims.
- When the memory and the code disagree, update the memory so the next session starts from reality.

## Journal workflow

`docs/guidance/JOURNAL.md` is append-at-top. Follow the guidelines in its header when the user asks to add an entry, and wait for that ask before writing one.
