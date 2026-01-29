# Next Steps: Schema v0.3 Migration Completion

## Current State
- **Schema**: `prisma/schema.prisma` is valid and reflects the Owner-centric model
- **API Layer**: All new API routes compile cleanly, using `ownerId` and `eventDateTime`
- **Server Utilities**: `project.ts`, `event.ts` use Prisma-derived types (no casts)
- **TypeScript Errors**: 70 remaining (all in seed file and frontend)

---

## Phase 1: Seed File Rewrite (29 errors)

**File**: `prisma/seed.ts`

The seed file still references the old schema (`Actor`, `actorId`, `dateTime`, etc.).

### Changes Needed:
1. Replace `Actor` creation with `Owner` creation
2. Update user creation to include personal `Owner` records
3. Replace `ownerActorId` with `ownerId` on all artifacts
4. Replace `dateTime` with `eventDateTime` on events
5. Update org creation to follow new pattern:
   - Create user's personal `Owner` first
   - Create `Org` with `ownerId` reference
   - Create org-based `Owner` for user
   - Create `OrgMember` with `OWNER` role

### Key Model Changes:
| Old Pattern | New Pattern |
|-------------|-------------|
| `Actor` with `userId`/`orgId` | `Owner` with `userId`/`orgId` |
| `User.actorId` | `User.ownerId` (nullable until Owner created) |
| `Project.ownerActorId` | `Project.ownerId` |
| `Event.dateTime` | `Event.eventDateTime` |
| `Message.senderActorId` | `Message.senderOwnerId` |

---

## Phase 2: Frontend Component Refactor (41 errors)

### Files with Errors (by category):

#### Profile/User Components
- `src/app/profile/page.tsx`
- `src/app/profile/edit/page.tsx`
- `src/app/u/[username]/page.tsx`
- `src/app/o/[slug]/page.tsx`

**Changes**: Update to use `ownerId` instead of `actorId`, use `PublicOwner` type

#### Collection Components
- `src/app/collections/page.tsx`
- `src/lib/components/CollectionPage.tsx`
- `src/lib/components/FilteredCollection.tsx`

**Changes**: Ensure `ProjectItem`/`EventItem` types match new schema

#### Project/Event Components
- `src/app/projects/[id]/page.tsx`
- `src/app/projects/new/page.tsx`
- `src/app/events/[id]/page.tsx`
- `src/app/events/new/page.tsx`

**Changes**: Update form fields, use `eventDateTime`, update owner display

#### Message Components
- `src/app/messages/page.tsx`
- `src/app/messages/[userId]/page.tsx`

**Changes**: Update to use `Owner` for sender/receiver instead of direct `User`

### Type Updates Needed:
1. Replace `actorId` references with `ownerId`
2. Replace `dateTime` with `eventDateTime` in event forms/displays
3. Update owner display components to use `PublicOwner` utilities:
   - `getOwnerDisplayName(owner)`
   - `getOwnerHandle(owner)`
   - `isUserOwner(owner)` / `isOrgOwner(owner)`

---

## Phase 3: Testing & Cleanup

1. Run `npx prisma db push` to sync schema (dev environment)
2. Run `npm run db:seed:dev` to test seed file
3. Run `npm run dev` and manually test:
   - User signup/login
   - Project/Event CRUD
   - Profile viewing/editing
   - Org creation and switching
4. Run `npm run build` to verify production build
5. Remove any deprecated files/code

---

## Files Reference

### Updated (no errors):
- `src/lib/utils/server/project.ts` ✅
- `src/lib/utils/server/event.ts` ✅
- `src/lib/utils/server/fields.ts` ✅
- `src/lib/utils/owner.ts` ✅
- `src/lib/types/user.ts` ✅
- `src/lib/types/event.ts` ✅
- `src/lib/types/project.ts` ✅
- `src/lib/types/collection-base.ts` ✅
- `src/app/api/events/route.ts` ✅
- `src/app/api/events/[id]/route.ts` ✅
- `src/app/api/projects/route.ts` ✅
- `src/app/api/projects/[id]/route.ts` ✅

### Pending:
- `prisma/seed.ts` (29 errors)
- Frontend pages/components (41 errors)

---

## Commands

```bash
# Check TypeScript errors
npx tsc --noEmit

# Count errors
npx tsc --noEmit 2>&1 | grep -c "error TS"

# See errors by file
npx tsc --noEmit 2>&1 | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -rn
```
