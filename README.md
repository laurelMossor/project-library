# Project Library

A website for creativity, mutuality, and lifelong learning — where people share what they're making, run events, lend tools, and find mentors and collaborators.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, React 19)
- **Data:** PostgreSQL + Prisma ORM, hosted on Supabase (Postgres + Storage)
- **Auth:** NextAuth v5 (credentials)
- **Email:** Resend
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 15+

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

Create a `.env` file in the project root.

**Required** to run the app locally:

```
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/projectlibrary"
AUTH_SECRET="your-secret-key"
```

Generate an auth secret:
```bash
openssl rand -base64 32
```

**Optional** — these enable specific features; the app runs without them in dev:

```
# Real email delivery (signup verification, etc.). Without RESEND_API_KEY, emails are
# logged to the console instead of sent. EMAIL_FROM must be on a Resend-verified domain.
RESEND_API_KEY="..."
EMAIL_FROM="The Project Library <you@your-domain.com>"
APP_BASE_URL="http://localhost:3000"   # base URL used for links in emails

# Supabase Storage for image uploads. Without these, uploads go to the local filesystem.
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."
```

### 3. Set up database

**macOS (with Homebrew):**
```bash
# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb projectlibrary

# Run migrations (creates a new migration when the schema changed)
npx prisma migrate dev --name <migration_name>
# ...or just apply existing migrations with no schema change:
npm run db:migrate

# Generate the Prisma Client
npm run db:generate

# Seed the database with sample data (optional)
npm run db:seed:dev
```

**Linux/WSL (Ubuntu/Debian):**
```bash
# Install PostgreSQL (if not already installed)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo service postgresql start
# Or with systemd:
sudo systemctl start postgresql

# Create database (as postgres user)
sudo -u postgres createdb projectlibrary
# Or switch to postgres user first:
sudo -u postgres psql
# Then in psql: CREATE DATABASE projectlibrary;
# Exit with: \q

# Run migrations
npx prisma migrate dev

# Seed the database with sample data (optional)
npx prisma db seed
```

**Note:** On WSL/Ubuntu, if you get permission errors with `createdb`, use `sudo -u postgres createdb projectlibrary` instead.

**Note:** 
- On macOS/Linux/WSL, PostgreSQL might already be running. Check with `sudo service postgresql status` or `sudo systemctl status postgresql`
- If you get permission errors, you may need to switch to the postgres user: `sudo -u postgres createdb projectlibrary`

### 4. Run the app

```bash
npm run dev
```

Build
```bash
npm run build
```

Visit [http://localhost:3000](http://localhost:3000)

## Testing

- **Unit** ([Vitest](https://vitest.dev/)): `npm run test:unit` (or `npm run test:unit:watch`). No server or database needed — Prisma and the session are mocked. Covers permission/visibility gates, identity scoping, the notification dispatcher, and other server-util logic.
- **E2E** ([Playwright](https://playwright.dev/)): seed the database (`npm run db:seed:dev`), start the dev server (`npm run dev`), then run `npm run test:e2e`. Covers public page renders, auth flows, content creation (events, posts, pages), messaging, requests, visibility, and profile interactions. See `tests/TESTING.md` for conventions.

## Deployment

Hosted on Vercel; merging to `main` triggers a deploy. The build runs `prisma migrate deploy` in production. Apply breaking schema changes deliberately — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

