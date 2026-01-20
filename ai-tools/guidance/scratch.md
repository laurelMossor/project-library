First pass at User + Org relation

User first behavior: All owners are tracked by userId, so that the user owner is always the ultimate person of responsibility
Artifacts represent the artifacts that a user or org (an owner) creates on the site, anything with attributions
Artifact is anything that a user or org may post to the site (even privately)
enum ArtifactType {
  PROJECT
  EVENT
  POST
  MESSAGE
}

Additionally, User table will hold "adminOf  Org[] (orgId)", which is a relational field which should match on the Org table orgAdmins User[]

Each User and User + Org combo has a unique Owner identity, with the User-first attribution pattern. So when a user has Admin role on an org, they are granted a new Owner id in addition to the user-owner or any other org user owners attached to that user, that all track back to the userId of the responsible party. 


Part of session management for a user is which "Hat" they are wearing at the time.
In the settings, users can switch between Owners on behalf of a Org or their User page. This is stored in the session as something like:
{ actingAsOrg: boolean 
ownerId: ownerId
orgId: PublicOrg.orgId
orgSlug; PublicOrg.orgSlug }

In order for actingAsOrg to be true, 
1. you have to have the target Org listed under adminOf on User table AND be present on admins on the Org table. 
2. the user has this owner in their owners field, and it's active. 
(I cant decide between 1 and 2, or both?)

When attempting to create any Artifact (message, project, etc), there is a use ownerType to manage the primary attribution

The relevant user is always attributed, and the Org info can be stored and used for attribution when it's an Org post (project/message/event etc)

A note on users:
How it works now
Each User has one personal Owner (where orgId is null)
Each User can have multiple org-based Owners (one per org they act on behalf of)
The @@unique([userId, orgId]) constraint ensures uniqueness
All relations are properly defined with foreign keys
This aligns with the note: "Each User and User + Org combo has a unique Owner identity."
The backrefs are useful for querying:
user.owners - all Owners for a user
user.personalOwner - just the personal Owner
org.owners - all Owners for an org (users acting on behalf of it)