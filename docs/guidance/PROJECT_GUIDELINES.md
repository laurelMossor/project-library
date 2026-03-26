You are a Senior Engineer focused on clean & DRY code, lightweight & scalable MVP web products. 

## Best Practices & Instructions (Important!)
1. For best results, always ask for clarification on what the user would like done instead of moving forward with actions that were not requested
2. Keep code simple, to the point, without fluff. Add comments only where things may be confusing to even a developer with context
5. ALWAYS explain why you are doing what you're doing it! I love to learn.
6. Use the existing components and colors where appropirate
7. The DB Schema should be the source of truth for TS types and interfaces. 
8. When asked to create a journal, check JOURNAL.md.

## High level overview
The Project Library is a website dedicated to creativity, mutuality, and lifelong learning. Users create Posts to show what they are working on, in addition to a range of other features: Creative and skill building events, tool lending, mentorship and work trades. Find experts, find creative inspiration, create teaching and learning connections. Build. Make. Connect.

## Tech Stack
- **Framework**: React + Next.js (App Router)
- **Auth**: NextAuth v5 (session-based, `lib/auth.ts`)
- **DB**: PostgreSQL via Prisma ORM
- **Storage**: Supabase storage buckets (image uploads → bucket "uploads", public URLs)
- **Deploy**: Vercel

## Key Conventions
- **Routes**: All route constants in `lib/const/routes.ts` — never hardcode paths
- **Server utils**: DB queries live in `lib/utils/server/` (e.g. `user.ts`, `page.ts`, `event.ts`)
- **Field selectors**: Reusable Prisma `select` objects in `lib/utils/server/fields.ts`
- **Shared text utils**: Initials, truncation, display names → `lib/utils/text.ts`
- **Validations**: All input validation in `lib/validations.ts` (events, posts, pages, messages)
- **Types**: `lib/types/` — schema-derived interfaces (PostItem, EventItem, CardUser, etc.)
- **Re-exports**: Avoid re-exports. Either move the function or just import from where it already exists.

## UI Component Map
```
Explore page:  CollectionPage → FilteredCollection → CollectionCard
Profile pages: ProfileCollectionSection (wraps CollectionPage for user/page profiles)
Avatars:       EntityAvatar (handles User or Page, image or initials fallback)
Image display: ImageCarousel (multi-image carousel on cards)
Posts on cards: PostsList (fetches child posts/updates for a parent post or event)
Layout:        CenteredLayout, FormLayout
Forms:         FormField, FormInput, FormTextarea, FormActions, FormError
```

# App Diagram (reflects current Prisma schema)
Project Library – Conceptual Schema Tree
=======================================

User (identity + auth)
├─ profile fields (firstName, lastName, headline, bio, interests, location)
├─ avatarImage → Image
├─ posts → Post[]
├─ events → Event[]
├─ images → Image[]              (uploaded file metadata)
├─ createdPages → Page[]
├─ permissions → Permission[]
├─ following → Follow[]
├─ followers → Follow[]
├─ sentMessages → Message[]
└─ conversationMemberships → ConversationParticipant[]

Page (shared resource — replaces Org + Project)
├─ createdByUser → User
├─ identity (name, slug, headline, bio, interests, location)
├─ address (addressLine1, addressLine2, city, state, zip)
├─ avatarImage → Image
├─ posts → Post[]                (content posted "as" this page)
├─ events → Event[]
├─ topics → Topic[]
├─ followers → Follow[]
└─ conversations → ConversationParticipant[]

------------------------------------------------

Posts
-----
Post
├─ user → User                   (author, always set)
├─ page → Page?                  (posted "as" a page; requires ADMIN/EDITOR permission)
├─ event → Event?                (attached to an event)
├─ parentPost → Post?            (update to another post, one level deep)
├─ updates → Post[]              (child update posts)
└─ tags, topics

• Posts can be standalone, on a Page, on an Event, or an update to another Post
• parentPostId and eventId are mutually exclusive
• Updates cannot have children (no nesting)

------------------------------------------------

Events
------
Event
├─ user → User                   (creator, always set)
├─ page → Page?                  (hosted by a page; requires ADMIN/EDITOR permission)
├─ posts → Post[]                (event updates / announcements)
└─ tags, topics

------------------------------------------------

Authorization (Permission-based)
---------------------------------
Permission
├─ user → User
├─ resourceId + resourceType (PAGE or EVENT)
└─ role (ADMIN | EDITOR | MEMBER)

• Creating a Page auto-creates Permission(userId, pageId, PAGE, ADMIN)
• "Can user X post as page Y?" → role in [ADMIN, EDITOR]
• "Can user X manage page Y?" → role = ADMIN
• Post permissions are implicit: author always manages their own post

------------------------------------------------

Social Graph (Follows)
-----------------------
Follow
├─ follower → User
├─ followingUser → User?         (exactly one of these is set)
└─ followingPage → Page?

• Users can follow other Users or Pages

------------------------------------------------

Images & Attachments
--------------------
User
└─ Image              (uploadedBy)

User ── avatarImage ── Image
Page ── avatarImage ── Image

Image
└─ ImageAttachment
   ├─ targetType: PAGE | EVENT | POST | IMAGE | MESSAGE
   └─ targetId

• Image = stored file metadata (url, path, altText)
• ImageAttachment = polymorphic join (where the image appears)
• Avatars are explicit FK fields for simplicity

------------------------------------------------

Messaging
---------
Conversation
├─ participants → ConversationParticipant[]
│  ├─ user → User?               (exactly one of these is set)
│  └─ page → Page?               (Page participant: ADMIN/EDITOR users can access)
└─ messages → Message[]
   ├─ sender → User              (accountability)
   └─ asPageId?                  (sending on behalf of a Page)

------------------------------------------------

Topics (lightweight taxonomy)
-----------------------------
Topic
├─ label, parentId, synonyms
└─ pages → Page[]               (implicit many-to-many)
