# Testing

Two layers, both under `tests/`:

- **`tests/unit/`** — Vitest unit tests for pure logic and route handlers (jsdom, mocked Prisma, no server/browser).
- **`tests/*.spec.ts`** — Playwright E2E tests against the local dev server.

The spec files are the source of truth for exact assertions — this doc covers
how the suite is wired and how to run it, not a per-test checklist (that rots).

---

## Unit Tests

```bash
npm run test:unit        # run once
npm run test:unit:watch  # watch mode
```

No prerequisites — jsdom, `@/` path aliases, Prisma mocked where needed.

Current coverage lives in `tests/unit/`: validators (`validations`), rate
limiting (`rate-limit`), filtering (`useFilter`), permissions (`permission` —
`canPostAsPage`/`canManagePage`/`canActAsEntity`), visibility helpers
(`visibility`), handles (`handle-server`, `reserved-handles`), auth tokens and
the auth route handlers (`auth-tokens`, `verify-email-route`,
`password-reset-route`, `email-send`), profile update (`profile-update`), and
identity context (`ActiveProfileContext`, `active-page-route`).

---

## E2E Tests (Playwright)

Run against `http://localhost:3000`, serially (`workers: 1`) since they share
the local dev DB.

### Prerequisites

```bash
npm run db:seed:dev   # seed the dev DB (idempotent; global-setup also auto-seeds if empty)
npm run dev           # dev server (Playwright will also start one if absent)
```

`tests/global-setup.ts` seeds the DB if it has no users. `tests/global-teardown.ts`
removes test artifacts after the run (see Cleanup).

### Run

```bash
npm run test:e2e              # all tests (list + html reporter)
npm run test:e2e:report       # run and open the HTML report
npx playwright test --ui      # interactive UI mode
npx playwright test auth      # a single file (substring match)
npx playwright test --project=setup   # just mint the auth sessions
```

### Authentication: cached sessions (storageState)

Logging in through the UI in every test is slow when the suite runs serially.
Instead, a **setup project** logs in once per actor and saves the session:

- `tests/auth.setup.ts` logs in **alice** and **sam** and writes their cookies
  to `tests/.auth/{alice,sam}.json` (gitignored). It runs after the webServer is
  up; the `chromium` project `dependencies: ["setup"]` on it.
- Authenticated specs opt in with `test.use({ storageState: STORAGE_STATE.alice })`
  (or `.sam`) instead of calling `loginAs`. A spec needing a second actor inside
  one test opens `browser.newContext({ storageState: STORAGE_STATE.sam })`.
- The **auth-flow** tests (`auth.spec.ts`) run anonymously — they exercise the
  real login/signup/verify/reset paths, so they must NOT reuse a stored session.

States are captured against the freshly seeded DB, so the session JWTs always
match the current seed. If you reseed mid-session, re-run the setup project.

### Seed actors

Two users are E2E actors (credentials are `handle-prefix : same`, e.g.
`alice@example.com` / `alice`):

| Actor | Handle | Role in fixtures |
|---|---|---|
| alice | `alice.example` | default actor; ADMIN of `portland-makers-guild`; member of `secret-workshop`; follower of `private-pat.example`; owner of `unlisted-zine` |
| sam | `sam.example` | second actor (follow/messaging/cross-account); owner of `secret-workshop` |

Visibility fixtures: `secret-workshop` (PRIVATE), `unlisted-zine` (UNLISTED),
`private-pat.example` (PRIVATE user), `portland-makers-guild` (PUBLIC).

> The seed also contains a `laurel` account (the project owner's real
> personal/admin account). It is **off-limits** to tests — use alice/sam only.

### Spec files

| File | Auth | Covers |
|---|---|---|
| `public.spec.ts` | anonymous | unauthenticated renders (welcome, explore, about, login, signup ±invite, a public profile) — each asserts real content |
| `auth.spec.ts` | anonymous | login (valid/invalid), invite signup, protected-route redirect, session persistence, email-verification gate, password reset, forgot-password neutrality |
| `authoring.spec.ts` | alice | parametrized event/post create → inline-edit → publish → delete; draft cleanup on navigate-away; draft not visible to public; page creation; inline profile edit + cancel |
| `messaging.spec.ts` | alice (+ sam ctx) | send a DM; inbox list + open thread; unread notification dot appears then clears |
| `profile-switching.spec.ts` | alice | switcher lists managed pages; switch identity / back; inbox + outgoing messages scoped to active identity |
| `profile.spec.ts` | alice | follow / unfollow a user |
| `visibility.spec.ts` | mixed | PRIVATE/UNLISTED/PUBLIC enforcement across direct link, search, and explore feed, per actor (anon / non-member / member / owner) |

### Helpers (`tests/helpers/`)

- `auth.ts` — `USERS`, `STORAGE_STATE` paths, `submitLogin`, `loginAs`.
- `profile.ts` — `switchToPage`, `switchToPersonal` (drive the identity switcher).
- `content.ts` — `CONTENT` config + `startDraft` / `createPublishDelete` for the
  shared event/post authoring flow.

### Conventions

- Prefer user-facing locators (`getByRole` / `getByLabel` / `getByText`) and
  web-first assertions (`expect(locator).toBeVisible()`); avoid `waitForTimeout`,
  `networkidle`, and CSS-class selectors.
- Gated content renders the not-found page — assert its `"Page not found"`
  heading positively rather than asserting a name is absent.
- A test should always assert something — no `if (await x.isVisible())` wrapping
  the only assertions (a conditional that's just state-normalization, followed by
  an unconditional assertion, is fine).

---

## Cleanup

Events and posts are deleted by their own tests via the UI. The rest is handled
by `tests/global-teardown.ts` after the full run:

| Data created | Cleaned up |
|---|---|
| Event / Post | deleted via UI by the test |
| Follow (alice ↔ sam) | toggled back by the test |
| Page (`playwright-test-*`) | teardown — `handle startsWith "playwright-test-"` |
| Messages (`Hello from Playwright…`) | teardown — `content startsWith "Hello from Playwright"` |
| Signup user (`tst*`) | teardown — `handle startsWith "tst"` |

If a run is interrupted before teardown, the same patterns clean up manually:

```sql
DELETE FROM "Page" WHERE handle LIKE 'playwright-test-%';
DELETE FROM "Message" WHERE content LIKE 'Hello from Playwright%';
DELETE FROM "User" WHERE handle LIKE 'tst%';
```

---

## Not covered yet (candidate follow-ups)

- **RSVP flow** — public RSVP on a published event.
- **True inbox non-leakage** — the scoping test confirms each identity sees its
  own conversation with sam, but both involve sam, so it can't prove a
  page-exclusive thread stays out of a personal inbox. A PMG↔other-user seed
  conversation would let us assert real non-leakage.
- **Post-as-Page authoring** — creating content under a page identity.
- **Mobile/responsive** — only Desktop Chrome is configured.
