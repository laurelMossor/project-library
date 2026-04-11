When asked to use skills or look at the app before planning, that is the process — NOT a suggestion. Do not write any plan or solution until you have:

1. Read any referenced files/guidelines first
2. Invoked any named skills and let their output shape your thinking
3. Actually looked at the running app if instructed to
Do not form a solution mentally and then invoke skills to decorate it. The skills and observation ARE inputs, not garnish.

---

## Session start bootstrap

At the start of a new session, before responding to the first substantive request, read these in parallel:

1. `docs/guidance/PROJECT_GUIDELINES.md` — tech stack, conventions, schema tree
2. `docs/guidance/STATUS.md` — current milestone, what's done, what's in flight, blockers. Infer the state of active work from here rather than loading specific tickets upfront.
3. `docs/guidance/JOURNAL.md` — most recent ~5 entries for session-over-session continuity
4. Memory index at `~/.claude/projects/-Users-laurelmossor-Code-project-library-v1/memory/MEMORY.md` and any relevant memory files

If the request touches the closed beta plan specifically, also fetch:
- **Google Doc — Beta Launch Plan**: `1Zjz7i0VSmv1Twy9otR_oq6KHtPexHettzY183VB9zLw` (via `google_drive_fetch`)
- **Notion — ProLib Tickets database**: `2d6453d0-29b0-80e9-9ebf-fce9169b18c6` (via `notion-fetch` or search with `data_source_url: collection://2d6453d0-29b0-803e-a998-000b1568e9c8`)

## Verifying memory before citing

Memory files include a 21-day staleness warning for a reason. Before citing any memory that names a specific file, function, field, or enum value:
- Verify against `prisma/schema.prisma` for schema claims
- Verify against current code (`Grep`/`Read`) for file/function claims
- If the memory conflicts with current state, update the memory rather than parroting it

## Journal workflow

`docs/guidance/JOURNAL.md` is append-at-top. Follow the guidelines in its header when the user asks to add an entry. Don't add entries unprompted.
