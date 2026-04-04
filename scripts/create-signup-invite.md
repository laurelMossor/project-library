# create-signup-invite

Creates a **one-time signup invite** in the database and prints a URL you can paste into a personal email. Signup is gated: recipients must open that link (`/signup?invite=…`) and register using the **same email** you passed to this script.

## Package script (`package.json`)

The repo wires this to npm as **`invite:create`** (runs `tsx scripts/create-signup-invite.ts`). Prefer this so you don’t need to remember the path:

```bash
npm run invite:create -- person@example.com
```

Equivalent without the script name:

```bash
npx tsx scripts/create-signup-invite.ts person@example.com
```

The email argument is normalized (lowercase, trimmed) and must match what the invitee types on the signup form.

## Prerequisites

- `DATABASE_URL` set (see `.env`, `.env.development`, or `.env.local`).
- Migrations applied so the `signup_invites` table exists (`npx prisma migrate deploy` in production).

## Output

- Expiry time (default **14 days** from creation).
- A full URL, e.g. `https://your-app.com/signup?invite=<token>`.

Base URL for the printed link:

1. `APP_BASE_URL`, or
2. `NEXT_PUBLIC_APP_URL`, or
3. `http://localhost:3000` if neither is set.

## Operational notes

- Each invite is **single-use**; after a successful signup the row is marked used.
- The raw token is only shown once (in the URL). It is stored in the DB as a **hash**.
- To add transactional email later, keep this flow: only the **delivery** changes, not the table or signup API.

## Local dev / E2E bypass (optional)

Add to **`.env.development`** only (never commit a real value):

```bash
# Long random string (≥20 characters). Same value must be used as ?invite=... on /signup
DEV_SIGNUP_BYPASS_SECRET=your-long-random-secret-here-min-20-chars
```

- **Only runs when `NODE_ENV === "development"`** (`next dev`). Production and `next start` builds use `NODE_ENV=production`, so this path is off.
- Open `http://localhost:3000/signup?invite=<exact secret>` and sign up with any email/username (no DB invite row).
- **E2E:** if `DEV_SIGNUP_BYPASS_SECRET` is set in the env loaded by tests, the signup test uses it instead of creating a DB invite.

## See also

- Implementation: `src/lib/utils/server/signup-invite.ts`
- Dev bypass check: `src/lib/utils/server/dev-signup-bypass.ts`
- Route helper: `SIGNUP_WITH_INVITE` in `src/lib/const/routes.ts`
