# API Proposal (v0.3) — Owner-based Attribution, User-first Responsibility

## Overview

This document proposes an API design aligned with the v0.3 schema where:
- **User is the base identity** (authentication, account profile)
- **Owner is the attribution identity** (personal owner + org-based owners/"hats")
- **All artifacts live on `Owner`** (projects, events, posts, images, messages)
- **Follows and messaging are `Owner` ↔ `Owner`**
- **Org membership/roles live on `OrgMember`** and connect an org to an org-based `Owner`

---

## Core Concepts & Invariants

### User
- Authenticated principal
- Has exactly one **personal owner** referenced by `user.ownerId` (aka `userOwner`)
- May have multiple `owners[]` (one personal + one per org they can act for)

### Owner
- Always has a `userId` (responsible user)
- Optional `orgId` when acting on behalf of an org
- Owns: `projects`, `events`, `posts`, `images`, `messages` (sent/received)
- Social graph: `follows` is stored as `Follow(followerOwnerId, followingOwnerId)`

### Org
- Has a **primary owner** (`org.ownerId`) for admin/superadmin semantics
- Has `owners[]` where `Owner.orgId = org.id`
- Membership & roles in `OrgMember(orgId, ownerId, role)`

### OrgMember (role on join)
- Links `Org` ↔ **org-based Owner** ("hat")
- Role: `OWNER | ADMIN | MEMBER` (and any future roles)

### Attachment Model
- `Image` is uploaded by an `Owner`
- `ImageAttachment` links image to a target: `(type, targetId)`

---

## Auth & "Which Hat Am I Wearing?"

### Session Shape
- Store `activeOwnerId` in session (or client state + signed cookie)
- Derive "acting as org" from the selected owner: `owner.orgId != null`

### Rules
- A user may set `activeOwnerId` only to an `Owner` where `owner.userId == session.userId`
- If `activeOwnerId.orgId != null`, user must have a valid `OrgMember` for that `(orgId, ownerId)` and role ∈ allowed roles

---

## API Design Principles

- **Every write** uses the **active owner** as the attribution source
- **Every read** can filter by owner(s), org, or user depending on use case
- Consistent envelope and errors

### Response Envelope (Recommended)
```json
{ "data": { ... }, "error": null }
```

### Error Shape
```json
{ "data": null, "error": { "code": "FORBIDDEN", "message": "...", "details": {} } }
```

---

## Endpoints

## Auth / Session

### `POST /api/session/active-owner`
Set the active owner for the current session.

**Body**
```json
{ "activeOwnerId": "owner_123" }
```

**Response**
```json
{ "data": { "activeOwnerId": "owner_123" }, "error": null }
```

### `GET /api/me`
Returns user + owners summary (for "switch hat" UI).

**Response**
```json
{
  "data": {
    "user": { "id": "user_1", "username": "laurel", "ownerId": "owner_personal" },
    "owners": [
      { "id": "owner_personal", "type": "USER", "orgId": null, "status": "ACTIVE" },
      { "id": "owner_org_1", "type": "ORG", "orgId": "org_1", "status": "ACTIVE" }
    ],
    "activeOwnerId": "owner_personal"
  },
  "error": null
}
```

---

## Owners

### `GET /api/owners/:ownerId`
Public-ish owner view (plus optional expansions).

Query: `?include=user,org`

**Response**
```json
{
  "data": {
    "owner": {
      "id": "owner_org_1",
      "type": "ORG",
      "userId": "user_1",
      "orgId": "org_1",
      "status": "ACTIVE",
      "user": { "id": "user_1", "username": "laurel" },
      "org": { "id": "org_1", "slug": "makers-guild", "name": "Makers Guild" }
    }
  },
  "error": null
}
```

---

## Orgs & Membership

### `POST /api/orgs`
Creates an org and sets:
- `org.createdByUserId = session.userId`
- `org.ownerId = activeOwnerId` (must be personal owner unless you want nested org creation rules)

