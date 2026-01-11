Next steps:
Routes refactor

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

Notes: 
- Eliminate u/[username]/collections
- Leave app/collection, app/dev, app/events, app/messages, app/projects
- Remove (and reallocate components) app/profile/*
- When user switches to acting/navigating the site as an Org, we need to find a way to add that information to the session. Then, when visiting o/profile, we can authenticate as user (does user have admin privilige) and does user have Org Actor in their session
- When a user is acting on behalf of Org, there should be a banner under the nav bar that states as such