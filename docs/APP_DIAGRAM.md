Project Library – Conceptual Schema Tree
=======================================

Actor
├─ User
│  ├─ avatarImage → Image
│  ├─ sentMessages → Message → received by User
│  └─ OrgMember → Org
│
├─ Org
│  ├─ avatarImage → Image
│  └─ OrgMember → User
│
├─ Project
│  └─ Post            (project updates)
│
├─ Event
│  └─ Post            (event updates / announcements)
│
└─ Post               (standalone feed post)

------------------------------------------------

Social Graph (Followers)
------------------------
Actor
├─ follows → Actor
└─ followed by ← Actor

• User → User
• User → Org
• Org  → User
• Org  → Org

------------------------------------------------

Org Membership & Roles
----------------------
Org
└─ OrgMember
   ├─ User
   └─ role (OWNER | ADMIN | MEMBER | FOLLOWER)

• Users can belong to many orgs
• Orgs can have many users
• Role lives on the join, not on User or Org

------------------------------------------------

Images & Attachments
--------------------
User
└─ Image              (uploadedBy)

User ── avatarImage ── Image
Org  ── avatarImage ── Image

Image
└─ ImageAttachment
   ├─ Project
   ├─ Event
   └─ Post

• Image = stored file metadata
• ImageAttachment = where the image appears
• Avatars are explicit fields for simplicity

------------------------------------------------

Content Ownership Rules
-----------------------
• Everything is owned by an Actor
• Project/Event/Post all belong to exactly one Actor
• Post may optionally belong to:
    – one Project OR
    – one Event
  (or neither → standalone)

------------------------------------------------

Messaging
---------
User
├─ sent Message → User
└─ received Message ← User

• Orgs do not send messages directly
• Members act on behalf of orgs
