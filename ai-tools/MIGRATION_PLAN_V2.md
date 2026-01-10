# Migration Plan: Schema v1 → Schema v2

## Overview

This document outlines the migration strategy from the current schema (`schema.prisma`) to the new schema v2 (`scema-v2.prisma`). The v2 schema introduces an Actor abstraction layer, organization support, and a polymorphic image attachment system.

## Key Architectural Changes

### 1. Actor Abstraction Layer
- **New**: `Actor` model serves as unified identity for both Users and Organizations
- **Impact**: Projects and Events are now owned by `Actor`, not directly by `User`
- **Benefit**: Enables organization-owned content and unified following system

### 2. User Model Changes
- **Split**: `name` field → `firstName`, `middleName`, `lastName`
- **New**: `actorId` field (required, unique) linking to Actor
- **New**: `avatarImageId` field for direct avatar image relation
- **Removed**: Direct `projects` and `events` relations (now through Actor)
- **New**: Can own `posts` through Actor (Posts have `ownerActorId`)

### 3. Project/Event Ownership
- **Changed**: `ownerId` (User) → `ownerActorId` (Actor)
- **Removed**: `type` discriminator field (no longer needed)
- **Removed**: Direct `images` relation

### 4. Image Attachment System
- **Changed**: Direct foreign keys (`projectId`, `eventId`) → polymorphic `ImageAttachment` model
- **New**: `ImageAttachment` with `type` (enum) and `targetId` for flexible attachments
- **Benefit**: Supports attachments to Projects, Events, Posts
- **Avatar Support**: User and Org have direct `avatarImageId` relation (not via ImageAttachment)

### 5. Entry → Post Migration
- **Replaced**: `Entry` model → `Post` model
- **New Features**: 
  - Posts can be standalone (no parent) or attached to Project/Event
  - Posts have `ownerActorId` (owned by Actor, like Projects/Events)
  - Posts have optional `projectId` and `eventId` for descendant posts
- **Migration**: Existing entries should migrate to Posts with appropriate `collectionType` → `projectId`/`eventId` mapping

### 6. New Features
- **Organizations**: `Org`, `OrgMember`, `OrgRoleLabel` models
- **Following**: `Follow` model for Actor-to-Actor follows
- **Posts**: Standalone or descendant posts (replaces Entry model)
- **Avatars**: Direct avatar support for User and Org via `avatarImageId`
- **Enums**: `ActorType`, `OrgRole`, `AttachmentType` (PROJECT, EVENT, POST)

---

## Migration Strategy

### Phase 1: Preparation & Analysis

#### 1.1 Schema Review & Decisions
- [x] **Decision**: `Entry` model → `Post` model (confirmed)
  - Migrate entries to posts with `collectionType` → `projectId`/`eventId` mapping
  - Standalone entries become standalone posts
- [ ] **Decision**: Handle `name` → `firstName`/`lastName` split
  - Strategy: Parse existing `name` field or default to `firstName = name`
- [ ] **Decision**: Migration approach (big bang vs. gradual)
  - Recommended: Big bang with comprehensive data migration script

#### 1.2 Backup & Safety
- [ ] Create full database backup
- [ ] Document current schema state
- [ ] Test migration on staging/dev environment first
- [ ] Create rollback plan

#### 1.3 Codebase Audit
- [ ] Identify all files using `ownerId` on Project/Event
- [ ] Identify all files using `projectId`/`eventId` on Image
- [ ] Identify all files using `name` field on User
- [ ] Identify all files using `type` field on Project/Event
- [ ] Document all Entry model usage (to migrate to Post)
- [ ] Identify avatar/image display code (for User/Org avatars)

---

### Phase 2: Database Migration

#### 2.1 Create Migration Script

**Step 1: Create Actor records for all Users**
```sql
-- For each user, create an Actor record
INSERT INTO actors (id, type, "createdAt")
SELECT 
  gen_random_uuid()::text,  -- or use cuid() equivalent
  'USER',
  "createdAt"
FROM users;
```

**Step 2: Link Users to Actors**
```sql
-- Add actorId column to users (temporary, will be permanent)
ALTER TABLE users ADD COLUMN "actorId" TEXT;
-- Update users with their actor IDs
-- (Requires mapping logic in migration script)
```

**Step 3: Migrate User name field**
```sql
-- Add new name fields
ALTER TABLE users ADD COLUMN "firstName" TEXT;
ALTER TABLE users ADD COLUMN "middleName" TEXT;
ALTER TABLE users ADD COLUMN "lastName" TEXT;

-- Migrate existing name data
-- Strategy: Split on first space, or set firstName = name
UPDATE users SET "firstName" = COALESCE(name, username);
```

