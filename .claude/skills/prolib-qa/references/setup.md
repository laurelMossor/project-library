# QA setup reference

How to bring up the local app and log in as a real user. This is the distilled,
QA-focused version; `tests/TESTING.md` is the fuller source of truth for the test
suite and data-cleanup patterns.

## Bring up the app

| Need | Command |
|---|---|
| Postgres running (dev DB) | `npm run db:start` (brew postgresql@15) |
| Seed the dev DB | `npm run db:seed:dev` — creates `alice, george, dolores, sam, fiona, iris` |
| Dev server | `npm run dev` → http://localhost:3000 |
| Free a stuck port | `npm run kill:dev` (kills 3000–3002) |
| Inspect DB directly | `npm run db:studio` (Prisma Studio) |

Prefer `preview_start` to bring up / attach to the server for the browser session.
If the app errors on missing data, the DB probably isn't seeded — run `npm run db:seed:dev`.
The dev DB must point at `localhost`; the seed/test scripts guard against pointing at prod.

## Logging in as a seeded user

The login flow: go to `/login`, fill the **Email** field and the **Password** field,
click the **Log In** button. Login does a full-page redirect to the callback URL on
success, so wait for the URL to leave `/login`.

**Credentials follow a simple rule — password equals the username:**

| User | Email | Password | Handle |
|---|---|---|---|
| alice | `alice@example.com` | `alice` | `alice.example` |
| george | `george@example.com` | `george` | `george.example` |
| dolores | `dolores@example.com` | `dolores` | `dolores.example` |
| sam | `sam@example.com` | `sam` | `sam.example` |
| fiona | `fiona@example.com` | `fiona` | `fiona.example` |
| iris | `iris@example.com` | `iris` | `iris.example` |

(Use the `username:username` rule rather than `tests/helpers/auth.ts`, which only
hard-codes `alice` and `sam`. The seed creates all six.)

`alice` is the default actor for most flows; use a second user like `george` when a
criterion involves two people (following, messaging, visibility between accounts).

## Routes you'll use a lot

- `/login`, `/signup?invite=…` (signup is invite-only)
- `/explore`, `/events`, `/welcome`, `/about` — public
- `/profile` — private settings (renders heading "Profile Settings", not the name)
- `/u/<handle>` — public user profile
- `/posts/new`, `/events/new`, `/pages/new` — create flows (each creates a draft then
  redirects to a detail page where editing happens via the inline editor)

## Cleanup

Tests run with one worker against the shared dev DB. If QA creates posts/events/pages
during a repro, delete them after (posts and events have delete UI; pages/messages
don't). Manual SQL patterns for leftovers are in `tests/TESTING.md` under "DB Cleanup".
