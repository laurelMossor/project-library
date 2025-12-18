# Project Journal Notes
## Journal Guidelines
1. When requested by the user (i.e. "Please add to the journal"), add a log above the previous one
2. Rune `date` to get the date and time, use that as the headline (Convert date to format-> Day MM/DD/YYYY HH:MM TMZ)
3. Write a brief summary of what has been changed or updated since the last journal. No need to document every little nuance. Include major changes, and current challenges at a high level
4. For now, treat them like a substantially detailed commit message with some details but not a ton. User will indicate if they want more details than that.  


#### Entry: Wed 12/17/25 17:16 PST
Completed Milestone A (Authentication). Fixed Prisma v7 compatibility by adding `@prisma/adapter-pg` driver adapter. Added protected route middleware using session cookie check (Edge runtime compatible). Created bare-bones `/profile` page for testing auth redirect. Fixed Tailwind v4 PostCSS config and module format issues.

#### Entry: Wed 12/17/25 16:54 PST
Implemented authentication (Milestone A). Added NextAuth with credentials provider, bcrypt password hashing, signup API route, and login/signup pages. Created Prisma client singleton in `src/lib/`. Auth flow: signup creates user with hashed password, login validates credentials against database.

#### Entry: Wed 12/17/25 16:33 PST
Connected local PostgreSQL to Prisma. Fixed Prisma v7 config issue (URL moved from `schema.prisma` to `prisma.config.ts`). Ran first migration successfully—`users` table now exists in local database. Updated `.env` with correct connection string format for local dev.

#### Entry: Wed 12/17/25 16:03 PST
Added Prisma ORM with PostgreSQL. Created initial User model in `prisma/schema.prisma` covering auth fields (email, passwordHash, username) and profile fields (name, headline, bio, interests, location). Added `database/README.md` with local PostgreSQL setup instructions. Next: configure local PostgreSQL and run initial migration.

#### Entry: Wed 12/17/25 15:54 PST
Initialized Next.js project manually (App Router, TypeScript, Tailwind CSS). Created core config files: `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`. Set up base `src/app/` structure with layout, page, and global styles. Added `.gitignore` for node_modules and build artifacts. Project is now runnable with `npm run dev`.

#### Entry: Wed 12/17/25 15:38 PST
I initialized the project plan and a folder with tools for the AI Agent such as the project guidelines with best practices, and the journal for notes about sessions and what has been done. No git or code yet.