**Step 4: Migrate Project ownership**
```sql
-- Add ownerActorId column
ALTER TABLE projects ADD COLUMN "ownerActorId" TEXT;

-- Populate ownerActorId from ownerId
UPDATE projects p
SET "ownerActorId" = u."actorId"
FROM users u
WHERE p."ownerId" = u.id;

-- Add foreign key constraint
ALTER TABLE projects 
  ADD CONSTRAINT "projects_ownerActorId_fkey" 
  FOREIGN KEY ("ownerActorId") REFERENCES actors(id) ON DELETE CASCADE;
```

**Step 5: Migrate Event ownership**
```sql
-- Same process as Projects
ALTER TABLE events ADD COLUMN "ownerActorId" TEXT;

UPDATE events e
SET "ownerActorId" = u."actorId"
FROM users u
WHERE e."ownerId" = u.id;

ALTER TABLE events 
  ADD CONSTRAINT "events_ownerActorId_fkey" 
  FOREIGN KEY ("ownerActorId") REFERENCES actors(id) ON DELETE CASCADE;
```

**Step 6: Migrate Image attachments**
```sql
-- Create image_attachments table
CREATE TABLE image_attachments (
  id TEXT PRIMARY KEY,
  "imageId" TEXT NOT NULL,
  type TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "sortOrder" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "image_attachments_imageId_fkey" 
    FOREIGN KEY ("imageId") REFERENCES images(id) ON DELETE CASCADE
);

-- Migrate project images
INSERT INTO image_attachments (id, "imageId", type, "targetId", "sortOrder", "createdAt")
SELECT 
  gen_random_uuid()::text,
  id,
  'PROJECT',
  "projectId",
  0,
  "createdAt"
FROM images
WHERE "projectId" IS NOT NULL;

-- Migrate event images
INSERT INTO image_attachments (id, "imageId", type, "targetId", "sortOrder", "createdAt")
SELECT 
  gen_random_uuid()::text,
  id,
  'EVENT',
  "eventId",
  0,
  "createdAt"
FROM images
WHERE "eventId" IS NOT NULL;

-- Note: Post images will be created as posts are created/migrated
-- No existing postId images to migrate (posts are new in v2)

-- Remove old foreign key columns (after migration verified)
-- ALTER TABLE images DROP COLUMN "projectId";
-- ALTER TABLE images DROP COLUMN "eventId";
-- ALTER TABLE images DROP COLUMN "postId";
```

**Step 7: Migrate Entry → Post**
```sql
-- Create posts table
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  "ownerActorId" TEXT NOT NULL,
  "projectId" TEXT,
  "eventId" TEXT,
  title TEXT,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "posts_ownerActorId_fkey" 
    FOREIGN KEY ("ownerActorId") REFERENCES actors(id) ON DELETE CASCADE,
  CONSTRAINT "posts_projectId_fkey" 
    FOREIGN KEY ("projectId") REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT "posts_eventId_fkey" 
    FOREIGN KEY ("eventId") REFERENCES events(id) ON DELETE CASCADE
);

-- Migrate entries to posts
-- For project entries
INSERT INTO posts (id, "ownerActorId", "projectId", title, content, "createdAt", "updatedAt")
SELECT 
  e.id,
  p."ownerActorId",  -- Use project's ownerActorId
  e."collectionId" as "projectId",
  e.title,
  e.content,
  e."createdAt",
  e."updatedAt"
FROM entries e
JOIN projects p ON e."collectionId" = p.id
WHERE e."collectionType" = 'project';

-- For event entries
INSERT INTO posts (id, "ownerActorId", "eventId", title, content, "createdAt", "updatedAt")
SELECT 
  e.id,
  ev."ownerActorId",  -- Use event's ownerActorId
  e."collectionId" as "eventId",
  e.title,
  e.content,
  e."createdAt",
  e."updatedAt"
FROM entries e
JOIN events ev ON e."collectionId" = ev.id
WHERE e."collectionType" = 'event';

-- Note: Standalone entries (no collectionType match) can be migrated as standalone posts
-- You may need to determine ownerActorId from context or use a default

-- Create indexes
CREATE INDEX "posts_ownerActorId_createdAt_idx" ON posts("ownerActorId", "createdAt");
CREATE INDEX "posts_projectId_createdAt_idx" ON posts("projectId", "createdAt");
CREATE INDEX "posts_eventId_createdAt_idx" ON posts("eventId", "createdAt");

-- Drop entries table after verification
-- DROP TABLE entries;
```

**Step 8: Add Avatar Support**
```sql
-- Add avatar fields to users
ALTER TABLE users ADD COLUMN "avatarImageId" TEXT;
ALTER TABLE users ADD CONSTRAINT "users_avatarImageId_fkey" 
  FOREIGN KEY ("avatarImageId") REFERENCES images(id) ON DELETE SET NULL;

-- Add avatar fields to orgs (for future use)
-- ALTER TABLE orgs ADD COLUMN "avatarImageId" TEXT;
-- ALTER TABLE orgs ADD CONSTRAINT "orgs_avatarImageId_fkey" 
--   FOREIGN KEY ("avatarImageId") REFERENCES images(id) ON DELETE SET NULL;
```

