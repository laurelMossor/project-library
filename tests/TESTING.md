# Testing

Two layers of tests, both living under `tests/`:

- **`tests/unit/`** — Vitest unit tests for pure business logic (no server, no browser)
- **`tests/*.spec.ts`** — Playwright E2E tests running against the local dev server

---

## Unit Tests

```bash
npm run test:unit        # run once
npm run test:unit:watch  # watch mode
```

No prerequisites. Tests run in jsdom and use `@/` path aliases.

### Test Files

| File | What it covers |
|---|---|
| `unit/validations.test.ts` | All validators: `validateEmail`, `validateUsername`, `validatePassword`, `validateMessageContent`, `validatePostData`, `validateEventData`, `validatePageData` |
| `unit/rate-limit.test.ts` | `checkRateLimit` — allowed/denied counts, remaining decrement, window reset via `vi.useFakeTimers()`, independent keys |
| `unit/useFilter.test.ts` | `useFilter` hook — type filter, tag filter, sort (newest/oldest), `availableTags`, filter composition, `initialValues` |
| `unit/permission.test.ts` | **⚠️ INTENTIONALLY FAILING** — placeholder blocking CI until `canPostAsPage` tests are written (mid-refactor) |

**Note on sort:** events sort by `eventDateTime`, posts sort by `createdAt`. Tests assert on item ID order to account for this. Note: This will likely change depending on the page view. 

---

## E2E Tests (Playwright)

Playwright tests running against the local dev server (`http://localhost:3000`). Tests run serially (1 worker) since they share the local dev database.

### Prerequisites

```bash
npm run db:seed:dev   # seed alice, george, dolores, sam, fiona, iris
npm run dev           # dev server must be running
```

### Run

```bash
npm run test:e2e              # run all tests (list reporter)
npm run test:e2e:report       # run and open HTML report
npx playwright test --ui      # interactive UI mode
npx playwright test auth      # run a single file
```

### Test Files

#### `public.spec.ts` — unauthenticated renders
No login required. Visits each public route and asserts it renders without a 500/error.

| Test | Route | Asserts |
|---|---|---|
| /welcome loads | `/welcome` | no Application error |
| /explore loads | `/explore` | no Application error, networkidle |
| /about loads | `/about` | no Application error |
| /login form renders | `/login` | email + password inputs, Log In button visible |
| /signup form renders | `/signup` | email + username + password inputs, Sign Up button visible |
| /events listing loads | `/events` | no Application error |
| seeded user profile loads | `/u/alice` | "Alice" text present |

---

#### `auth.spec.ts` — authentication flows

| Test | Actor | Flow | Asserts |
|---|---|---|---|
| valid login | alice | fill login form → submit | URL leaves /login |
| invalid login | alice | wrong password → submit | "Invalid email or password" shown, stays on /login |
| signup | new user (`tst{n}`) | fill signup form → submit | redirects to /login OR shows rate-limit message |
| protected route redirect | unauthenticated | `GET /u/profile` | redirected to /login |
| session persists | alice | login → reload → visit /u/profile | no redirect, "Alice" visible |

**Known gotcha:** `/api/auth/signup` has an in-memory rate limit of 5 signups/hr per IP. Headless Playwright sends no `X-Forwarded-For` header, so all requests share the key `signup:unknown`. The signup test accepts either a successful redirect or the rate-limit error message so it doesn't fail on repeated local runs.

---

#### `authoring.spec.ts` — create content (all as alice)

| Test | Flow | Asserts |
|---|---|---|
| create, publish, and delete event | `GET /events/new` → draft → inline-edit title → inline-edit description → Publish → Delete Event → confirm → Delete | "Live" badge appears; redirects to `/collections` after delete |
| create and delete post | `GET /posts/new` → fill title + content → Post → Delete Post → confirm → Delete | redirects to `/posts/[id]`; redirects to `/explore` after delete |
| create a page | `GET /pages/new` → fill name + slug → Create Page → verify at `/p/[slug]` | redirects to `/u/profile`, page accessible at slug |

