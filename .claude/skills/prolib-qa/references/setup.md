# QA setup reference

How to bring up the local app, log in, and find the seeded data you'll test against.
This is the distilled, QA-focused version; `tests/TESTING.md` is the fuller source of
truth for the test suite and data-cleanup patterns.

Everything below is derived from `prisma/seed.ts` and `prisma/seed-data/` — if a seed
file changes, re-derive rather than trusting this doc blindly.

## Bring up the app

| Need | Command |
|---|---|
| Postgres running (dev DB) | `npm run db:start` (brew postgresql@15) |
| Seed the dev DB | `npm run db:seed:dev` |
| Dev server | `npm run dev` → http://localhost:3000 |
| Free a stuck port | `npm run kill:dev` (kills 3000–3002) |
| Inspect DB directly | `npm run db:studio` (Prisma Studio) |

Prefer `preview_start` to bring up / attach to the server for the browser session.
If the app errors on missing data, the DB probably isn't seeded — run `npm run db:seed:dev`.
The dev DB must point at `localhost`; the seed/test scripts guard against pointing at prod.

## QA actors — use alice and sam only

The seed loads users from `prisma/seed-data/users/*.json` (one file per user). Only **two**
of them are QA actors. Don't try to log in as george/dolores/fiona/iris — they don't exist.

| Handle | Email | Password | Use for |
|---|---|---|---|
| `alice.example` | `alice@example.com` | `alice` | default actor for almost everything |
| `sam.example` | `sam@example.com` | `sam` | the *second* user (follows, messaging, cross-account visibility) |

The credential rule is **`username:username`** (email `<user>@example.com`, password = the
username) for both. For two-actor flows use **alice + sam**.

> ⛔ **Do not log in as `laurel`.** A third seed user, `laurel`, exists in the data, but it
> is the project owner's **personal/admin account** (real email, env-var password). It is
> off-limits for QA — never authenticate as it. If a criterion seems to require laurel,
> stop and ask the user rather than logging in.

### Login flow

Go to `/login`, fill the **Email** field and the **Password** field, click **Log In**.
Login does a full-page redirect on success, so wait for the URL to leave `/login` before
asserting anything. (Signup is **invite-only** via `/signup?invite=…` and rate-limited to
5/hr per IP — see the skill's "trip up" notes if a criterion needs a fresh account.)

## Seeded pages — who admins what

All six page files in `prisma/seed-data/pages/` are seeded. The file's `creatorHandle`
becomes the page **ADMIN**; `editors[]` become EDITORs. This map lets you pick the right
entity for a criterion without hunting through the UI — and shows which pages a QA actor
can actually edit.

| Page | Handle | Visibility | Admin | QA-editable? | Notable content |
|---|---|---|---|---|---|
| Portland Makers Guild | `portland-makers-guild` | PUBLIC | alice (editor: sam) | ✅ as alice/sam | avatar image, 1 published post, 1 published event — **the go-to page for page-edit / page-authorship / page-avatar tests** |
| Unlisted Zine | `unlisted-zine` | UNLISTED | alice | ✅ as alice | use for "unlisted page" visibility checks |
| Secret Workshop | `secret-workshop` | PRIVATE | sam | ✅ as sam | use for PRIVATE visibility-gate checks (404 for non-members) |
| Spats Improv | `spatsimprov` | PUBLIC | laurel | ❌ owner is off-limits | view-only for QA |
| Baywatch Events | `baywatch` | PUBLIC | laurel | ❌ owner is off-limits | view-only for QA |
| The Project Library | `theprojectlibrary` | PUBLIC | laurel | ❌ owner is off-limits | view-only for QA |

Practical consequence: when a criterion is about **page ownership/editing**, log in as
**alice** and use **portland-makers-guild** (or **sam** + **secret-workshop** for PRIVATE).
The laurel-owned pages are viewable but you can't edit them — and you must not log in as
laurel to do so. If page-edit coverage on a laurel page is genuinely needed, ask the user.

`relationships.json` also seeds: alice↔sam mutual follow, alice & sam both follow
portland-makers-guild, two example conversations (incl. one sent *as* the page), and an
RSVP. So follow/message/RSVP flows already have data to read.

## Routes you'll actually use

These are the real route directories under `src/app/` — there is **no `/u/<handle>`** and
**no `/profile`** route (older docs claimed both; they 404).

- `/login` — auth
- `/<handle>` — **public profile for a user *or* a page** (e.g. `/alice.example`,
  `/portland-makers-guild`). This single `[handle]` route serves both.
- `/<handle>?edit=true` — **owner edit mode.** The `edit` query param is the source of
  truth for edit-vs-preview; the in-page Edit/Preview toggle adds/removes it. You can
  deep-link straight into edit mode with `?edit=true`.
- `/settings` — settings hub (heading "Settings" / "User Settings"; lists Edit Public
  Profile, Edit Personal Information, Manage Connections, and a Page Settings section)
- `/settings/personal-info` — personal-info form, **including the profile-visibility
  selector** (PUBLIC / UNLISTED / PRIVATE)
- `/connections` — manage connections
- `/messages` — messaging
- `/posts/new`, `/events/new`, `/pages/new` — create flows (each creates a *draft* then
  redirects to a detail page where editing happens via the inline editor)
- `/posts/<id>`, `/events/<id>` — detail pages
- ⚠️ **`/events`, `/posts`, `/pages` have NO index route** — only `/new` and `/<id>`.
  Navigating to bare `/events` 404s ("Page not found"). To browse events/posts, use
  `/explore` or a profile's collection, not `/events`.
- `/explore`, `/search`, `/welcome`, `/about`, `/guidelines` — browse/public (verified
  to render; `/explore` is the main browse surface)

## Driving the preview app

The mechanical gotchas of the `preview_*` tools (eval context quirks, stale console logs,
selector vs nodeId, plus two high-value verification techniques) live in
[preview-tools.md](preview-tools.md). Read it before driving the app — a couple of those
gotchas will otherwise cost you retries or a wrong verdict.

## Cleanup

Tests run with one worker against the shared dev DB. If QA creates posts/events/pages
during a repro, delete them after (posts and events have delete UI; pages/messages
don't). Manual SQL patterns for leftovers are in `tests/TESTING.md` under "DB Cleanup".
