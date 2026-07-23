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

## QA actors — alice, sam, and private-pat

The seed loads users from `prisma/seed-data/users/*.json` (one file per user). **Three** are
QA actors (below); a fourth, `laurel`, is off-limits (see the callout). Don't try to log in
as george/dolores/fiona/iris — they don't exist.

| Handle | Email | Password | Use for |
|---|---|---|---|
| `alice.example` | `alice@example.com` | `alice` | default actor for almost everything |
| `sam.example` | `sam@example.com` | `sam` | the *second* user (follows, messaging, cross-account visibility) |
| `private-pat.example` | `pat@example.com` | `pat` | the **PRIVATE user** — essential for request-to-follow, locked-stub, and PRIVATE-profile checks. Profile **and** content are PRIVATE. |

The credential rule is **`username:username`** (email `<user>@example.com`, password = the
username) for all three. For two-actor flows use **alice + sam**; reach for **private-pat**
whenever a criterion needs a private *user* (as opposed to the private *page*,
`secret-workshop`).

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

All six page files in `prisma/seed-data/pages/` are seeded — with one gate: `laurel`
uses a `$env:` password, and when that env var is unset (CI, a fresh contributor) the
seed **skips laurel and the three laurel-owned pages**. If those pages are missing
locally, that's why, not a bug. The file's `creatorHandle` becomes the page **ADMIN**;
`editors[]` become EDITORs. This map lets you pick the right
entity for a criterion without hunting through the UI — and shows which pages a QA actor
can actually edit.

Visibility is two fields per `docs/VISIBILITY_RULES.md`: **profile** (PUBLIC/PRIVATE —
full profile vs identity-only locked stub) and **content** (LISTED/UNLISTED/PRIVATE —
where posts/events surface).

| Page | Handle | Profile / content vis | Admin | QA-editable? | Notable content |
|---|---|---|---|---|---|
| Portland Makers Guild | `portland-makers-guild` | PUBLIC / LISTED | alice (editor: sam) | ✅ as alice/sam | avatar image, 1 published post, 1 published event — **the go-to page for page-edit / page-authorship / page-avatar tests** |
| Unlisted Zine | `unlisted-zine` | PUBLIC / UNLISTED | alice | ✅ as alice | use for "unlisted content" checks (on the profile, never in Explore/feeds) |
| Secret Workshop | `secret-workshop` | PRIVATE / PRIVATE | sam | ✅ as sam | use for PRIVATE checks: non-member viewers (anon *and* logged-in) get the **identity-only locked stub** with a request-to-follow/join affordance — not a 404; the page's JSON collection routes (`/api/pages/[id]/posts`, `/events`) do 404 |
| Spats Improv | `spatsimprov` | PUBLIC / LISTED | laurel | ❌ owner is off-limits | view-only for QA |
| Baywatch Events | `baywatch` | PUBLIC / LISTED | laurel | ❌ owner is off-limits | view-only for QA |
| The Project Library | `theprojectlibrary` | PUBLIC / LISTED | laurel | ❌ owner is off-limits | view-only for QA |

Practical consequence: when a criterion is about **page ownership/editing**, log in as
**alice** and use **portland-makers-guild** (or **sam** + **secret-workshop** for PRIVATE).
The laurel-owned pages are viewable but you can't edit them — and you must not log in as
laurel to do so. If page-edit coverage on a laurel page is genuinely needed, ask the user.

### Seeded members & relationships (they decide who can view/act)

The seed grants more edges than the admin/editor columns above — these determine who can
already see private content or approve things, so know them before picking actors:

- **Page members (Permission rows):**
  - `portland-makers-guild` — alice **ADMIN**, sam **EDITOR**, *and* laurel + private-pat as **MEMBER**.
  - `secret-workshop` — sam **ADMIN**, *and* **alice is a seeded MEMBER** (so alice can view its
    private profile + content without any setup; use a *different* actor when you need a
    non-member).
- **Follows** (`relationships.json`): alice↔sam mutual; alice→PMG and sam→PMG; and
  **alice→private-pat** (so alice already sees pat's private profile; anon/sam do not).
- **Pending access request:** **sam→private-pat (FOLLOW)** — a ready-made pending request for
  the approve/deny flow (log in as pat to act on it).
- **Conversations:** an alice↔sam DM, and a sam↔PMG thread (one message sent *as* the page).
- **RSVP:** alice → one of sam's events.

> When a criterion hinges on a *precise* edge (who's a member of what, does X follow Y),
> **verify against a DB dump** rather than trusting this list — the seed drifts. The
> permissions query in [preview-tools.md](preview-tools.md) §4 prints the whole map.

### Images & attachments (seed drift to know)

- The `ImageAttachment` field is **`type`** (an `AttachmentTarget` enum: `POST` / `EVENT` /
  `PAGE` / …), **not `targetType`** (the name in the PROJECT_GUIDELINES diagram is stale).
  Query it as `where: { type: "EVENT" }`, not `targetType`.
- **Editable events ship with no banner** anymore — only the (off-limits) laurel-owned
  `spatsimprov` event has a seeded banner image. An event banner/cover is the sortOrder-0
  `ImageAttachment` (the Event model has no `coverImageId`). If a criterion needs an editable
  event *with* a banner, add one as a precondition (create an `Image` + an
  `ImageAttachment{ type:"EVENT", sortOrder:0 }`, mirroring `prisma/seed.ts`).
- **Post *image upload* was regressed** as of 2026-07-23 (a separate open bug) — some seeded
  posts still carry images, but you can't add new ones via the UI. Caption/upload criteria
  are blocked until that's fixed; don't mark them pass or fail — note the blocker.

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
- `/settings/personal-info` — personal-info form, **including both visibility
  selectors**: profile visibility (PUBLIC / PRIVATE) and content visibility
  (LISTED / UNLISTED / PRIVATE). They are independent fields — see
  `docs/VISIBILITY_RULES.md` for what each governs (a PRIVATE profile can't pair
  with LISTED content; the UI hides that option).
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
