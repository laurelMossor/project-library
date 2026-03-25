In the midst of the refactor from orgs to Pages, and the differences in handling authorship, a feature has become regressed and needs attention. As a user, you can go to your settings and see the Pages your an admin of, but when you click "switch to", it's broken. This 'canPostAsPage' and related utilities are meant to check auth status and update the cookie state with your current profile. All that is going away. Now, when posting an event or post, the authorship will be a dropdown of options of which you have EDITOR permission. This task also includes unwiring the links from the profile page of the profile you are logged in as, there would be a "switch to.." button within an Options button, and take that away but leave an empty button. 

A knock on effect is  messaging to Pages is broken. As it stands, there would always be a check of what profile/owner you're logged in as. Now, when going to messages a user should be able to see all the message sources, organized by page. So a user who is admin of two pages would have one group for personal DMs, one group for the first Page, and a third group of messages beloning to the other Page. Within those respective thread, the sender is implicitly the target profile.

## "As Page" — Current State

The data model, API, and permission system are all built, but they're disconnected from each other and from the UI.

**What the schema supports:**
- `Event.pageId` — an event can be hosted by a page
- `Post.pageId` — a post can be authored as a page
- `Message.asPageId` — a message can be sent on behalf of a page
- `ConversationParticipant.pageId` — a page can be a conversation participant
- `Permission` table with `ADMIN | EDITOR | MEMBER` roles per page

**What the API does:**
- `POST /api/messages` accepts and stores `asPageId` — but the permission check calls `canPostAsPage(userId, asPageId)`, which checks the `Permission` table for ADMIN or EDITOR role
- `POST /api/posts` appears to accept `pageId` (needs verification)
- `POST /api/events` (draft path) and `PATCH /api/events/:id` do **not** accept `pageId` at all

**What `canPostAsPage` does:**
Queries `Permission` where `userId`, `resourceId = pageId`, `resourceType = PAGE`, and `role IN [ADMIN, EDITOR]`. When you create a page, the app is supposed to auto-create a `Permission` record making you ADMIN — but it's unclear if that creation is actually wired up.

**What the UI does:**
Nothing. No page selector exists anywhere in the event, post, or messaging creation flows.

**Net result:** The "as Page" feature is a partially built backend with no frontend surface, and likely no path to test whether the permission wiring even works end-to-end.
