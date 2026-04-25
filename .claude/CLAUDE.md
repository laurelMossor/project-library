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

When the request touches the closed beta plan specifically, also fetch:

- **Google Doc — Beta Launch Plan**: `1Zjz7i0VSmv1Twy9otR_oq6KHtPexHettzY183VB9zLw` (via `google_drive_fetch`)
- **Notion — ProLib Tickets database**: `2d6453d0-29b0-80e9-9ebf-fce9169b18c6` (via `notion-fetch`, or search with `data_source_url: collection://2d6453d0-29b0-803e-a998-000b1568e9c8`)

## Verifying memory before citing

Memory files carry a 21-day staleness warning, so confirm specifics against the source of truth before relying on them. Before citing any memory that names a specific file, function, field, or enum value:

- Check `prisma/schema.prisma` for schema claims.
- Check current code (via `Grep` / `Read`) for file or function claims.
- When the memory and the code disagree, update the memory so the next session starts from reality.

## Journal workflow

`docs/guidance/JOURNAL.md` is append-at-top. Follow the guidelines in its header when the user asks to add an entry, and wait for that ask before writing one.
