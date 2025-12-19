# Milestone C MVP Plan - Projects

## Overview

Implement the Projects feature to demonstrate the core concept: users can create and share projects. This milestone builds on the authentication and profile systems from Milestones A and B.

## MVP Goals (Simplified)

- Users can create projects with title, description, and tags
- Public project listing page with basic search
- Individual project detail pages
- Projects are linked to their owners (users)

**Out of Scope for MVP:**
- Edit/update projects
- Delete projects
- Advanced search or tag filtering
- Project ownership management

## Database Schema Changes

### 1. Add Project Model to Prisma Schema

**File:** `prisma/schema.prisma`

Add new `Project` model with:
- `id` (String, cuid)
- `title` (String, required)
- `description` (String, required)
- `tags` (String[], array of tags)
- `createdAt` (DateTime, auto)
- `updatedAt` (DateTime, auto)
- `ownerId` (String, foreign key to User)
- Relation: `owner User @relation(fields: [ownerId], references: [id])`
- Add `projects` relation to User model

**Migration:** Create and run Prisma migration after schema update

## Backend Implementation

### 2. Create Project Validation Utilities

**File:** `src/lib/validations.ts`

Add minimal validation functions:
- `validateProjectData(data: ProjectData): { valid: boolean; error?: string }` - Combined validation
  - Title: required, 1-200 characters
  - Description: required, 1-5000 characters
  - Tags: optional array, each tag 1-50 chars, max 10 tags

Add `ProjectData` interface:
```typescript
export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
}
```

### 3. Create Project Utility Functions

**File:** `src/lib/project.ts` (new file)

Create minimal reusable database functions following the pattern from `src/lib/user.ts`:
- `getProjectById(id: string)` - Get project with owner info
- `getAllProjects(search?: string)` - Get all projects with optional basic text search (title/description)
- `createProject(ownerId: string, data: ProjectData)` - Create new project

### 4. Create Projects API Routes

**File:** `src/app/api/projects/route.ts` (new file)

**GET /api/projects**
- Public endpoint (no auth required)
- Query param: `?search=term` (optional)
- Returns list of projects with owner info (username, name)
- Use `getAllProjects()` utility
- Basic text search matches title or description

**POST /api/projects**
- Protected endpoint (requires auth)
- Validate request body with `validateProjectData()`
- Create project using `createProject()` utility
- Return created project with owner info

**File:** `src/app/api/projects/[id]/route.ts` (new file)

**GET /api/projects/[id]**
- Public endpoint (no auth required)
- Get single project by ID with owner info
- Use `getProjectById()` utility
- Return 404 if not found

## Frontend Implementation

### 5. Create Projects List Page

**File:** `src/app/projects/page.tsx` (new file)

- Public page (no auth required)
- Simple search input at top (filters by title/description)
- Display list/grid of all projects
- Each project card shows:
  - Title
  - Description (truncated to ~150 chars)
  - Tags (if any)
  - Owner name/username (link to profile)
  - Created date
  - Link to project detail page
- Loading and error states
- Empty state when no projects found

### 6. Create New Project Page

**File:** `src/app/projects/new/page.tsx` (new file)

- Protected page (redirect to login if not authenticated)
- Simple form with fields:
  - Title (required, text input)
  - Description (required, textarea)
  - Tags (optional, simple comma-separated text input)
- Basic client-side validation
- Submit creates project via POST `/api/projects`
- Redirect to project detail page on success
- Error handling and display

### 7. Create Project Detail Page

**File:** `src/app/projects/[id]/page.tsx` (new file)

- Public page (no auth required)
- Fetch project data from GET `/api/projects/[id]`
- Display:
  - Full title
  - Full description
  - Tags list (if any)
  - Owner info (name, username with link to `/u/[username]`)
  - Created date
- Loading and error states
- 404 handling if project not found

### 8. Update Navigation

**Files:** `src/app/layout.tsx` or navigation component

- Add "Projects" link to main navigation (public)
- Add "New Project" link (only visible when logged in)

## Testing & Validation

### 9. Manual Testing Checklist

- [ ] Create project as authenticated user
- [ ] View projects list (public)
- [ ] Basic search works (filters by title/description)
- [ ] View individual project detail page
- [ ] Project owner link works correctly
- [ ] Cannot create project when not logged in
- [ ] Error handling for invalid data (missing title/description)
- [ ] Loading states display correctly
- [ ] Empty states display correctly

## Implementation Order

1. **Database Layer** (Task 1)
   - Add Project model to schema
   - Run migration
   - Verify database structure

2. **Backend Utilities** (Tasks 2-3)
   - Add validation function
   - Create project utility functions (minimal set)
   - Test database queries

3. **API Routes** (Task 4)
   - Implement GET /api/projects (with basic search)
   - Implement POST /api/projects
   - Implement GET /api/projects/[id]
   - Test API endpoints

4. **Frontend Pages** (Tasks 5-7)
   - Create projects list page (with search)
   - Create new project page
   - Create project detail page
   - Test user flows

5. **Navigation & Polish** (Task 8)
   - Update navigation
   - Basic UI polish

6. **Testing** (Task 9)
   - Manual testing
   - Fix any bugs
   - Verify MVP requirements met

## Notes

- Follow existing code patterns from Milestones A & B
- Use standardized error helpers from `src/lib/errors.ts`
- Keep validation consistent with existing validation patterns
- Maintain code simplicity per project guidelines
- **MVP Focus:** Create, list, and view only. No edit/delete functionality needed to demonstrate the concept.
- Projects are public by default
- Search is basic text matching (title or description contains search term)
- Tags are optional and displayed but not filterable in MVP

