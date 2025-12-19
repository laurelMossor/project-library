# Milestone E MVP Plan - Enhanced Projects & Messaging

## Overview

Enhance the Projects feature with image support and improve navigation, then add basic direct messaging functionality. This milestone builds on the existing authentication, profile, and projects systems. Keep implementation simple and MVP-focused.

## MVP Goals (Simplified)

**Project Enhancements:**
- Users can upload a single image when creating a project
- Projects display with images in listing and detail pages
- Enhanced navigation links between projects and user profiles

**Messaging:**
- Authenticated users can send direct messages to other users
- View conversation threads
- Simple message list/interface

**Out of Scope for MVP:**
- Multiple images per project
- Image editing/cropping
- Real-time messaging (polling or page refresh is fine)
- Message notifications
- File attachments in messages
- Group messaging
- Message search
- Read receipts

## Database Schema Changes

### 1. Add Image Field to Project Model

**File:** `prisma/schema.prisma`

Add to existing `Project` model:
- `imageUrl` (String, optional) - URL/path to uploaded image

**Migration:** Create and run Prisma migration after schema update

### 2. Add Message Model

**File:** `prisma/schema.prisma`

Add new `Message` model:
- `id` (String, cuid)
- `content` (String, required) - message text
- `senderId` (String, foreign key to User)
- `receiverId` (String, foreign key to User)
- `createdAt` (DateTime, auto)
- `readAt` (DateTime, optional) - for future read receipts
- Relations: `sender User @relation("SentMessages")` and `receiver User @relation("ReceivedMessages")`
- Add `sentMessages` and `receivedMessages` relations to User model

**Migration:** Create and run Prisma migration after schema update

## Image Storage Strategy (MVP)

**Simple Approach:**
- Store images in `public/uploads/projects/` directory
- Generate unique filename (e.g., `{projectId}-{timestamp}.{ext}`)
- Store relative path in database (e.g., `/uploads/projects/abc123-1234567890.jpg`)
- Use Next.js built-in static file serving

**Alternative (if needed later):**
- Cloud storage (AWS S3, Cloudinary, etc.)
- For MVP, local storage is sufficient

## Backend Implementation

### 2. Update Project Validation

**File:** `src/lib/validations.ts`

Update `ProjectData` interface:
```typescript
export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
	imageUrl?: string; // optional image URL
}
```

### 3. Update Project Utilities

**File:** `src/lib/project.ts`

- Update `createProject()` to accept optional `imageUrl`
- Update `projectWithOwnerFields` to include `imageUrl` in select

### 4. Create Image Upload API Route

**File:** `src/app/api/projects/upload/route.ts` (new file)

**POST /api/projects/upload**
- Protected endpoint (requires authentication)
- Accept multipart/form-data with image file
- Validate file type (images only: jpg, jpeg, png, webp)
- Validate file size (max 5MB for MVP)
- Save file to `public/uploads/projects/`
- Return image URL/path
- Handle errors gracefully

### 5. Update Projects API Routes

**File:** `src/app/api/projects/route.ts`

- Update POST handler to accept optional `imageUrl` in request body
- Validate imageUrl format if provided

### 6. Create Message Utilities

**File:** `src/lib/message.ts` (new file)

