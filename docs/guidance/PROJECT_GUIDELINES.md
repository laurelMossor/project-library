You are a Senior Engineer focused on clean & DRY code, lightweight & scalable MVP web products. 

## Best Practices & Instructions (Important!)
1. For best results, always ask for clarification on what the user would like done instead of moving forward with actions that were not requested
2. Prioritize DRY and SOLID principles. Before writing new logic, check whether it already exists (server utils in `src/lib/utils/server/`, shared components, helpers) and extend that instead of duplicating. Favor single-responsibility modules and clear separation of concerns over short-term convenience — if a change makes you copy-paste or bolt an unrelated responsibility onto an existing unit, stop and factor it properly.
3. Keep code simple, to the point, without fluff. Add comments only where things may be confusing to even a developer with context
4. ALWAYS explain why you are doing what you're doing it! I love to learn.
5. Use the existing components and colors where appropriate
6. The DB Schema should be the source of truth for TS types and interfaces.
7. When asked to create a journal, check `docs/guidance/JOURNAL.md`.
8. After you've completed your task, prompt the user to run `npm run validate` because it costs a lot of tokens. 

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
- **Permissions**: `permission.ts` owns all role logic. `canManagePage()` = ADMIN (members, roles, privacy, membership settings, destructive). `canPostAsPage()`/`canActAsEntity()` = ADMIN/EDITOR (speak as the page, message, pin on the page). `canPostToPage()` = ADMIN/EDITOR always; a MEMBER only when the page's `allowMemberPosts` is on. `canEditContent()` = a current ADMIN/EDITOR when the content is spoken as a page (`asPageId` set); otherwise the author (personal posts and posts to a page). `canModerateContent()` = editors, plus a manager of the page the content *lives on* (delete a member post, never rewrite it). Role values/predicates/sets live in `src/lib/const/roles.ts` (client-safe); `assignableRoles(policy)` decides which roles a page may offer. Never compare `PermissionRole` inline.
- **Feature flags**: compile-time constants in `src/lib/const/features.ts` (`FEATURES.*`), importable server + client. Membership is not a flag: a page's `membershipPolicy` (CLOSED by default, INVITE_ONLY, REQUEST_TO_JOIN; OPEN exists and is rejected until it ships) decides who can join.
- **Identity context**: `ActiveProfileContext` (`src/lib/contexts/`) — provides `activeEntity`, `activePageId`, `currentUser`, `switchProfile()`. All identity-aware UI reads from this context.
- **Shared text utils**: Initials, truncation, display names → `src/lib/utils/text.ts`
- **Validations**: All input validation in `src/lib/validations.ts` (events, posts, pages, messages)
- **Types**: `src/lib/types/` — schema-derived interfaces (PostItem, EventItem, CardUser, etc.)
- **Re-exports**: Avoid re-exports. Either move the function or just import from where it already exists.

## Data & saves (keep the screen in step with the server)
The server is the source of truth for what's on screen. There is no client-side data store.
- **Saves are Server Actions.** Put them in `src/lib/actions/<domain>.ts` (a `"use server"` file), exported as `authedAction(...)` or `publicAction(...)` from `src/lib/utils/server/action.ts`. The wrapper owns session → rate limit → handler → error mapping → `refresh()`, so an action body is only "check input → call the server util". The logic lives in `src/lib/utils/server/`, never in the action. Reference: `src/lib/actions/follow.ts`.
- **Refusals are `DomainError`s.** A util or action throws `DomainError(message, code)` (`src/lib/utils/server/domain-error.ts`) for anything the caller can fix. The message is shown to the user. Any other throw becomes a generic `server` error. Every action returns `ActionResult` (`src/lib/types/action.ts`).
- **Components call actions through `useAction`** (`src/lib/hooks/useAction.ts`). It gives `pending`/`error` and the login redirect, so don't hand-roll `saving` flags or 401 handling. A control whose save isn't one fixed action (row buttons that each bind a different action, or a button that runs several in order) uses `useActionThunk()` from the same file.
- **Client-polled views skip the refresh.** Messaging and the notification bell read through polled GETs, so their actions pass `{ refresh: false }` and the caller refetches. The same goes for a create or delete whose caller navigates away.
- **Render server data from props.** Don't copy a server prop into `useState` to display it, because a refresh then can't update it. Local state is only for unsaved drafts (the inline-edit session) and optimistic UI (`useOptimistic`).
- **Reads belong on the server page** when the page is a server component. `refresh()` re-renders server data only. A component that fetches its own data in `useEffect` won't see the change.
- **HTTP routes are for outside callers only:** NextAuth, the Telegram webhook, the email-flush cron, multipart upload, and GETs still used by client-fetched views. Don't add a mutating `/api` route for our own UI. ESLint blocks client `fetch` saves in all UI code (`src/app` outside `api/`, plus `src/lib/{components,hooks,contexts}`; see `eslint.config.mjs`). The multipart upload in `src/lib/utils/image-client.ts` is the one sanctioned client POST.
- **Signed-out flows use `publicAction`** (signup, password reset, email verification, unsubscribe in `src/lib/actions/auth.ts`). Flows that take an email (forgot password, resend verification) must succeed the same way whether or not the account exists, and send mail in `after()` so timing doesn't leak it either.

## UI Component Map
```
Explore page:  CollectionPage → FilteredCollection → CollectionCard
Profile pages: ProfileCollectionSection (wraps CollectionPage for user/page profiles)
Identity:      ProfileTag (avatar + name + handle + badge, works for User or Page)
               NavProfileTag (nav bar profile trigger w/ dropdown: View Profile, Switch Profile)
               ProfilePicture (handles User or Page, image or initials fallback)
Messaging:     MessagesPageView (TabbedPanel inbox of DMs + groups, scoped to the active identity)
               ConversationThread (thread by conversationId + send form, receives asPageId)
               StandaloneThreadPage (deep-link thread pages /messages/c/:id and /messages/u|p/:id)
               NewGroupModal / MembersModal (on ModalShell) + MemberPicker, AvatarStack
               Server: utils/server/message.ts owns access, read state, groups; message-routes.ts is the read-route
               prelude; message-commands.ts guards the writes behind actions/message.ts
Image display: ImageCarousel (multi-image carousel on cards)
Posts on cards: PostsList (fetches child posts/updates for a parent post or event)
Layout:        CenteredLayout, FormLayout, TabbedPanel (dual-axis tabbed container)
Forms:         FormField, FormInput, FormTextarea, FormActions, FormError
Notifications: NotificationDot (unread indicator on nav icons / profile switcher)
```

## Schema

**`prisma/schema.prisma` is the single source of truth for the data model** — read it directly rather than a copy kept here, which only drifts (this file previously carried a hand-maintained schema tree; it rotted). For the cross-model visibility/authorization contract, see `docs/VISIBILITY_RULES.md`.
