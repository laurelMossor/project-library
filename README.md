# Project Library

A platform for sharing and discovering projects, matching with collaborators based on interests.

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth v5 (credentials)
- **Styling:** Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

Create a `.env` file in the project root:

```
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/projectlibrary"
AUTH_SECRET="your-secret-key"
```

Generate an auth secret:
```bash
openssl rand -base64 32
```

### 3. Set up database

**macOS (with Homebrew):**
```bash
# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb projectlibrary

# Run migrations
npm run db:migrate --name [NEW_COMMIT]

# Generate the Prisma Client
npm run db:generate

# Seed the database with sample data (optional)
npm run db:seed



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

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login & signup pages
│   ├── api/auth/        # Auth API routes
│   └── page.tsx         # Home page
├── lib/
│   ├── auth.ts          # NextAuth config
│   └── prisma.ts        # Prisma client
prisma/
│   └── schema.prisma    # Database models
database/
│   └── README.md        # Database setup docs
```

