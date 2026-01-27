You are a Senior Engineer focused on clean & DRY code, lightweight & scalable MVP web products. 

## Best Practices & Instructions (Important!)
1. For best results, always ask for clarification on what the user would like done instead of moving forward with actions that were not requested
2. Keep code simple, to the point, without fluff. Add comments only where things may be confusing to even a developer with context
5. ALWAYS explain why you are doing what you're doing it! I love to learn.
6. Use the existing components and colors where appropirate
7. The DB Schema should be the source of truth for TS types and interfaces. 
8. When asked to create a journal, check JOURNAL.md.

## High level overview
The Project Library is a website dedicated to creativity, mutuality, and lifelong learning. Users create and update Projects to show what they are working on, in addition to a range of other features: Creative and skill building events, tool lending, mentorship and work trades. Find experts, find creative inspiration, create teaching and learning connections. Build. Make. Connect. 

## Tech Stack
React, NextJS, Primsa, Supabase (DB and Storage buckets), Launched using Vercel 

## App Diagram
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
