# Migration Quick Reference: Schema v1 → v2

## Model Changes at a Glance

### User Model
| Field | v1 | v2 | Migration Notes |
|-------|----|----|-----------------|
| `name` | ✅ | ❌ | Split into `firstName`, `middleName`, `lastName` |
| `actorId` | ❌ | ✅ | **NEW** - Required, links to Actor |
| `avatarImageId` | ❌ | ✅ | **NEW** - Direct avatar image relation |
| Direct `projects` relation | ✅ | ❌ | Now through Actor |
| Direct `events` relation | ✅ | ❌ | Now through Actor |
| Direct `posts` relation | ❌ | ✅ | **NEW** - Now through Actor (Posts owned by Actor) |

### Project Model
| Field | v1 | v2 | Migration Notes |
|-------|----|----|-----------------|
| `type` | ✅ | ❌ | Discriminator field removed |
| `ownerId` | ✅ (User) | ❌ | Replaced by `ownerActorId` (Actor) |
| `posts` relation | ❌ | ✅ | **NEW** - Descendant posts |
| Direct `images` relation | ✅ | ❌ | Now through ImageAttachment |

### Event Model
| Field | v1 | v2 | Migration Notes |
|-------|----|----|-----------------|
| `type` | ✅ | ❌ | Discriminator field removed |
| `ownerId` | ✅ (User) | ❌ | Replaced by `ownerActorId` (Actor) |
| `posts` relation | ❌ | ✅ | **NEW** - Descendant posts |
| Direct `images` relation | ✅ | ❌ | Now through ImageAttachment |

### Image Model
| Field | v1 | v2 | Migration Notes |
|-------|----|----|-----------------|
| `projectId` | ✅ | ❌ | Replaced by ImageAttachment |
| `eventId` | ✅ | ❌ | Replaced by ImageAttachment |
| `postId` | ✅ | ❌ | Replaced by ImageAttachment |
| `attachments` relation | ❌ | ✅ | **NEW** - ImageAttachment[] |
| `userAvatarFor` relation | ❌ | ✅ | **NEW** - Backref for user avatars |
| `orgAvatarFor` relation | ❌ | ✅ | **NEW** - Backref for org avatars |

### Entry → Post Model
| Field | v1 (Entry) | v2 (Post) | Migration Notes |
|-------|-----------|-----------|-----------------|
| `collectionType` | ✅ | ❌ | Replaced by `projectId`/`eventId` |
| `collectionId` | ✅ | ❌ | Replaced by `projectId`/`eventId` |
| `ownerActorId` | ❌ | ✅ | **NEW** - Posts owned by Actor |
| `projectId` | ❌ | ✅ | **NEW** - Optional, for descendant posts |
| `eventId` | ❌ | ✅ | **NEW** - Optional, for descendant posts |
| `title` | ✅ | ✅ | Same (optional) |
| `content` | ✅ | ✅ | Same (required) |

### New Models in v2
- `Actor` - Unified identity layer
- `Org` - Organizations (with avatar support)
- `OrgMember` - Organization membership
- `OrgRoleLabel` - Custom role labels
- `Follow` - Actor-to-actor follows
- `Post` - Standalone or descendant posts (replaces Entry)
- `ImageAttachment` - Polymorphic image attachments (PROJECT, EVENT, POST)

---

## Code Change Patterns

### Querying Projects/Events by Owner

**v1:**
```typescript
const projects = await prisma.project.findMany({
  where: { ownerId: userId },
  include: { owner: true }
});
```

**v2:**
```typescript
// First get user's actor
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { actorId: true }
});

const projects = await prisma.project.findMany({
  where: { ownerActorId: user.actorId },
  include: { 
    owner: {
      include: { user: true } // or org: true
    }
  }
});
```

### Creating Projects/Events

**v1:**
```typescript
await prisma.project.create({
  data: {
    title: "...",
    ownerId: userId
  }
});
```

**v2:**
```typescript
// Get user's actorId first
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { actorId: true }
});

await prisma.project.create({
  data: {
    title: "...",
    ownerActorId: user.actorId
  }
});
```

### Image Attachments

**v1:**
```typescript
await prisma.image.create({
  data: {
    url: "...",
    projectId: projectId,
    uploadedById: userId
  }
});
```

**v2:**
```typescript
// Create image
const image = await prisma.image.create({
  data: {
    url: "...",
    uploadedById: userId
  }
});

// Create attachment
await prisma.imageAttachment.create({
  data: {
    imageId: image.id,
    type: AttachmentType.PROJECT,
    targetId: projectId,
    sortOrder: 0
  }
});
```

### Querying Images for Project/Event

**v1:**
```typescript
const project = await prisma.project.findUnique({
  where: { id: projectId },
  include: { images: true }
});
```

