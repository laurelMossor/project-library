# Milestone H MVP Plan - V1 Launch Preparation
## Overview

Finalize the MVP for V1 launch with improved navigation, project entries, enhanced seed data, and deployment readiness. This milestone focuses on polish, user experience improvements, and preparing for real user feedback.

## MVP Goals (Simplified)

- Refactor layout: remove sidebar, implement top navigation bar
- Collections becomes the home/landing page
- User Home page displays public profile with user collection
- Projects support entries/updates via Project Entry table
- Enhanced seed data with 9 users across three interest profiles
- Prepare for Vercel deployment

**Out of Scope for MVP:**
- Advanced navigation features (search, filters in nav)
- Project entry editing or deletion
- Multiple images per project entry
- Analytics or tracking
- Advanced deployment configurations (CI/CD pipelines)
- Performance optimizations beyond basic best practices

## Backend Implementation

### 1. Create Project Entry Database Model

**File:** `prisma/schema.prisma`

Add ProjectEntry model to support project updates/entries:

```prisma
model ProjectEntry {
	id          String    @id @default(cuid())
	projectId   String    // foreign key to Project
	title       String?   // optional entry title (e.g., "Update #1", "Progress Update")
	content     String    // entry text content
	createdAt   DateTime  @default(now())
	updatedAt   DateTime  @updatedAt

	project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

	@@map("project_entries")
}
```

Update Project model to include entries relation:
```prisma
model Project {
	// ... existing fields ...
	entries     ProjectEntry[] // entries/updates for this project
}
```

**Migration:**
- Run `npx prisma migrate dev --name add_project_entries`
- Generate Prisma client: `npx prisma generate`

### 2. Create Project Entry Utility Functions

**File:** `src/lib/utils/project-entry.ts` (new file)

Create utility functions following patterns from `src/lib/utils/project.ts`:

- `getProjectEntries(projectId: string)` - Get all entries for a project, sorted by createdAt (newest first)
- `createProjectEntry(projectId: string, data: { title?: string; content: string })` - Create a new entry for a project
  - Validate content is not empty
  - Validate project exists
  - Optionally validate user owns the project (for future protected routes)

**ProjectEntry Interface:**
```typescript
export interface ProjectEntryItem {
	id: string;
	projectId: string;
	title: string | null;
	content: string;
	createdAt: Date;
	updatedAt: Date;
}
```

### 3. Create Project Entry API Routes

**File:** `src/app/api/projects/[id]/entries/route.ts` (new file)

**GET /api/projects/[id]/entries**
- Public endpoint (anyone can view project entries)
- Returns array of entries for the project
- Use `getProjectEntries()` utility
- Return empty array if no entries exist (not an error)

**POST /api/projects/[id]/entries**
- Protected endpoint (requires authentication)
- Only project owner can create entries
- Validates content is provided and not empty
- Uses `createProjectEntry()` utility
- Returns created entry with 201 status

**Error Handling:**
- Return 404 if project not found
- Return 401 if not authenticated (POST only)
- Return 403 if user is not project owner (POST only)
- Return 400 for validation errors

### 4. Update Enhanced Seed Data

**File:** `prisma/seed.ts`

**Seed Data Requirements:**
- 9 total users across three core interest profiles: (4 in portland and 5 in Berkeley)
  - Sewing (3 users)
  - Tech (3 users)
  - Woodworking (3 users)
- Project distribution:
  - 6 users have 2 projects each
  - 1 user has 1 project
  - 2 users have 0 projects
- 2 projects have updates (project entries)
- 4 Events, 2 in Berkeley and 2 in Portland 
- Projects and Events created throughout December 2025 (varied dates)

**Implementation:**
- Update `prisma/seed-data/users.json` with 9 users across three profiles
- Update `prisma/seed-data/projects.json` with appropriate project distribution
- Add `createdAt` dates to projects (spread throughout December)
- Create 2 project entries for appropriate projects
- Seed users all have Example as last name (Keep Admin profile, it does not count toward the 9)
- Update seed.ts to handle:
  - Setting `createdAt` dates on projects
  - Creating project entries after projects are created

