# Environment Files Guide

This project uses Next.js's built-in environment file system for managing different database configurations.

## Environment File Structure

Next.js loads environment files in this order (later files override earlier ones):

1. `.env` - Base configuration (shared across all environments)
2. `.env.local` - Local overrides (gitignored, highest priority for local dev)
3. `.env.development` - Development-specific (loaded when `NODE_ENV=development`)
4. `.env.production` - Production-specific (loaded when `NODE_ENV=production`)

## Recommended Setup

### `.env` (Base - committed to git)
```bash
# Shared configuration
AUTH_SECRET="your-secret-key"
# ... other shared vars
```

### `.env.development` (Local development - committed to git)
```bash
# Local PostgreSQL database
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/projectlibrary_dev"
DIRECT_URL="postgresql://YOUR_USERNAME@localhost:5432/projectlibrary_dev"

# Local Supabase (optional, can use placeholder)
NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="placeholder"
```

### `.env.production` (Remote/production - committed to git)
```bash
# Remote Supabase database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
DIRECT_URL="postgresql://user:pass@host:5432/dbname"

# Production Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### `.env.local` (Local overrides - gitignored)
```bash
# Use this for any personal local overrides
# This file takes highest priority and is never committed
```

## Usage

### Local Development (Local Database)
```bash
npm run dev
# or
npm run dev:local
```
- Uses `.env.development` (local PostgreSQL)
- `NODE_ENV=development` (default)

### Remote Development (Production Database)
```bash
npm run dev:remote
```
- Uses `.env.production` (remote Supabase)
- `NODE_ENV=production` (but still runs in dev mode)

### Production Build
```bash
npm run build
npm start
```
- Uses `.env.production` (remote Supabase)
- `NODE_ENV=production`

## Notes

- `.env.local` always takes highest priority (if it exists)
- `.env.development` and `.env.production` can be committed to git (they're environment-specific, not secret)
- Never commit `.env.local` (it's in `.gitignore`)
- Never commit actual secrets to `.env.development` or `.env.production` - use placeholders or environment variables

## Migration from Old Setup

If you were using `.env.local` for local database config:
1. Move local DB config from `.env.local` to `.env.development`
2. Move remote DB config from `.env` to `.env.production`
3. Keep only personal overrides in `.env.local` (if needed)

