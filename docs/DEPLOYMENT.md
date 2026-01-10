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
3. Deploy your application (Vercel, Railway, etc.)
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

### Railway / Other Platforms
Similar approach - add `prisma migrate deploy` to your build script.

**Warning**: Be careful with automated migrations. It's often safer to run them manually so you can verify they succeed before deploying.

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