**Step 9: Remove deprecated fields**
```sql
-- Remove type field from projects/events (if not needed)
ALTER TABLE projects DROP COLUMN IF EXISTS type;
ALTER TABLE events DROP COLUMN IF EXISTS type;

-- Remove old ownerId columns (after verification)
-- ALTER TABLE projects DROP COLUMN "ownerId";
-- ALTER TABLE events DROP COLUMN "ownerId";

-- Remove name column (after firstName/lastName migration)
-- ALTER TABLE users DROP COLUMN name;
```

#### 2.2 Prisma Migration
- [ ] Create new migration from v2 schema
- [ ] Review generated SQL against manual migration script
- [ ] Test migration on copy of production data
- [ ] Execute migration on staging
- [ ] Verify data integrity

---

### Phase 3: Code Migration

#### 3.1 Type System Updates

**Files to Update:**
- `src/lib/types/user.ts` - Add firstName, middleName, lastName, actorId, avatarImageId
- `src/lib/types/project.ts` - Remove type field, update owner type, add posts relation
- `src/lib/types/event.ts` - Remove type field, update owner type, add posts relation
- `src/lib/types/image.ts` - Remove projectId/eventId, add attachments, add avatar backrefs
- `src/lib/types/entry.ts` - **Rename/Replace** with `post.ts` (Entry → Post)
- `src/lib/types/collection.ts` - Update type guards (remove type discriminator?)

#### 3.2 Server Utilities

**Priority Files:**
1. `src/lib/utils/server/project.ts`
   - Change `ownerId` → `ownerActorId` in queries
   - Update `createProject` to accept `actorId`
   - Update field selections to use Actor relation

2. `src/lib/utils/server/event.ts`
   - Same changes as project.ts

3. `src/lib/utils/server/fields.ts`
   - Update `projectWithOwnerFields` to use Actor relation
   - Update `eventWithOwnerFields` to use Actor relation
   - Update `imageFields` to remove projectId/eventId
   - Add `imageAttachmentFields` for new model

4. `src/lib/utils/server/user.ts`
   - Update to handle Actor creation when creating users
   - Update name field handling

5. `src/lib/utils/server/image.ts` (if exists)
   - Update image queries to use ImageAttachment
   - Update attachment creation logic

6. `src/lib/utils/server/entry.ts` → `post.ts`
   - **Rename file** and update all Entry references to Post
   - Update to use `ownerActorId` instead of collectionType/collectionId
   - Update to support `projectId`/`eventId` for descendant posts

#### 3.3 API Routes

**Files to Update:**
- `src/app/api/projects/route.ts` - Update create/query logic
- `src/app/api/projects/[id]/route.ts` - Update owner checks
- `src/app/api/projects/upload/route.ts` - Update to use ImageAttachment
- `src/app/api/events/route.ts` - Same as projects
- `src/app/api/events/[id]/route.ts` - Same as projects
- `src/app/api/profile/route.ts` - Update name field handling, add avatar support
- `src/app/api/projects/[id]/entries/route.ts` → `posts/route.ts` - Update Entry → Post
- `src/app/api/events/[id]/entries/route.ts` → `posts/route.ts` - Update Entry → Post

#### 3.4 Components

**Files to Update:**
- `src/lib/components/project/ProjectCard.tsx` - Update owner access
- `src/lib/components/event/EventCard.tsx` - Update owner access
- `src/lib/components/collection/CollectionCard.tsx` - Update owner access
- `src/lib/components/user/ProfileHeader.tsx` - Update name display
- All forms using User.name → firstName/lastName

#### 3.5 Authentication & Session

**Files to Update:**
- `src/lib/auth.ts` - Ensure session includes actorId
- Update session type to include actorId

---

### Phase 4: Helper Functions & Utilities

#### 4.1 Actor Utilities
Create `src/lib/utils/server/actor.ts`:
```typescript
// Get actor for a user
export async function getActorForUser(userId: string): Promise<Actor | null>

// Get user for an actor
export async function getUserForActor(actorId: string): Promise<User | null>

// Check if actor owns a project/event
export async function actorOwnsProject(actorId: string, projectId: string): Promise<boolean>
```

#### 4.2 Image Attachment Utilities
Create `src/lib/utils/server/image-attachment.ts`:
```typescript
// Attach image to a target
export async function attachImage(
  imageId: string, 
  type: AttachmentType, 
  targetId: string, 
  sortOrder?: number
): Promise<ImageAttachment>

// Get images for a target
export async function getImagesForTarget(
  type: AttachmentType, 
  targetId: string
): Promise<ImageItem[]>

// Remove image attachment
export async function detachImage(imageId: string, targetId: string): Promise<void>
```

