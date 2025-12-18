# Database Setup

## Local PostgreSQL (macOS)

### Install
```bash
brew install postgresql@15
```

### Start service
```bash
brew services start postgresql@15
```

### Create database
```bash
createdb projectlibrary
```

### Connection string (.env)

The connection string tells your app where to find the database.
Format: `postgresql://[user]:[password]@[host]:[port]/[database_name]`

For local dev with default settings (no password):
```
DATABASE_URL="postgresql://localhost:5432/projectlibrary"
```

### Run migrations

Migrations sync your Prisma schema (the models you define in `schema.prisma`) 
with the actual database tables. This command creates/updates tables to match your schema.

```bash
npx prisma migrate dev --name init
```
- `migrate dev` - runs in development mode (creates migration files you can track in git)
- `--name init` - names this migration "init" (use descriptive names like "add_projects_table")

---

## Switching to Hosted (later)

Replace the `DATABASE_URL` in `.env` with your hosted provider's connection string:
- **Neon:** neon.tech
- **Supabase:** supabase.com
- **AWS RDS:** aws.amazon.com/rds

No code changes needed—just update the connection string and redeploy.

