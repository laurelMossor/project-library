Project Library
=======================================


App Layout - Routes
---------

u/
├─ Profile/
│  ├─ page.tsx        # Private user profile, links to settings
│  ├─ Settings/
│  │   └─page.tsx     # A collection of private actions a user can take for their profile and orgs
│  │                  # Navigate between user actor and org actor here
│  └─ Edit/
│      └─page.tsx     # Edit profile form (there are two duplicates of this form, choose one and reuse the components)
│
└─ [username]
   └─ page.tsx        # Public User profile

o/
├─ Profile/
│  ├─ page.tsx        # Private org profile, links to settings
│  ├─ Settings/
│  │   └─page.tsx     # A collection of private actions an Org can take for their profile
│  │                  # Navigate between user actor and org actor here
│  └─ Edit/
│      └─page.tsx     # Edit profile form (Reuse existing components)
│
└─ [slug]
   └─ page.tsx        # Public Org profile

------------------------------------------------

Conceptual Schema Tree
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

