# Local Development Setup for Migration Testing

This guide helps you set up a separate local database for testing the v2 migration without affecting your production database.

## Overview

- **Production DB**: Connected via `DATABASE_URL` (your remote Supabase/PostgreSQL)
- **Local Dev DB**: Separate local PostgreSQL database for testing
- **Strategy**: Use `.env.local` to override `DATABASE_URL` for local development

## Current Schema State

**Note**: Your `schema.prisma` is currently **v2** (with Actor model, Post model, etc.). The **v1 schema** is backed up as `prisma/schema.prisma.backup`.

The workflow below will:
1. Restore v1 schema to initialize local DB with existing data structure
2. Then switch back to v2 schema to test the migration

## ⚠️ Commands That Touch the Database

**Safe (no database connection):**
- `npx prisma generate` - Only generates TypeScript types from schema file

**⚠️ Connects to Database (uses `DATABASE_URL`):**
- `npx prisma migrate deploy` - Applies migrations to database
- `npx prisma migrate dev` - Creates and applies migrations
- `npx prisma migrate reset` - Drops all data and reapplies migrations
- `npx prisma studio` - Opens database viewer
- `psql [database]` - Direct database connection

**Always verify `DATABASE_URL` points to your local database before running commands that connect!**

---

## Step 1: Create Local Development Database

Create a separate database for local testing:

```bash
# Start PostgreSQL (if not already running)
brew services start postgresql@15

# Create a new database for local dev
createdb projectlibrary_dev
```

---

## Step 2: Configure Environment Variables

### Option A: Using `.env.local` (Recommended)

Create a `.env.local` file in your project root. This file is automatically ignored by git and will override `.env` in development.

**`.env.local`** (create this file):
```bash
# Local Development Database
# This overrides DATABASE_URL from .env when running locally
DATABASE_URL="postgresql://localhost:5432/projectlibrary_dev"

# For Prisma migrations (if using prisma.config.ts)
# Use the same URL for local dev
DIRECT_URL="postgresql://localhost:5432/projectlibrary_dev"

# Keep your existing production values commented for reference
# DATABASE_URL="postgresql://[your-production-connection-string]"
# DIRECT_URL="postgresql://[your-production-direct-connection-string]"
# NEXT_PUBLIC_SUPABASE_URL="https://[your-project].supabase.co"
# SUPABASE_SERVICE_ROLE_KEY="[your-service-key]"
# AUTH_SECRET="[your-auth-secret]"
```

**Your existing `.env`** (keep as-is for production):
```bash
# Production Database (remote)
DATABASE_URL="postgresql://[your-production-connection-string]"
DIRECT_URL="postgresql://[your-production-direct-connection-string]"

# Supabase (for storage, etc.)
NEXT_PUBLIC_SUPABASE_URL="https://[your-project].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="[your-service-key]"

# Auth
AUTH_SECRET="[your-auth-secret]"
```

### Option B: Manual Switch (Alternative)

If you prefer to manually switch, you can comment/uncomment lines in `.env`:

```bash
# For local dev, comment production and uncomment local:
# DATABASE_URL="postgresql://[production]"
DATABASE_URL="postgresql://localhost:5432/projectlibrary_dev"
```

**⚠️ Warning**: This approach is error-prone. Option A is safer.

---

## Step 3: Initialize Local Database with v1 Schema

Before testing the migration, set up your local database with the current v1 schema:

**⚠️ IMPORTANT**: Make sure `.env.local` exists and has `DATABASE_URL` pointing to your local database (`projectlibrary_dev`). Prisma commands will use the `DATABASE_URL` from your environment.

```bash
# Verify .env.local is set up correctly
# (Check that DATABASE_URL in .env.local points to projectlibrary_dev)

# First, backup the current v2 schema (so we can restore it later)
cp prisma/schema.prisma prisma/schema.prisma.v2

# Restore v1 schema from backup (overwrites schema.prisma with v1)
# Your v1 schema is backed up as: prisma/schema.prisma.backup
cp prisma/schema.prisma.backup prisma/schema.prisma

# Generate Prisma client for v1
# ⚠️ NOTE: This command does NOT touch any database - it only generates TypeScript types
npx prisma generate

# ⚠️ SAFETY CHECK: Verify you're using the local database
# Run this to confirm DATABASE_URL points to your local database:
echo $DATABASE_URL
# Should show: postgresql://localhost:5432/projectlibrary_dev
# If it shows your Supabase URL, check that .env.local exists and has DATABASE_URL set

# Run all existing migrations to create v1 schema
# ⚠️ THIS command WILL connect to the database specified in DATABASE_URL
# Make sure .env.local is set up correctly before running this!
npx prisma migrate deploy

# Or if you want to start fresh and apply all migrations:
npx prisma migrate dev
```

