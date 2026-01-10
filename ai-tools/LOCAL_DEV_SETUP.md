# Local Development Setup for Migration Testing

This guide helps you set up a separate local database for testing the v2 migration without affecting your production database.

## Overview

- **Production DB**: Connected via `DATABASE_URL` in `.env` (remote Supabase/PostgreSQL)
- **Local Dev DB**: Separate local PostgreSQL database for testing
- **Strategy**: Use `.env.local` to override `DATABASE_URL` for local development

## Current Schema State

Your `schema.prisma` is currently **v2**. The **v1 schema** is backed up as `prisma/schema.prisma.backup`.

## Commands Reference

**Safe (no database connection):**
- `npx prisma generate` - Only generates TypeScript types

**⚠️ Connects to Database (uses `DATABASE_URL`):**
- `npx prisma migrate reset` - Drops all data and reapplies schema
- `npx prisma migrate deploy` - Applies migrations
- `npx prisma migrate dev` - Creates and applies migrations
- `npx prisma studio` - Opens database viewer
- `npm run db:seed` - Runs seed script

---

## Step 1: Create Local Development Database

```bash
# Start PostgreSQL
brew services start postgresql@15

# Create local dev database
createdb projectlibrary_dev
```

---

## Step 2: Configure Environment Variables

Create a `.env.local` file in your project root (automatically ignored by git):

```bash
# Local Development Database
DATABASE_URL="postgresql://localhost:5432/projectlibrary_dev"
DIRECT_URL="postgresql://localhost:5432/projectlibrary_dev"
```

Keep your production values in `.env` (they won't be used when `.env.local` exists).

---

## Step 3: Switch to v2 Schema and Reset Database

Since you're dropping all data and reseeding, we can skip the complex data migration.

```bash
# Verify local database is configured
cat .env.local | grep DATABASE_URL
# Should show: DATABASE_URL="postgresql://localhost:5432/projectlibrary_dev"

# Switch to v2 schema (if needed)
cp prisma/schema.prisma.v2 prisma/schema.prisma

# Generate Prisma client for v2
npx prisma generate

# Reset database (drops all tables, applies v2 schema)
npx prisma migrate reset
```

---

## Step 4: Seed Database

The seed script (`prisma/seed.ts`) has been updated for v2 schema:

- Creates `Actor` records before `User` records
- Uses `firstName`/`lastName` instead of `name`
- Uses `ownerActorId` for Projects/Events
- Creates `ImageAttachment` records
- Creates `Post` records instead of `Entry`

```bash
# Run seed script
npm run db:seed
```

---

## Step 5: Test the Application

```bash
# Start dev server (uses .env.local automatically)
npm run dev
```

Test all functionality:
- User authentication
- Project creation/editing
- Event creation/editing
- Post creation
- Image uploads
- Profile updates

---

## Quick Reference Commands

```bash
# Database management
createdb projectlibrary_dev          # Create database
dropdb projectlibrary_dev            # Delete database
psql projectlibrary_dev              # Connect to database

# Prisma commands
npx prisma generate                  # Generate client (safe)
npx prisma migrate reset             # Reset database (⚠️ deletes data)
npx prisma migrate deploy            # Apply migrations
npx prisma studio                    # Open database viewer

# Seed
npm run db:seed                      # Run seed script
```

---

## Troubleshooting

### Database does not exist
```bash
createdb projectlibrary_dev
```

### Connection refused
```bash
brew services start postgresql@15
brew services list  # Check if running
```

### Wrong database being used
- Verify `.env.local` exists: `cat .env.local | grep DATABASE_URL`
- Should show: `DATABASE_URL="postgresql://localhost:5432/projectlibrary_dev"`
- Restart terminal/IDE after changing `.env` files

### Prisma client out of sync
```bash
npx prisma generate
```

### Seed script errors
- Make sure you've run `npx prisma generate` after switching to v2 schema
- Check that `DATABASE_URL` in `.env.local` points to local database

---

## Environment Variable Priority

Next.js loads environment variables in this order (later overrides earlier):
1. `.env` (base config)
2. `.env.local` (local overrides - **ignored by git**)
3. `.env.development` (development-specific)
4. `.env.production` (production-specific)

---

## Safety Checklist

Before running any migration commands:

- [ ] Verify `DATABASE_URL` in `.env.local` points to `projectlibrary_dev`
- [ ] Verify `.env.local` exists and is being used
- [ ] Test all critical features after migration
- [ ] Keep `.env.local` in `.gitignore` (automatic)

---

## Switch Back to Production

When ready to deploy:

1. Remove or rename `.env.local`
2. Your `.env` will be used (production connection)
3. Run migration on production database
