# Deployment Guide

This guide covers deploying your application and running database migrations on production.

## Important: Migrations Don't Run Automatically

**Database migrations do NOT happen automatically when you push code.** You must run them manually on your production database.

## Migration Commands

### Development (Local Database)
```bash
# Create a new migration (creates migration files)
npm run db:migrate

# This uses .env.development (local database)
```

### Production (Remote Database)
```bash
# Apply existing migrations to production database
npm run db:migrate:deploy

# This uses .env.production (remote Supabase database)
```

## Deployment Workflow

### Step 1: Test Locally
1. Test your migrations on your local database first:
   ```bash
   npm run db:migrate        # Create/apply migrations locally
   npm run dev              # Test the app locally
   ```

### Step 2: Push Code
2. Commit and push your code (including migration files in `prisma/migrations/`):
   ```bash
   git add .
   git commit -m "Add v2 schema migration"
   git push
   ```

### Step 3: Deploy Application
3. Deploy your application (Vercel)
   - Your app code will be deployed
   - **But the database schema won't be updated yet**

### Step 4: Run Production Migrations
4. **Manually run migrations on production:**
   ```bash
   npm run db:migrate:deploy
   ```
   
   This will:
   - Connect to your production database (from `.env.production`)
   - Apply all pending migrations
   - Update the database schema to match your Prisma schema

### Step 5: Verify
5. Verify the migration succeeded:
   ```bash
   npm run db:studio  # Open Prisma Studio (make sure NODE_ENV=production if needed)
   ```

## Important Notes

### `prisma migrate dev` vs `prisma migrate deploy`

- **`prisma migrate dev`** (development):
  - Creates new migration files
  - Applies migrations to your local database
  - Use this during development
  - **Never use this on production!**

- **`prisma migrate deploy`** (production):
  - Only applies existing migration files
  - Does NOT create new migrations
  - Safe for production
  - Use this to update production database

### Environment Variables

Make sure your `.env.production` file has:
```bash
DIRECT_URL="postgresql://postgres:password@host:5432/dbname"  # Direct connection for migrations
DATABASE_URL="postgresql://postgres:password@host:5432/dbname" # Pooled connection for app
```

**Important**: `prisma.config.ts` uses `DIRECT_URL` for migrations, so make sure it's set in `.env.production`.

## Automated Migrations (Optional)

Some platforms can run migrations automatically during deployment:

### Vercel
Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

## Resolving Failed Migrations

If a migration fails in production (P3009 error), you need to resolve it before applying new migrations.

### Step 1: Check Migration Status
```bash
NODE_ENV=production npx prisma migrate status
```

This will show:
- Which migrations have been applied
- Which migrations failed
- Which migrations are pending

### Step 2: Check What Actually Happened

Connect to your database and check:
1. **Did the migration partially apply?** (some tables created, some not)
2. **What error occurred?** (check Supabase logs or Prisma migration table)

You can query the migration history:
```sql
SELECT migration_name, finished_at, applied_steps_count, logs 
FROM _prisma_migrations 
ORDER BY started_at DESC 
LIMIT 5;
```

### Step 3: Resolve the Failed Migration

You have two options:

#### Option A: Mark as Rolled Back (if migration failed completely)
If the migration failed early and didn't create any tables:
```bash
NODE_ENV=production npx prisma migrate resolve --rolled-back 20260110034536_init_v2
```

#### Option B: Mark as Applied (if migration partially succeeded)
If the migration created some tables but failed partway through:
```bash
NODE_ENV=production npx prisma migrate resolve --applied 20260110034536_init_v2
```

**⚠️ Warning**: Only use `--applied` if you're sure the migration's changes are actually in the database. Otherwise, you'll have schema drift.

### Step 4: Fix and Re-apply

After resolving the failed migration:

1. **If you marked it as rolled back:**
   - Fix any issues in the migration SQL
   - Re-run: `npm run db:migrate:deploy`

2. **If you marked it as applied:**
   - Check what's missing from the migration
   - Create a new migration to add the missing pieces:
     ```bash
     npm run db:migrate --name fix_v2_schema
     ```

### Step 5: Verify Database State

After resolving, verify your database matches your schema:
```bash
NODE_ENV=production npx prisma db pull  # See what's actually in DB
NODE_ENV=production npx prisma migrate status  # Check migration status
```

## Rollback Plan

If a migration fails or causes issues:

1. **Don't panic** - your old code is still running
2. Check the migration error logs
3. Fix the migration or rollback if needed
4. Re-run the migration once fixed

## Checklist Before Deploying Migrations

- [ ] Tested migrations locally
- [ ] Verified `.env.production` has correct `DIRECT_URL` and `DATABASE_URL`
- [ ] Backed up production database (if you have important data)
- [ ] Reviewed migration SQL files in `prisma/migrations/`
- [ ] Ready to run `npm run db:migrate:deploy` after code deployment

