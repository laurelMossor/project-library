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
```
DATABASE_URL="postgresql://localhost:5432/projectlibrary"
```

### Run migrations
```bash
npx prisma migrate dev --name init
```

---

## Switching to Hosted (later)

Replace the `DATABASE_URL` in `.env` with your hosted provider's connection string:
- **Neon:** neon.tech
- **Supabase:** supabase.com
- **AWS RDS:** aws.amazon.com/rds

No code changes needed—just update the connection string and redeploy.

