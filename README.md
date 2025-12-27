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

## Deployment

### Vercel Deployment

1. **Push your code to GitHub**

2. **Import project to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your GitHub repository

3. **Set up environment variables in Vercel**
   - `DATABASE_URL` - Your production database connection string (from Supabase, Neon, etc.)
   - `AUTH_SECRET` - Generate with `openssl rand -base64 32` or use Vercel's generated secret

4. **Database setup**
   - Choose a PostgreSQL provider (Supabase, Neon, Vercel Postgres, etc.)
   - Run migrations: Vercel will run `prisma generate` automatically
   - For migrations, you can run them manually or use a migration service:
     ```bash
     npx prisma migrate deploy
     ```
   - Seed database (optional):
     ```bash
     npx prisma db seed
     ```

5. **Deploy**
   - Vercel will automatically build and deploy your Next.js app
   - The build command is: `npm run build`
   - Start command is: `npm start`

### Environment Variables for Production

Copy `.env.example` to `.env` and fill in values:

- `DATABASE_URL` - Production PostgreSQL connection string
- `AUTH_SECRET` - Secure random string for session encryption (32+ characters recommended)

### Database Providers (Recommended for Vercel)

- **Supabase** - Free tier available, easy setup
- **Neon** - Serverless PostgreSQL, free tier available
- **Vercel Postgres** - Integrated with Vercel, pay-as-you-go

### Build Verification

Test your production build locally:

```bash
npm run build
npm start
```

Visit [http://localhost:3000](http://localhost:3000) to verify the build works.

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

