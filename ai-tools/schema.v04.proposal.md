generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// ========================
// Enums
// ========================

enum OwnerType {
  USER
  PAGE
}

enum OwnerStatus {
  ACTIVE
  DEACTIVATED
}

enum PageRole {
  OWNER
  ADMIN
  MEMBER
}

enum PageVisibility {
  PUBLIC
  UNLISTED
  PRIVATE
}

// Optional: a light “label” for UI/onboarding, not a hard structural distinction.
enum PageKind {
  PROJECT
  STUDY_GROUP
  SMALL_BUSINESS
  PERSONAL
  OTHER
}

// Used for ImageAttachment target typing.
enum ArtifactType {
  PAGE
  EVENT
  POST
  IMAGE
  MESSAGE
  CONVERSATION
}

enum ConversationType {
  DM
  PAGE_THREAD
  JOIN_REQUEST
}

enum JoinRequestStatus {
  PENDING
  ACCEPTED
  CLOSED
  REJECTED
}

// ========================
// Users (base type)
// ========================

model User {
  id        String   @id @default(cuid())
  ownerId   String   @unique // References Owner.id (personal Owner)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  email        String @unique
  passwordHash String
  username     String @unique

  firstName   String?
  middleName  String?
  lastName    String?
  displayName String?

  // Profile
  headline      String?
  bio           String?
  interests     String[] @default([])
  location      String?
  isPublic      Boolean  @default(true)
  avatarImageId String?
  avatarImage   Image?   @relation("UserAvatar", fields: [avatarImageId], references: [id], onDelete: SetNull)

  // Relationships
  userOwner    Owner   @relation("UserOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  owners       Owner[] // includes PAGE “hats”
  createdPages Page[]  @relation("PageCreatedBy")

  @@map("users")
}

// ========================
// Owners
// ========================
//
// User-first attribution:
// - Every Owner always points back to a responsible `userId`.
// - Personal Owner: `pageId` is null and `type` is USER.
// - Page Owner ("wearing a page hat"): `pageId` is set and `type` is PAGE.
//
// Postgres note:
// - `@@unique([userId, pageId])` does NOT prevent multiple (userId, NULL) rows.
//   If you need "exactly one personal owner per user", add a partial unique index in SQL:
//     CREATE UNIQUE INDEX owners_one_personal_per_user ON owners("userId") WHERE "pageId" IS NULL;

model Owner {
  id        String      @id @default(cuid())
  userId    String
  pageId    String?
  type      OwnerType
  status    OwnerStatus @default(ACTIVE)
  createdAt DateTime    @default(now())

  // Relations
  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  page Page? @relation("PageOwners", fields: [pageId], references: [id], onDelete: Cascade)

  // Backref from User.userOwner (personal owner)
  userOwner User? @relation("UserOwner")

  // Primary owner for page(s)
  primaryPages Page[] @relation("PagePrimaryOwner")

  // Social graph
  following Follow[] @relation("OwnerFollowing")
  followers Follow[] @relation("OwnerFollowers")

  // Content attribution
  events Event[]
  posts  Post[]
  images Image[]

  // Messaging
  sentMessages     Message[] @relation("SentMessages")
  receivedMessages Message[] @relation("ReceivedMessages")

  // Membership tie (for page-based owners)
  pageMembership PageMember?

  @@unique([userId, pageId])
  @@index([userId])
  @@index([pageId])
  @@map("owners")
}

// ========================
// Pages (unifies "Project" + "Org")
// ========================
//
// A Page is a first-class microsite-like surface:
// - aggregates posts
// - can host events
// - can have members with roles
// - can be followed/discovered (via Topics + general feeds)
// - can be open to collaboration (join requests + conversation thread)

model Page {
  id              String   @id @default(cuid())
  createdByUserId String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Identity
  name String
  slug String @unique

  headline   String?
  bio        String?
  interests  String[] @default([])
  location   String?
  isPublic   Boolean  @default(true) // keep for compatibility; you can later derive from visibility
  visibility PageVisibility @default(PUBLIC)
  kind       PageKind @default(OTHER)

  // Optional address fields (useful for small biz; harmless for other Page kinds)
  addressLine1 String?
  addressLine2 String?
  city         String?
  state        String?
  zip          String?

  // Discoverability
  // Keep your lightweight MVP fields; Topics relation is the “real” categorization.
  parentTopic String?
  tags        String[] @default([])
  topics      Topic[]

  // Visual
  avatarImageId String?
  avatarImage   Image?  @relation("PageAvatar", fields: [avatarImageId], references: [id], onDelete: SetNull)

  // Collaboration
  isOpenToCollaborators Boolean @default(false)

  // Relationships
  createdByUser User  @relation("PageCreatedBy", fields: [createdByUserId], references: [id], onDelete: Cascade)

  ownerId OwnerId // NOTE: Prisma doesn't support type alias; keep as String below.
  // (Left here as a comment reminder: ownerId is String)
  ownerId   String
  owner     Owner   @relation("PagePrimaryOwner", fields: [ownerId], references: [id], onDelete: Cascade)

  owners  Owner[]      @relation("PageOwners")
  members PageMember[]
  posts   Post[]
  events  Event[]

  // Collaboration requests + associated conversation threads
  joinRequests PageJoinRequest[]
  conversations Conversation[] // PAGE_THREAD / JOIN_REQUEST

  @@index([ownerId])
  @@index([createdAt])
  @@map("pages")
}

// Membership & role live on the join.
// `ownerId` connects membership to the user's page-based Owner identity ("hat").
model PageMember {
  id        String   @id @default(cuid())
  pageId    String
  ownerId   String   @unique
  role      PageRole @default(MEMBER)
  createdAt DateTime @default(now())

  page  Page  @relation(fields: [pageId], references: [id], onDelete: Cascade)
  owner Owner @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([pageId, role])
  @@map("page_members")
}

// ========================
// Social graph (Owner follows Owner)
// ========================

model Follow {
  id               String   @id @default(cuid())
  followerOwnerId  String
  followingOwnerId String
  createdAt        DateTime @default(now())

  follower  Owner @relation("OwnerFollowing", fields: [followerOwnerId], references: [id], onDelete: Cascade)
  following Owner @relation("OwnerFollowers", fields: [followingOwnerId], references: [id], onDelete: Cascade)

  @@unique([followerOwnerId, followingOwnerId])
  @@index([followerOwnerId])
  @@index([followingOwnerId])
  @@map("follows")
}

// ========================
// Events
// ========================
//
// Events can be:
// - hosted by a Page (pageId set)
// - standalone (pageId null)
// Attribution stays on Owner (creator).

model Event {
  id        String   @id @default(cuid())
  ownerId   String
  pageId    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  title       String
  description String
  eventDateTime DateTime
  location    String
  latitude    Float?
  longitude   Float?

  owner Owner @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  page  Page? @relation(fields: [pageId], references: [id], onDelete: Cascade)

  posts Post[]

  tags   String[] @default([])
  topics String[] @default([])

  @@index([ownerId, createdAt])
  @@index([pageId, createdAt])
  @@map("events")
}

// ========================
// Posts
// ========================
//
// Posts can be:
// - standalone (pageId null, eventId null)
// - on a Page (pageId set)
// - attached to an Event (eventId set)
// - both Page + Event (typical: event hosted by a Page and you post about it)
//
// If you want to enforce "at least one of pageId/eventId OR allow standalone",
// do it with a DB CHECK constraint in a migration (Prisma can't express it).

model Post {
  id      String @id @default(cuid())
  ownerId String
  pageId  String?
  eventId String?

  title   String?
  content String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner Owner @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  page  Page? @relation(fields: [pageId], references: [id], onDelete: Cascade)
  event Event? @relation(fields: [eventId], references: [id], onDelete: Cascade)

  tags   String[] @default([])
  topics String[] @default([])

  @@index([ownerId, createdAt])
  @@index([pageId, createdAt])
  @@index([eventId, createdAt])
  @@map("posts")
}

// ========================
// Collaboration requests
// ========================
//
// This is the “status toggle” you described.
// It also anchors an associated Conversation (JOIN_REQUEST) so the
// prefilling message + ongoing chat have one thread.

model PageJoinRequest {
  id        String            @id @default(cuid())
  pageId    String
  requesterOwnerId String
  status    JoinRequestStatus @default(PENDING)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  closedAt  DateTime?

  // Optional: store a suggested/prefilled initial message snapshot
  initialMessage String?

  page      Page  @relation(fields: [pageId], references: [id], onDelete: Cascade)
  requester Owner @relation(fields: [requesterOwnerId], references: [id], onDelete: Cascade)

  // One conversation thread per join request (enforced via unique)
  conversation Conversation?

  @@unique([pageId, requesterOwnerId])
  @@index([pageId, status, createdAt])
  @@index([requesterOwnerId, createdAt])
  @@map("page_join_requests")
}

// ========================
// Conversations + Messages
// ========================
//
// Adds lightweight threading without losing your existing Owner->Owner semantics.
// - DM: between two Owners (participants table enforces membership)
// - PAGE_THREAD: “shared forum” style thread scoped to a Page
// - JOIN_REQUEST: thread scoped to a PageJoinRequest (and thus a Page)

model Conversation {
  id        String           @id @default(cuid())
  type      ConversationType
  pageId    String?
  joinRequestId String? @unique
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  page        Page?            @relation(fields: [pageId], references: [id], onDelete: Cascade)
  joinRequest PageJoinRequest? @relation(fields: [joinRequestId], references: [id], onDelete: Cascade)

  participants ConversationParticipant[]
  messages      Message[]

  @@index([type, createdAt])
  @@index([pageId, createdAt])
  @@map("conversations")
}

model ConversationParticipant {
  id             String   @id @default(cuid())
  conversationId String
  ownerId        String
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  owner        Owner        @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([conversationId, ownerId])
  @@index([ownerId])
  @@map("conversation_participants")
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  content        String

  senderId   String
  receiverId String? // for DMs; null for PAGE_THREAD style threads
  createdAt  DateTime @default(now())
  readAt     DateTime?

  // Optional denormalization for inbox queries
  senderPageId   String?
  receiverPageId String?

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       Owner @relation("SentMessages", fields: [senderId], references: [id], onDelete: Cascade)
  receiver     Owner? @relation("ReceivedMessages", fields: [receiverId], references: [id], onDelete: SetNull)

  @@index([conversationId, createdAt])
  @@index([senderId])
  @@index([receiverId])
  @@index([senderPageId])
  @@index([receiverPageId])
  @@map("messages")
}

// ========================
// Images + Attachments
// ========================

model Image {
  id           String   @id @default(cuid())
  url          String
  path         String
  altText      String?
  uploadedById String
  createdAt    DateTime @default(now())

  uploadedBy Owner @relation(fields: [uploadedById], references: [id], onDelete: Cascade)

  // Used for Page/Event/Post galleries (and any other attachable targets you add later)
  attachments ImageAttachment[]

  // Backrefs for avatars
  userAvatarFor User[] @relation("UserAvatar")
  pageAvatarFor Page[] @relation("PageAvatar")

  @@index([uploadedById])
  @@map("images")
}

model ImageAttachment {
  id        String      @id @default(cuid())
  imageId   String
  type      ArtifactType
  targetId  String
  sortOrder Int         @default(0)
  createdAt DateTime    @default(now())

  image Image @relation(fields: [imageId], references: [id], onDelete: Cascade)

  @@index([type, targetId])
  @@index([imageId])
  @@map("image_attachments")
}

// ========================
// Topics (lightweight taxonomy table)
// ========================
//
// Page <-> Topic is an implicit many-to-many join table.

model Topic {
  id        String   @id
  label     String
  parentId  String?
  synonyms  String[] @default([])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  pages Page[]

  @@map("topics")
}