**v2:**
```typescript
const attachments = await prisma.imageAttachment.findMany({
  where: {
    type: AttachmentType.PROJECT,
    targetId: projectId
  },
  include: { image: true },
  orderBy: { sortOrder: 'asc' }
});

const images = attachments.map(a => a.image);
```

### User Name Display

**v1:**
```typescript
const displayName = user.name || user.username;
```

**v2:**
```typescript
const displayName = [
  user.firstName,
  user.middleName,
  user.lastName
].filter(Boolean).join(' ') || user.username;
```

### Entry → Post Migration

**v1 (Entry):**
```typescript
const entry = await prisma.entry.create({
  data: {
    collectionType: "project",
    collectionId: projectId,
    title: "Update #1",
    content: "Progress update..."
  }
});
```

**v2 (Post):**
```typescript
// Get actor for owner
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { actorId: true }
});

const post = await prisma.post.create({
  data: {
    ownerActorId: user.actorId,
    projectId: projectId,  // or eventId, or null for standalone
    title: "Update #1",
    content: "Progress update..."
  }
});
```

### Querying Posts

**v1 (Entries):**
```typescript
const entries = await prisma.entry.findMany({
  where: {
    collectionType: "project",
    collectionId: projectId
  }
});
```

**v2 (Posts):**
```typescript
// For project posts
const posts = await prisma.post.findMany({
  where: { projectId: projectId }
});

// For event posts
const posts = await prisma.post.findMany({
  where: { eventId: eventId }
});

// For standalone posts
const posts = await prisma.post.findMany({
  where: {
    projectId: null,
    eventId: null
  }
});
```

---

## Common Migration Tasks

### 1. Update Type Definitions
- Remove `type` from ProjectItem/EventItem
- Change `ownerId` → `ownerActorId` 
- Update owner type to Actor (with user/org union)
- Update ImageItem to remove projectId/eventId, add avatar backrefs
- Add ImageAttachment type
- **Rename** Entry types → Post types
- Update EntryItem to PostItem (with ownerActorId, projectId/eventId)

### 2. Update Server Functions
- All `ownerId` references → `ownerActorId`
- Add Actor lookup before creating projects/events/posts
- Update image creation to use ImageAttachment
- Update image queries to use ImageAttachment
- **Rename** entry utilities → post utilities
- Update Entry queries to use Post model with projectId/eventId

### 3. Update API Routes
- Owner validation: check Actor ownership
- Image upload: create ImageAttachment
- Project/Event creation: use actorId
- **Rename** entry routes → post routes
- Update entry endpoints to use Post model
- Add avatar upload/update endpoints

### 4. Update Components
- Owner display: access through Actor.user or Actor.org
- Name display: use firstName/lastName
- Image queries: use ImageAttachment
- Avatar display: use User.avatarImage or Org.avatarImage
- **Rename** Entry components → Post components
- Update entry displays to use Post model

---

## Critical Migration Steps

1. **Create Actor records** for all existing users
2. **Link users to actors** via actorId
3. **Migrate name field** to firstName/lastName
4. **Update project ownership** (ownerId → ownerActorId)
5. **Update event ownership** (ownerId → ownerActorId)
6. **Migrate entries to posts** (collectionType/collectionId → projectId/eventId)
7. **Migrate image attachments** to ImageAttachment table
8. **Add avatar support** (avatarImageId fields)
9. **Remove deprecated fields** (type, old FKs, name, entries table)

---

## Files Requiring Updates

### High Priority
- `src/lib/utils/server/project.ts`
- `src/lib/utils/server/event.ts`
- `src/lib/utils/server/entry.ts` → **Rename to** `post.ts`
- `src/lib/utils/server/fields.ts`
- `src/lib/types/user.ts`
- `src/lib/types/project.ts`
- `src/lib/types/event.ts`
- `src/lib/types/entry.ts` → **Rename to** `post.ts`
- `src/lib/types/image.ts`
- `src/app/api/projects/upload/route.ts`
- `src/app/api/projects/[id]/entries/route.ts` → **Rename to** `posts/route.ts`
- `src/app/api/events/[id]/entries/route.ts` → **Rename to** `posts/route.ts`

### Medium Priority
- All API routes using ownerId
- All components displaying owner info
- All forms using User.name
- All components using Entry model → Post
- Avatar upload/display components
- Authentication/session handling

### Low Priority
- Seed scripts
- Test utilities
- Documentation

---

## Testing Checklist

- [ ] User registration creates Actor
- [ ] Existing users can log in
- [ ] Projects display correct owner
- [ ] Events display correct owner
- [ ] Posts creation works (standalone and descendant)
- [ ] Posts display correctly on projects/events
- [ ] Entry functionality migrated to Post works
- [ ] Image upload works
- [ ] Images display on projects/events/posts
- [ ] Avatar upload/display works
- [ ] User profile shows name correctly
- [ ] Project/Event creation works
- [ ] Owner validation works
- [ ] All existing features functional

