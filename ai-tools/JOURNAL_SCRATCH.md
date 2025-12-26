# Project Journal Notes
## Journal Guidelines
1. When requested by the user (i.e. "Please add to the journal"), add a log above the previous one
2. Rune `date` to get the date and time, use that as the headline (Convert date to format-> Day MM/DD/YYYY HH:MM TMZ)
3. Write a brief summary of what has been changed or updated since the last journal. No need to document every little nuance. Include major changes, and current challenges at a high level
4. For now, treat them like a substantially detailed commit message with some details but not a ton. User will indicate if they want more details than that.  


#### Entry: Thu 12/25/2025 21:54 PST
Refactored collections rendering architecture. Created `FilteredCollection` component to handle view state (map/list/grid) and render appropriate card types directly (ProjectCard/EventCard), making `CollectionCard` obsolete. Extracted `CollectionItemCard` helper to DRY up card rendering logic. Added events to seed data (two events from admin and alice users). Renamed type interfaces: `Event` → `EventItem` and `Project` → `ProjectItem` to avoid conflicts with DOM Event type, updated all references across codebase.

#### Entry: Thu 12/25/2025 17:47 PST
Completed Milestone F code review and implemented type discriminator pattern. Added `type` field to Prisma schema (Project/Event models) with defaults, making database the source of truth. Refactored type guards to use discriminator field. Created shared collection utilities (`src/lib/utils/collection.ts`) eliminating ~60 lines of duplicated filtering/sorting logic between collections pages. Updated migrations to include `type` field properly. All utility functions now return data directly from Prisma without manual type mapping.

#### Entry: Thu 12/25/2025 14:46 PST
Normalized project data fetching and aligned type system with Prisma schema. Refactored project utilities to remove transformation layer - types now match Prisma directly (Date fields instead of string, no manual conversion). Created `PublicUser` type matching `publicUserFields` selection and updated `Project` interface to use `PublicUser` for owner instead of limited `ProjectOwner`. Updated `getInitials()` to accept `PublicUser` object. Renamed `publicProfileFields` to `publicUserFields` throughout codebase for consistency. Refactored component structure: moved project entry content to `ProjectEntry` component, updated `ProfilePicPlaceholder` to accept full project and made circle clickable link to user profile. Added client-side fetch utilities (`fetchProjects`, `fetchProjectById`) in `project.ts` for consistent API usage. All server-side functions now return Prisma results directly without transformation, ensuring type safety and eliminating unnecessary data conversion overhead.

#### Entry: Tue 12/23/2025 14:13 PST
Completed messaging feature implementation (Milestone E - messaging components). Added Message model to Prisma schema with sender/receiver relations and User model updates. Created message utilities (`src/lib/utils/message.ts`) with `getConversations()`, `getMessages()`, and `sendMessage()` functions. Added message validation (`validateMessageContent()`) and TypeScript types (`src/lib/types/message.ts`). Built API routes: GET/POST `/api/messages` for conversations list and sending messages, GET `/api/messages/[userId]` for individual conversation threads. Created frontend pages: `/messages` (conversations list with last message preview) and `/messages/[userId]` (individual conversation with message input). Added "Messages" link to navigation sidebar (visible when logged in). Integrated message buttons on user profile pages (`/u/[username]`) and project detail pages (`/projects/[id]`) to start conversations. Updated `getUserByUsername()` to include user ID for messaging functionality. Updated README with WSL/Ubuntu PostgreSQL setup instructions. Database migration pending - need to configure PostgreSQL authentication (setting postgres user password). All messaging endpoints are protected and include validation (prevents self-messaging, validates content length).

#### Entry: Thu 12/18/25 22:42 PST
Implemented image upload feature for projects (Milestone E - image components). Added `imageUrl` field to Project model in Prisma schema, created migration. Built image upload API route (`/api/projects/upload`) with file validation (type, size limits). Updated project creation form to support image upload with preview. Enhanced project list and detail pages to display images using Next.js Image component. Fixed ESLint configuration issues by creating custom `eslint.config.mjs` with TypeScript, React, and React Hooks support (workaround for Next.js 16.0.10 `next lint` bug). Migrated from `middleware.ts` to `proxy.ts` per Next.js 16 deprecation. Fixed image display issues by switching from `fill` prop to explicit dimensions. Reorganized code structure (moved utilities to `src/lib/utils/`). Added uploads directory to `.gitignore`. Images now display correctly on project listings and detail pages.

#### Entry: Thu 12/18/25 17:56 PST
Completed Milestone C MVP (Projects). Created plan document (`ai-tools/MILESTONE_C_PLAN.md`). Added Project model to Prisma schema with User relation, ran migration. Created `src/lib/project.ts` with utility functions and extended validations for projects. API routes: GET/POST `/api/projects` (public listing with search, protected create) and GET `/api/projects/[id]`. Frontend: Created `/projects` (public listing), `/projects/new` (protected form), and `/projects/[id]` (public detail) pages. Updated navigation with Projects and New Project links. Standardized auth handling across client and server components.

#### Entry: Thu 12/18/25 16:59 PST
Completed pre-Milestone C refactoring and code review. Created `src/lib/errors.ts` with standardized error response helpers (unauthorized, notFound, badRequest, serverError). Created `src/lib/validations.ts` with reusable validation functions for email, username, password, and profile data. Extended `src/lib/user.ts` with `updateUserProfile()` function to extract profile update logic from API routes. Updated `/api/profile` and `/api/auth/signup` routes to use new utility functions for consistency. Documented that DELETE operation is intentionally omitted from MVP. Created comprehensive milestone review document (`ai-tools/MILESTONE_REVIEW.md`) confirming Milestone A and B completion. All refactors improve code maintainability, testability, and consistency. Ready to proceed with Milestone C (Projects).

#### Entry: Wed 12/17/25 17:34 PST
Completed Milestone B (User Profile). Created `/profile`, `/profile/edit`, and `/u/[username]` pages with API routes. Added `src/lib/user.ts` utility for reusable profile queries. Fixed session user.id not being passed through by adding NextAuth callback. Added SessionProvider to layout for client-side session access. Added profile link to home page and logged-in banner to login page.

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