**Note:** Prisma allows setting `createdAt` during creation. Use explicit dates like:
```typescript
createdAt: new Date('2024-12-01T10:00:00Z'),
createdAt: new Date('2024-12-15T14:30:00Z'),
// etc.
```

## Frontend Implementation

### 5. Refactor Layout - Remove Sidebar, Add Navigation Bar

**File:** `src/app/layout.tsx`

**Changes:**
- Remove sidebar (`<aside>`) element
- Convert header to navigation bar with icons
- Navigation bar structure:
  - Left: "Project Library" title (link to `/collections`)
  - Center/Right: Navigation icons
    - Info icon → Links to About page (create if needed) or navigation hub
    - Collections icon → Links to `/collections`
    - User Home icon (house-user from FontAwesome) → Links to:
      - If logged in: `/u/[username]` (user's own profile)
      - If not logged in: `/login` (with link to signup)

**Icon Implementation:**
- Use FontAwesome icons (install `@fortawesome/react-fontawesome` if not already present)
- Or use SVG icons for simplicity (no external dependency)
- User Home icon: https://fontawesome.com/icons/house-user?f=classic&s=solid
- Info icon: https://fontawesome.com/icons/circle-question?f=classic&s=regular
- Collection icon: https://fontawesome.com/icons/layer-group?f=classic&s=solid

**Layout Structure:**
```tsx
<header className="h-[100px] w-full border-b border-rich-brown flex items-center justify-between px-6">
	{/* Left: Title */}
	<Link href="/collections">Project Library</Link>
	
	{/* Right: Navigation icons */}
	<nav className="flex items-center gap-4">
		{/* Info icon */}
		{/* Collections icon */}
		{/* User Home icon */}
	</nav>
</header>

{/* Main content - no sidebar */}
<main className="flex-1">
	{children}
</main>
```

### 6. Update Home Page to Collections

**File:** `src/app/page.tsx`

**Changes:**
- Redirect `/` to `/collections` OR
- Move collections page content to `/` and remove `/collections` route
- **Recommendation:** Keep `/collections` route and redirect `/` to it (cleaner for future expansion)

**Implementation:**
```typescript
import { redirect } from 'next/navigation';

export default function Home() {
	redirect('/collections');
}
```

### 7. Update User Profile Page Structure

**Files:** `src/app/u/[username]/page.tsx`

**Current State:** Already shows public profile with UserCollectionSection at bottom

**Changes:**
- Verify UserCollectionSection is properly displayed
- Ensure this page is the "User Home" destination
- No major changes needed if structure is already correct

### 8. Display Project Entries on Project Detail Page

**File:** `src/app/projects/[id]/page.tsx`

**Changes:**
- Fetch project entries using GET `/api/projects/[id]/entries`
- Display entries below the main project card
- Use existing `ProjectEntry` component (from `src/lib/components/project/ProjectEntry.tsx`)
- Display entries in chronological order (newest first or oldest first - clarify with user)

**Display Structure:**
```
[Main Project Card]
[ProjectEntry components - one per entry] (within the Project Card)
```

**Note:** The existing `ProjectEntry` component appears to be for displaying project content, not project entry updates. May need to:
- Create new component `ProjectEntryUpdate` for displaying entry updates, OR
- Verify if `ProjectEntry` component should be reused/renamed

### 9. Create About Page (if needed for Info icon)

**File:** `src/app/about/page.tsx` (new file, if needed)

**Simple About Page Modal:**
- Mission/Vision statement
- Navigation hub with links to key pages
- Basic information about the platform
- Can be minimal for MVP

Info icon links to a modal/dropdown with navigation links (simpler for MVP)

## Deployment Preparation

### 10. Vercel Deployment Configuration

**Files:** 
- `vercel.json` (create if needed)
- `.env.example` (create/update)
- `package.json` (verify build scripts)

**Configuration:**
- Ensure `DATABASE_URL` is configured for production
- Verify build scripts work: `npm run build`
- Determine database provider (Supabase, Neon, or other)
- Document environment variables needed for deployment

**Out of Scope:**
- Full CI/CD setup
- Staging environments
- Advanced monitoring/analytics

## Testing & Validation

### 11. Manual Testing Checklist

**Layout & Navigation:**
- [ ] Sidebar is removed from all pages
- [ ] Navigation bar displays correctly on all pages
- [ ] "Project Library" title links to `/collections`
- [ ] Info icon links to About page/navigation hub
- [ ] Collections icon links to `/collections`
- [ ] User Home icon shows correct destination (logged in vs not logged in)
- [ ] Home page (`/`) redirects to `/collections`

**Project Entries:**
- [ ] Project Entry model exists in database
- [ ] Can view project entries on project detail page
- [ ] Project entries display correctly (if project has entries)
- [ ] Project owner can create new entries (POST endpoint)
- [ ] Non-owners cannot create entries (403 error)
- [ ] Unauthenticated users cannot create entries (401 error)
- [ ] Entries are sorted correctly (newest/oldest first)

**Seed Data:**
- [ ] Seed creates 9 users successfully
- [ ] Users are distributed across three interest profiles
- [ ] Project distribution matches requirements (6 users with 2, 1 with 1, 2 with 0)
- [ ] 2 projects have entries created
- [ ] Project dates are varied throughout December 2024
- [ ] Seed script runs without errors

**User Home Page:**
- [ ] `/u/[username]` displays public profile correctly
- [ ] User collection section displays at bottom
- [ ] Page is accessible to both logged-in and logged-out users

**Deployment:**
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables are documented
- [ ] Database connection string format is documented
- [ ] Vercel deployment configuration is ready

## Implementation Order

1. **Database Schema** (Task 1)
   - Add ProjectEntry model to schema.prisma
   - Run migration
   - Generate Prisma client

2. **Backend Utilities** (Task 2)
   - Create `src/lib/utils/project-entry.ts`
   - Implement `getProjectEntries()` and `createProjectEntry()`
   - Test with sample data

3. **API Routes** (Task 3)
   - Create GET `/api/projects/[id]/entries`
   - Create POST `/api/projects/[id]/entries`
   - Test endpoints with authenticated/unauthenticated requests

4. **Seed Data** (Task 4)
   - Update seed data files (users.json, projects.json, events.json)
   - Update seed.ts to handle dates and entries
   - Test seed script

5. **Layout Refactor** (Task 5)
   - Remove sidebar from layout.tsx
   - Add navigation bar with icons
   - Test navigation on all pages

6. **Home Page Redirect** (Task 6)
   - Update page.tsx to redirect to /collections
   - Test redirect works

7. **Project Entries Display** (Task 8)
   - Update project detail page to fetch and display entries
   - Test entry display (with and without entries)

8. **About Page** (Task 9)
   - Create simple About page (if needed)
   - Test Info icon navigation

9. **Deployment Prep** (Task 10)
   - Create/update deployment configuration
   - Document environment variables
   - Verify build process

10. **Testing** (Task 11)
    - Manual testing of all scenarios
    - Fix any bugs
    - Verify MVP requirements met

## Notes

- Follow existing code patterns from previous milestones
- Use standardized error helpers from `src/lib/utils/errors.ts`
- Keep navigation simple and clean (MVP focus)
- Project entries are append-only for MVP (no editing/deletion)
- Seed data should be realistic but simple enough to maintain
- Use colors from `src/app/globals.css` for styling
- User Home page (`/u/[username]`) is already the public profile - verify it meets requirements
- Collections page is already the unified view - just needs to become the landing page
- **MVP Focus:** Get to a launchable state with clean navigation and core features working smoothly