---

### Phase 5: Testing & Validation

#### 5.1 Data Integrity Checks
- [ ] Verify all users have corresponding Actor records
- [ ] Verify all projects have valid ownerActorId
- [ ] Verify all events have valid ownerActorId
- [ ] Verify all entries migrated to posts correctly
- [ ] Verify all images have corresponding ImageAttachment records (or are avatars)
- [ ] Verify no orphaned data

#### 5.2 Functional Testing
- [ ] User registration creates Actor
- [ ] Project creation uses actorId
- [ ] Event creation uses actorId
- [ ] Post creation works (standalone and descendant)
- [ ] Image upload creates ImageAttachment
- [ ] Avatar upload/display works for users
- [ ] Project/Event queries return correct owner data
- [ ] User profile displays correctly with new name fields
- [ ] Entry functionality migrated to Post works correctly
- [ ] All existing features work as expected

#### 5.3 Edge Cases
- [ ] Users with null/empty name field
- [ ] Projects/Events with missing owners
- [ ] Images without attachments (avatars are direct relations)
- [ ] Entries with invalid collectionType/collectionId
- [ ] Posts with both projectId and eventId (should be prevented)
- [ ] Migration rollback scenarios

---

### Phase 6: Deployment

#### 6.1 Pre-Deployment
- [ ] Final backup of production database
- [ ] Deploy code changes (with feature flag if gradual migration)
- [ ] Run migration script on production
- [ ] Verify migration success

#### 6.2 Post-Deployment
- [ ] Monitor error logs
- [ ] Verify critical user flows
- [ ] Check database performance
- [ ] Monitor for any data inconsistencies

#### 6.3 Rollback Plan
- [ ] Keep v1 schema backup
- [ ] Document rollback SQL script
- [ ] Test rollback procedure on staging
- [ ] Have rollback decision criteria ready

---

## Migration Checklist Summary

### Critical Path
1. ✅ Create migration plan (this document)
2. ✅ Entry → Post migration strategy confirmed
3. ⬜ Create data migration script
4. ⬜ Update Prisma schema to v2
5. ⬜ Update TypeScript types
6. ⬜ Update server utilities
7. ⬜ Update API routes
8. ⬜ Update components
9. ⬜ Test on staging
10. ⬜ Deploy to production

### Estimated Timeline
- **Phase 1 (Preparation)**: 1-2 days
- **Phase 2 (Database Migration)**: 2-3 days
- **Phase 3 (Code Migration)**: 3-5 days
- **Phase 4 (Utilities)**: 1-2 days
- **Phase 5 (Testing)**: 2-3 days
- **Phase 6 (Deployment)**: 1 day

**Total**: ~10-16 days (depending on Entry→Post migration complexity and testing thoroughness)

---

## Notes & Considerations

### Breaking Changes
1. **User.name** → User.firstName/lastName (requires UI updates)
2. **Project.ownerId** → Project.ownerActorId (requires code updates)
3. **Event.ownerId** → Event.ownerActorId (requires code updates)
4. **Image direct FKs** → ImageAttachment (requires query changes)
5. **Project/Event.type** removed (may affect collection filtering)
6. **Entry model** → Post model (requires code refactoring)
7. **Entry collectionType/collectionId** → Post projectId/eventId (different pattern)

### Backward Compatibility
- Consider maintaining temporary compatibility layer during transition
- Use feature flags if gradual rollout is preferred
- Keep old fields temporarily with triggers to sync

### Performance Considerations
- Actor joins add one level of indirection (minimal impact with proper indexing)
- ImageAttachment queries may need optimization
- Consider caching Actor lookups

### Future Enhancements Enabled
- Organization-owned projects/events
- User-to-user and user-to-org following
- Flexible image attachments (Projects, Events, Posts)
- Direct avatar support for Users and Orgs
- Standalone posts (not tied to projects/events)
- Descendant posts (posts within projects/events)
- Unified actor-based permissions system

---

## Questions to Resolve

1. ✅ **Entry Model**: Entry → Post migration confirmed
2. **Name Migration**: How to handle users with complex names (middle names, suffixes)?
3. **Type Discriminator**: Is `type` field still needed for collection filtering, or can we use model type?
4. **Gradual vs Big Bang**: Should we migrate gradually with compatibility layer, or all at once?
5. **Actor ID Generation**: Use cuid() or UUID for Actor IDs? (Schema uses cuid())
6. **Post Ownership**: For migrated entries, should ownerActorId come from parent Project/Event or original entry creator?

---

## Next Steps

1. Review this plan with team
2. Resolve open questions
3. Create detailed migration script
4. Begin Phase 1 implementation