**Body**
```json
{ "name": "Makers Guild", "slug": "makers-guild", "bio": "..." }
```

### `GET /api/orgs/:orgId`
Org profile.

### `GET /api/orgs/:orgId/members`
List `OrgMember` entries with owner + role.

### `POST /api/orgs/:orgId/members`
Create membership by creating an org-based owner for the user (if not already) then linking via `OrgMember`.

**Body**
```json
{ "userId": "user_2", "role": "MEMBER" }
```

### `PATCH /api/orgs/:orgId/members/:ownerId`
Update role.

**Body**
```json
{ "role": "ADMIN" }
```

---

## Follows (Owner ↔ Owner)

### `GET /api/owners/:ownerId/followers`
### `GET /api/owners/:ownerId/following`

### `POST /api/follows`
Follow as the active owner.

**Body**
```json
{ "followingOwnerId": "owner_999" }
```

### `DELETE /api/follows/:followingOwnerId`
Unfollow as the active owner.

---

## Projects (owned by Owner)

### `POST /api/projects`
Creates a project attributed to `activeOwnerId`.

**Body**
```json
{ "title": "Wooden Desk", "description": "..." }
```

### `GET /api/projects/:projectId`
Include owner summary.

### `GET /api/projects`
Query filters:
- `?ownerId=...`
- `?orgId=...` (implemented by joining `Project.owner.orgId`)
- `?userId=...` (implemented by joining `Project.owner.userId`)

---

## Events (owned by Owner)

### `POST /api/events`
**Body**
```json
{ "title": "Repair Night", "description": "...", "eventDateTime": "2026-02-01T02:00:00.000Z", "location": "..." }
```

### `GET /api/events/:eventId`
### `GET /api/events`

---

## Posts (owned by Owner; optionally attached to Project OR Event)

### `POST /api/posts`
**Body** (standalone)
```json
{ "content": "Hello world", "title": "Optional" }
```

**Body** (project update)
```json
{ "content": "Made progress", "projectId": "proj_1" }
```

**Body** (event update)
```json
{ "content": "Schedule update", "eventId": "event_1" }
```

Rule: **at most one** of `projectId`, `eventId`.

### `GET /api/posts/:postId`
### `GET /api/posts`
Filters:
- `?ownerId=...`
- `?projectId=...`
- `?eventId=...`

---

## Images & Attachments

### `POST /api/images`
Upload metadata attributed to `activeOwnerId` (actual file upload can be signed URL flow).

**Body**
```json
{ "url": "...", "path": "...", "altText": "..." }
```

### `POST /api/image-attachments`
Attach an image to an artifact.

**Body**
```json
{ "imageId": "img_1", "type": "PROJECT", "targetId": "proj_1", "sortOrder": 0 }
```

### `DELETE /api/image-attachments/:id`

---

## Messaging (Owner ↔ Owner)

### `POST /api/messages`
Send a message as `activeOwnerId`.

**Body**
```json
{ "receiverOwnerId": "owner_999", "content": "Hi!" }
```

### `GET /api/messages/inbox`
Messages where `receiverId = activeOwnerId`.

### `GET /api/messages/sent`
Messages where `senderId = activeOwnerId`.

### `PATCH /api/messages/:messageId/read`
Set `readAt`.

---

## Topics (lightweight)

### `GET /api/topics`
### `GET /api/orgs?topicId=...`
If you keep implicit m:n `Org.topics`, you can filter orgs by topic join.

---

## Authorization Summary (High Level)

- **Writes** require auth
- **Attribution** always uses `activeOwnerId` and must satisfy: `Owner.userId == session.userId`
- **Org-scoped actions** require `activeOwnerId.orgId == orgId` (or role checks as needed)
- **Reads** can be public if `isPublic` on the relevant entity is true (User/Org), and/or additional artifact-level visibility if you add it later

---
