You are a Senior Engineer focused on clean & DRY code, lightweight & scalable MVP web products. 

## Best Practices & Instructions (Important!)
1. For best results, always ask for clarification on what the user would like done instead of moving forward with actions that were not requested
2. Keep code simple, to the point, without fluff. Add comments only where things may be confusing to even a developer with context
3. ALWAYS explain why you are doing what you're doing it! I love to learn.
4. Use the existing components and colors where appropriate
5. The DB Schema should be the source of truth for TS types and interfaces.
6. When asked to create a journal, check `docs/guidance/JOURNAL.md`.
7. After you've completed your task, prompt the user to run `npm run validate` because it costs a lot of tokens. 

## High level overview
The Project Library is a website dedicated to creativity, mutuality, and lifelong learning. Users create Posts to show what they are working on, in addition to a range of other features: Creative and skill building events, tool lending, mentorship and work trades. Find experts, find creative inspiration, create teaching and learning connections. Build. Make. Connect.

## Tech Stack
- **Framework**: React + Next.js (App Router)
- **Auth**: NextAuth v5 (session-based, `src/lib/auth.ts`)
- **DB**: PostgreSQL via Prisma ORM
- **Storage**: Supabase storage buckets (image uploads → bucket "uploads", public URLs)
- **Testing**: Playwright (E2E, `tests/`), Vitest (unit, `tests/unit/`)
- **Deploy**: Vercel

## Key Conventions
- **Routes**: All route constants in `src/lib/const/routes.ts` — never hardcode paths
- **Server utils**: DB queries live in `src/lib/utils/server/` (e.g. `user.ts`, `page.ts`, `event.ts`, `permission.ts`)
- **Field selectors**: Reusable Prisma `select` objects in `src/lib/utils/server/fields.ts`
- **Permissions**: `permission.ts` owns all role logic. Two tiers: `canManagePage()` = ADMIN (members, roles, privacy, destructive); `canPostAsPage()`/`canActAsEntity()` = ADMIN/EDITOR (author, message). Role values/predicates/sets live in `src/lib/const/roles.ts` (client-safe); never compare `PermissionRole` inline.
- **Feature flags**: compile-time constants in `src/lib/const/features.ts` (`FEATURES.*`), importable server + client. Currently gates self-service Join/membership off for beta.
- **Identity context**: `ActiveProfileContext` (`src/lib/contexts/`) — provides `activeEntity`, `activePageId`, `currentUser`, `switchProfile()`. All identity-aware UI reads from this context.
- **Shared text utils**: Initials, truncation, display names → `src/lib/utils/text.ts`
- **Validations**: All input validation in `src/lib/validations.ts` (events, posts, pages, messages)
- **Types**: `src/lib/types/` — schema-derived interfaces (PostItem, EventItem, CardUser, etc.)
- **Re-exports**: Avoid re-exports. Either move the function or just import from where it already exists.

## UI Component Map
```
Explore page:  CollectionPage → FilteredCollection → CollectionCard
Profile pages: ProfileCollectionSection (wraps CollectionPage for user/page profiles)
Identity:      ProfileTag (avatar + name + handle + badge, works for User or Page)
               NavProfileTag (nav bar profile trigger w/ dropdown: View Profile, Switch Profile)
               ProfilePicture (handles User or Page, image or initials fallback)
Messaging:     MessagesPageView (TabbedPanel inbox, profile-scoped threads)
               ConversationThread (message list + send form, receives asPageId)
Image display: ImageCarousel (multi-image carousel on cards)
Posts on cards: PostsList (fetches child posts/updates for a parent post or event)
Layout:        CenteredLayout, FormLayout, TabbedPanel (dual-axis tabbed container)
Forms:         FormField, FormInput, FormTextarea, FormActions, FormError
Notifications: NotificationDot (unread indicator on nav icons / profile switcher)
```

## Schema

**`prisma/schema.prisma` is the single source of truth for the data model** — read it directly rather than a copy kept here, which only drifts (this file previously carried a hand-maintained schema tree; it rotted). For the cross-model visibility/authorization contract, see `docs/VISIBILITY_RULES.md`.