**Event and post delete:** Both use a two-step confirm dialog — "Delete Event"/"Delete Post" button reveals "Are you sure?" with a red "Delete" confirm button.

**Event creation detail:** `/events/new` immediately creates a draft via API and redirects to the event detail page. Editing happens via `InlineEditable` — clicking a field activates an input and shows Save/Cancel buttons.

**Cleanup status:**
- Events — fully cleaned up by the test (deleted at end)
- Posts — fully cleaned up by the test (deleted at end)
- Pages — no delete UI; accumulates in DB. Manual cleanup: `DELETE FROM "Page" WHERE slug LIKE 'playwright-test-%';`

---

#### `messaging.spec.ts` — send a message (as alice → george)

| Test | Flow | Asserts |
|---|---|---|
| send message | login as alice → `/u/george` → "Send Message" link → fill textarea → Send | message text appears in thread |

The Send Message link navigates to `/messages/[georgeId]` where the ID is george's DB cuid, resolved dynamically via the link on his profile page.

---

#### `profile.spec.ts` — profile pages

| Test | Actor | Flow | Asserts |
|---|---|---|---|
| private profile loads | alice | login → `/u/profile` | "Profile Settings" heading visible, no redirect to /login |
| public profile loads | unauthenticated | `/u/george` | "George Example" h1 visible |
| follow / unfollow | alice → george | `/u/george` → Follow → Unfollow | button toggles between Follow ↔ Unfollow |

**Private profile note:** `/u/profile` renders "Profile Settings" as its heading, not the user's name. The user's name appears inside `ProfileSettingsContent` (a child component).

---

## Helpers

### `helpers/auth.ts`

```ts
loginAs(page, "alice" | "george" | "dolores")
```

Navigates to `/login`, fills credentials, submits, and waits for the full-page redirect (`window.location.href`) away from `/login`. Seeded credentials are `username:username` (e.g. `alice`/`alice`).

```ts
USERS.alice  // { email, password, username }
USERS.george
USERS.dolores
```

---

## DB Cleanup

All E2E test data is cleaned up automatically. Events and posts are deleted by their own tests via the UI. Pages, messages, and signup users have no delete UI — these are removed by `tests/global-teardown.ts`, which runs once after the full suite via Playwright's `globalTeardown` hook.

| Data created | Cleaned up how |
|---|---|
| Event ("Playwright Test Event") | Deleted via UI at end of test |
| Post ("Playwright Test Post") | Deleted via UI at end of test |
| Follow (alice → george) | Unfollowed via UI at end of test |
| Page (`playwright-test-[ts]`) | `global-teardown.ts` — deletes where `slug LIKE 'playwright-test-%'` |
| Message (alice → george) | `global-teardown.ts` — deletes where `content LIKE 'Hello from Playwright%'` |
| Signup user (`tst[n]`) | `global-teardown.ts` — deletes where `username LIKE 'tst%'` |

If a test run is interrupted before teardown fires, the same patterns can be run manually:
```sql
DELETE FROM "Page" WHERE slug LIKE 'playwright-test-%';
DELETE FROM "Message" WHERE content LIKE 'Hello from Playwright%';
DELETE FROM "User" WHERE username LIKE 'tst%';
```

---

## What's Not Tested Yet

- **`canPostAsPage` permissions** — mid-refactor; placeholder in `unit/permission.test.ts` blocks CI
- **RSVP flow** — public RSVP on event detail (no auth required, upserts by `[eventId, email]`)
- **Event detail render** — visiting a published event's detail page as unauthenticated user
- **Page profile** — `/p/[slug]` render and follow
- **Connections** — `/u/[username]/connections`, `/u/profile/connections`
- **Inbox** — `/messages` listing (separate from a thread)
- **Edit flows** — editing a post or event after creation
- **Error states** — 404s, form validation errors
- **Post as Page / Send as Page** — excluded pending feature rethink
- **Mobile/responsive** — not configured