---

## Step 4: Seed Local Database (Optional)

If you want test data in your local database:

```bash
# Seed with existing seed data
npm run db:seed
```

---

## Step 5: Test the Migration

Now you can safely test the v2 migration:

### 5a. Create Migration Script

First, create the SQL migration script (as planned in Phase 2 of the migration plan).

### 5b. Switch to v2 Schema

```bash
# Restore v2 schema (we backed it up in Step 3 as schema.prisma.v2)
cp prisma/schema.prisma.v2 prisma/schema.prisma

# Verify v2 schema has Actor model and Post model (not Entry)
# Then generate Prisma client for v2
npx prisma generate
```

### 5c. Run Migration

```bash
# Option 1: Run the SQL migration script manually
psql projectlibrary_dev < ai-tools/migration-script.sql

# Option 2: Create a Prisma migration (if you want Prisma to track it)
npx prisma migrate dev --name migrate_to_v2
```

### 5d. Test the Application

```bash
# Start dev server (will use .env.local automatically)
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

## Step 6: Rollback if Needed

If something goes wrong, you can easily reset:

```bash
# Drop and recreate the local database
dropdb projectlibrary_dev
createdb projectlibrary_dev

# Re-run migrations from scratch
npx prisma migrate deploy
```

---

## Step 7: Switch Back to Production

When you're ready to deploy to production:

1. **Remove or rename `.env.local`** (or comment out the local DATABASE_URL)
2. Your `.env` will be used (production connection)
3. Run the migration on production database

---

## Quick Reference Commands

```bash
# Start local PostgreSQL
brew services start postgresql@15

# Create local dev database
createdb projectlibrary_dev

# Connect to local database (for manual SQL)
psql projectlibrary_dev

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Open Prisma Studio (to view/edit data)
npx prisma studio

# Reset local database (⚠️ deletes all data)
npx prisma migrate reset
```

---

## Environment Variable Priority

Next.js loads environment variables in this order (later overrides earlier):
1. `.env` (base config)
2. `.env.local` (local overrides - **ignored by git**)
3. `.env.development` (development-specific)
4. `.env.production` (production-specific)

**Recommendation**: Use `.env.local` for your local database URL so it never gets committed to git.

---

## Safety Checklist

Before running any migration commands:

- [ ] Verify `DATABASE_URL` in `.env.local` points to `projectlibrary_dev`
- [ ] Verify production `.env` is NOT being used (check which file Next.js is loading)
- [ ] Backup production database (if you need to test on production later)
- [ ] Test all critical features after migration
- [ ] Keep `.env.local` in `.gitignore` (should be automatic)

---

## Troubleshooting

### "Database does not exist"
```bash
createdb projectlibrary_dev
```

### "Connection refused"
```bash
brew services start postgresql@15
# Or check if PostgreSQL is running:
brew services list
```

### "Wrong database being used"
- Check which `.env` file is active: `console.log(process.env.DATABASE_URL)` in an API route
- Verify `.env.local` exists and has the correct `DATABASE_URL`
- Restart your dev server after changing `.env` files

### "Prisma client out of sync"
```bash
npx prisma generate
```

### "Wrong database being used"
- **For Prisma commands**: They read `DATABASE_URL` from your environment
  - Check which file is active: `echo $DATABASE_URL` in terminal
  - Or in Node.js: `console.log(process.env.DATABASE_URL)` in an API route
  - Verify `.env.local` exists and has the correct `DATABASE_URL`
  - Restart your terminal/IDE after changing `.env` files (they're loaded at startup)
- **Important distinction**:
  - `prisma generate` - **Does NOT connect to database**, only reads schema file
  - `prisma migrate` - **DOES connect to database**, uses `DATABASE_URL`
  - `prisma studio` - **DOES connect to database**, uses `DATABASE_URL`

