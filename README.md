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

```bash
# Start PostgreSQL (if not running)
brew services start postgresql@15

# Create database
createdb projectlibrary

# Run migrations
npx prisma migrate dev
```

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

