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

## Resetting the Database

If you want to start fresh (delete all data and tables), you have two options:

### Option 1: Reset with Prisma (Recommended)
This deletes all data, drops all tables, and re-runs all migrations from scratch:
```bash
npx prisma migrate reset
```
**What this does:**
- Drops all tables in the database
- Re-runs all migrations (recreates tables)
- Optionally runs seed script if configured (see below)
- **Warning:** This permanently deletes all your data!

### Option 2: Drop and Recreate Database
If you want to completely remove the database and start over:
```bash
dropdb projectlibrary    # Delete the database
createdb projectlibrary  # Create a fresh database
npx prisma migrate dev    # Run migrations to create tables
```

---

## Adding Fake Data (Seeding)

To populate your database with fake users and projects for testing, you can create a seed script. This is helpful for:
- Testing how the site looks with multiple users/projects
- Demonstrating features without manually creating data
- Development and design work

### Step 1: Create a Seed Script

Create a file `prisma/seed.ts`:

```typescript
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

// Use the same Prisma setup as your app
const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
	// Create fake users
	const users = [];
	for (let i = 1; i <= 5; i++) {
		const passwordHash = await bcrypt.hash("password123", 10);
		const user = await prisma.user.create({
			data: {
				email: `user${i}@example.com`,
				username: `user${i}`,
				passwordHash,
				name: `Test User ${i}`,
				headline: `Developer ${i}`,
				bio: `This is a test bio for user ${i}`,
				interests: ["React", "TypeScript", "Next.js"],
				location: "San Francisco, CA",
			},
		});
		users.push(user);
	}

	// Create fake projects for each user
	for (const user of users) {
		await prisma.project.create({
			data: {
				title: `${user.name}'s Awesome Project`,
				description: `This is a detailed description of ${user.name}'s project. It showcases their skills and interests.`,
				tags: ["web", "react", "typescript"],
				ownerId: user.id,
			},
		});
	}

	console.log("✅ Seeded database with fake data!");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
```

### Step 2: Add Seed Script to package.json

Add this to your `package.json` scripts section:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

And install the TypeScript runner:
```bash
npm install --save-dev tsx
```

### Step 3: Run the Seed Script

```bash
npx prisma db seed
```

Or run it directly:
```bash
npx tsx prisma/seed.ts
```

**Note:** You can modify the seed script to create as many users/projects as you want. Just change the numbers in the loops!

---

## PostgreSQL Direct Commands

```bash
psql projectlibrary        # Connect to database via terminal
createdb <name>            # Create a new database
dropdb <name>              # Delete a database
```

---

## Switching to Hosted (later)

Replace the `DATABASE_URL` in `.env` with your hosted provider's connection string:
- **Neon:** neon.tech
- **Supabase:** supabase.com
- **AWS RDS:** aws.amazon.com/rds

No code changes needed—just update the connection string and redeploy.