Create reusable database functions:
- `getConversations(userId: string)` - Get all conversations for a user (list of other users they've messaged/been messaged by)
- `getMessages(userId: string, otherUserId: string)` - Get messages between two users
- `sendMessage(senderId: string, receiverId: string, content: string)` - Create new message
- `getUnreadCount(userId: string)` - Get count of unread messages (optional, for future)

### 7. Create Messages API Routes

**File:** `src/app/api/messages/route.ts` (new file)

**GET /api/messages**
- Protected endpoint
- Returns list of conversations (other users with message history)
- Include last message preview and unread count

**POST /api/messages**
- Protected endpoint
- Body: `{ receiverId: string, content: string }`
- Validate content (required, max length)
- Create message using `sendMessage()` utility
- Return created message

**File:** `src/app/api/messages/[userId]/route.ts` (new file)

**GET /api/messages/[userId]**
- Protected endpoint
- Returns messages between current user and specified user
- Sorted by createdAt (oldest first)
- Use `getMessages()` utility

## Frontend Implementation

### 8. Update Project Creation Form

**File:** `src/app/projects/new/page.tsx`

- Add image upload input (file input)
- Show image preview after selection
- Upload image to `/api/projects/upload` before submitting project
- Include `imageUrl` in project creation request
- Handle upload errors

### 9. Update Projects List Page

**File:** `src/app/projects/page.tsx`

- Display project images in cards (if available)
- Use Next.js `Image` component for optimization
- Show placeholder if no image

### 10. Update Project Detail Page

**File:** `src/app/projects/[id]/page.tsx`

- Display project image prominently (if available)
- Enhance owner link styling/visibility
- Add "Message Owner" button/link (if not viewing own project)

### 11. Create Messages List Page

**File:** `src/app/messages/page.tsx` (new file)

- Protected page (redirect to login if not authenticated)
- Fetch conversations from GET `/api/messages`
- Display list of conversations with:
  - Other user's name/username
  - Last message preview (truncated)
  - Timestamp
  - Unread indicator (if implemented)
- Link to individual conversation
- Empty state when no messages
- Loading and error states

### 12. Create Individual Conversation Page

**File:** `src/app/messages/[userId]/page.tsx` (new file)

- Protected page
- Fetch messages from GET `/api/messages/[userId]`
- Display conversation with:
  - Other user's info at top
  - Message list (sender/receiver distinction)
  - Message input form at bottom
- Submit new messages via POST `/api/messages`
- Auto-refresh or manual refresh to see new messages
- Scroll to bottom to show latest messages

### 13. Add Message Links

**Files:** `src/app/u/[username]/page.tsx`, `src/app/projects/[id]/page.tsx`

- Add "Send Message" button/link on user profiles
- Add "Message Owner" button on project detail pages (if not own project)
- Link to `/messages/[userId]` or create new conversation

### 14. Update Navigation

**Files:** `src/app/page.tsx` or navigation component

- Add "Messages" link to navigation (only visible when logged in)
- Show unread count badge (if implemented)

## Testing & Validation

### 15. Manual Testing Checklist

**Image Upload:**
- [ ] Upload image when creating project
- [ ] Image displays in project list
- [ ] Image displays on project detail page
- [ ] Project without image shows placeholder or no image
- [ ] Invalid file types are rejected
- [ ] Files over size limit are rejected
- [ ] Cannot create project when not logged in

**Messaging:**
- [ ] View messages list when logged in
- [ ] Start new conversation from user profile
- [ ] Start new conversation from project page
- [ ] Send message successfully
- [ ] Receive and view messages
- [ ] Messages display in correct order
- [ ] Cannot access messages when not logged in
- [ ] Cannot message yourself (validation)
- [ ] Empty states display correctly

## Implementation Order

1. **Database Layer** (Tasks 1-2)
   - Add `imageUrl` to Project model
   - Add Message model
   - Run migrations
   - Verify database structure

2. **Image Upload** (Tasks 3-6)
   - Update project validation and utilities
   - Create image upload API route
   - Update project creation API
   - Test image upload

3. **Frontend Image Support** (Tasks 8-10)
   - Update project creation form
   - Update projects list page
   - Update project detail page
   - Test image display

4. **Messaging Backend** (Tasks 6-7)
   - Create message utilities
   - Create messages API routes
   - Test API endpoints

5. **Messaging Frontend** (Tasks 11-13)
   - Create messages list page
   - Create conversation page
   - Add message links to profiles/projects
   - Test messaging flow

6. **Navigation & Polish** (Task 14)
   - Update navigation
   - Basic UI polish

7. **Testing** (Task 15)
   - Manual testing
   - Fix any bugs
   - Verify MVP requirements met

## Notes

- Follow existing code patterns from previous milestones
- Use standardized error helpers from `src/lib/errors.ts`
- Keep image handling simple (local storage for MVP)
- Message content validation: required, max 5000 characters
- Consider adding `readAt` field for future read receipts (not required for MVP)
- **MVP Focus:** Single image per project, basic text messaging. No real-time features or advanced functionality needed to demonstrate the concept.
- Image upload should happen before project creation (upload first, then include URL in project data)
- For messages, consider pagination if conversation gets long (optional for MVP)
- Message timestamps should be human-readable (e.g., "2 hours ago" or formatted date)

