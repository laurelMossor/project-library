-- v0.4 Schema Migration
-- Eliminates: Owner, Org, Project, OrgMember
-- Introduces: Page, Permission, Conversation, ConversationParticipant
-- Transforms: Follow, Post/Event, Image, Message

-- ============================================================================
-- 1. Create new enums
-- ============================================================================

CREATE TYPE "PageVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
CREATE TYPE "PermissionRole" AS ENUM ('ADMIN', 'EDITOR', 'MEMBER');
CREATE TYPE "ResourceType" AS ENUM ('PAGE', 'EVENT');
CREATE TYPE "AttachmentTarget" AS ENUM ('PAGE', 'EVENT', 'POST', 'IMAGE', 'MESSAGE');

-- ============================================================================
-- 2. Create new tables
-- ============================================================================

CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "visibility" "PageVisibility" NOT NULL DEFAULT 'PUBLIC',
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "parentTopic" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avatarImageId" TEXT,
    "isOpenToCollaborators" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");
CREATE INDEX "pages_createdByUserId_idx" ON "pages"("createdByUserId");
CREATE INDEX "pages_createdAt_idx" ON "pages"("createdAt");

CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "role" "PermissionRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_userId_resourceId_resourceType_key" ON "permissions"("userId", "resourceId", "resourceType");
CREATE INDEX "permissions_resourceId_resourceType_idx" ON "permissions"("resourceId", "resourceType");
CREATE INDEX "permissions_userId_idx" ON "permissions"("userId");

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "pageId" TEXT,
    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");
CREATE UNIQUE INDEX "conversation_participants_conversationId_pageId_key" ON "conversation_participants"("conversationId", "pageId");
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");
CREATE INDEX "conversation_participants_pageId_idx" ON "conversation_participants"("pageId");

-- ============================================================================
-- 3. Drop ALL old foreign key constraints (must happen before column drops)
-- ============================================================================

-- Users
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_ownerId_fkey";

-- Owners
ALTER TABLE "owners" DROP CONSTRAINT IF EXISTS "owners_userId_fkey";
ALTER TABLE "owners" DROP CONSTRAINT IF EXISTS "owners_orgId_fkey";

-- Orgs
ALTER TABLE "orgs" DROP CONSTRAINT IF EXISTS "orgs_avatarImageId_fkey";
ALTER TABLE "orgs" DROP CONSTRAINT IF EXISTS "orgs_createdByUserId_fkey";
ALTER TABLE "orgs" DROP CONSTRAINT IF EXISTS "orgs_ownerId_fkey";

-- OrgMembers
ALTER TABLE "org_members" DROP CONSTRAINT IF EXISTS "org_members_orgId_fkey";
ALTER TABLE "org_members" DROP CONSTRAINT IF EXISTS "org_members_ownerId_fkey";

-- Follows
ALTER TABLE "follows" DROP CONSTRAINT IF EXISTS "follows_followerOwnerId_fkey";
ALTER TABLE "follows" DROP CONSTRAINT IF EXISTS "follows_followingOwnerId_fkey";

-- Projects
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_ownerId_fkey";

-- Events
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_ownerId_fkey";

-- Posts
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_ownerId_fkey";
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_projectId_fkey";

-- Messages
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_senderId_fkey";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_receiverId_fkey";

-- Images
ALTER TABLE "images" DROP CONSTRAINT IF EXISTS "images_uploadedById_fkey";

-- OrgToTopic join table
ALTER TABLE "_OrgToTopic" DROP CONSTRAINT IF EXISTS "_OrgToTopic_A_fkey";
ALTER TABLE "_OrgToTopic" DROP CONSTRAINT IF EXISTS "_OrgToTopic_B_fkey";

-- ============================================================================
-- 4. Drop old indexes
-- ============================================================================

DROP INDEX IF EXISTS "users_ownerId_key";
DROP INDEX IF EXISTS "owners_userId_idx";
DROP INDEX IF EXISTS "owners_orgId_idx";
DROP INDEX IF EXISTS "owners_userId_orgId_key";
DROP INDEX IF EXISTS "orgs_slug_key";
DROP INDEX IF EXISTS "orgs_ownerId_idx";
DROP INDEX IF EXISTS "org_members_ownerId_key";
DROP INDEX IF EXISTS "org_members_orgId_role_idx";
DROP INDEX IF EXISTS "follows_followerOwnerId_idx";
DROP INDEX IF EXISTS "follows_followingOwnerId_idx";
DROP INDEX IF EXISTS "follows_followerOwnerId_followingOwnerId_key";
DROP INDEX IF EXISTS "projects_ownerId_createdAt_idx";
DROP INDEX IF EXISTS "events_ownerId_createdAt_idx";
DROP INDEX IF EXISTS "posts_ownerId_createdAt_idx";
DROP INDEX IF EXISTS "posts_projectId_createdAt_idx";
DROP INDEX IF EXISTS "posts_eventId_createdAt_idx";
DROP INDEX IF EXISTS "messages_senderId_idx";
DROP INDEX IF EXISTS "messages_receiverId_idx";
DROP INDEX IF EXISTS "messages_senderOrgId_idx";
DROP INDEX IF EXISTS "messages_receiverOrgId_idx";
DROP INDEX IF EXISTS "images_uploadedById_idx";

-- ============================================================================
-- 5. Migrate Orgs → Pages
-- ============================================================================

INSERT INTO "pages" ("id", "createdByUserId", "createdAt", "updatedAt", "name", "slug", "headline", "bio", "interests", "location", "visibility", "addressLine1", "addressLine2", "city", "state", "zip", "parentTopic", "tags", "avatarImageId", "isOpenToCollaborators")
SELECT
    o."id", o."createdByUserId", o."createdAt", o."updatedAt", o."name", o."slug",
    o."headline", o."bio", COALESCE(o."interests", ARRAY[]::TEXT[]), o."location",
    CASE WHEN o."isPublic" THEN 'PUBLIC'::"PageVisibility" ELSE 'PRIVATE'::"PageVisibility" END,
    o."addressLine1", o."addressLine2", o."city", o."state", o."zip",
    o."parentTopic", COALESCE(o."tags", ARRAY[]::TEXT[]), o."avatarImageId", false
FROM "orgs" o;

-- Migrate OrgToTopic → PageToTopic
CREATE TABLE "_PageToTopic" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_PageToTopic_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_PageToTopic_B_index" ON "_PageToTopic"("B");

INSERT INTO "_PageToTopic" ("A", "B")
SELECT "A", "B" FROM "_OrgToTopic";

-- ============================================================================
-- 6. Migrate OrgMembers → Permissions
-- ============================================================================

INSERT INTO "permissions" ("id", "userId", "resourceId", "resourceType", "role", "createdAt")
SELECT
    om."id", ow."userId", om."orgId", 'PAGE'::"ResourceType",
    CASE
        WHEN om."role" = 'OWNER' THEN 'ADMIN'::"PermissionRole"
        WHEN om."role" = 'ADMIN' THEN 'ADMIN'::"PermissionRole"
        ELSE 'MEMBER'::"PermissionRole"
    END,
    om."createdAt"
FROM "org_members" om
JOIN "owners" ow ON ow."id" = om."ownerId";

-- ============================================================================
-- 7. Add new columns (nullable first)
-- ============================================================================

ALTER TABLE "events" ADD COLUMN "userId" TEXT;
ALTER TABLE "events" ADD COLUMN "pageId" TEXT;
ALTER TABLE "posts" ADD COLUMN "userId" TEXT;
ALTER TABLE "posts" ADD COLUMN "pageId" TEXT;
ALTER TABLE "posts" ADD COLUMN "parentPostId" TEXT;
ALTER TABLE "images" ADD COLUMN "uploadedByUserId" TEXT;
ALTER TABLE "follows" ADD COLUMN "followerId" TEXT;
ALTER TABLE "follows" ADD COLUMN "followingUserId" TEXT;
ALTER TABLE "follows" ADD COLUMN "followingPageId" TEXT;
ALTER TABLE "messages" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "messages" ADD COLUMN "asPageId" TEXT;

-- ============================================================================
-- 8. Migrate data: resolve ownerIds → userIds
-- ============================================================================

-- Events
UPDATE "events" e SET "userId" = ow."userId" FROM "owners" ow WHERE ow."id" = e."ownerId";

-- Posts
UPDATE "posts" p SET "userId" = ow."userId" FROM "owners" ow WHERE ow."id" = p."ownerId";

-- Images
UPDATE "images" i SET "uploadedByUserId" = ow."userId" FROM "owners" ow WHERE ow."id" = i."uploadedById";

-- Follows: follower side (always a user)
UPDATE "follows" f SET "followerId" = follower."userId" FROM "owners" follower WHERE follower."id" = f."followerOwnerId";

-- Follows: following side — split by owner type
UPDATE "follows" f SET "followingUserId" = following."userId"
FROM "owners" following WHERE following."id" = f."followingOwnerId" AND following."type" = 'USER';

UPDATE "follows" f SET "followingPageId" = following."orgId"
FROM "owners" following WHERE following."id" = f."followingOwnerId" AND following."type" = 'ORG';

-- ============================================================================
-- 9. Migrate Messages → Conversation model
-- ============================================================================

-- Build a mapping of unique conversation pairs
CREATE TEMP TABLE "convo_pairs" AS
SELECT DISTINCT
    LEAST("senderId", "receiverId") AS "ownerId1",
    GREATEST("senderId", "receiverId") AS "ownerId2"
FROM "messages";

ALTER TABLE "convo_pairs" ADD COLUMN "conversationId" TEXT;
UPDATE "convo_pairs" SET "conversationId" = gen_random_uuid()::TEXT;

-- Create conversations
INSERT INTO "conversations" ("id", "createdAt", "updatedAt")
SELECT
    cp."conversationId",
    (SELECT MIN("createdAt") FROM "messages" WHERE LEAST("senderId", "receiverId") = cp."ownerId1" AND GREATEST("senderId", "receiverId") = cp."ownerId2"),
    (SELECT MAX("createdAt") FROM "messages" WHERE LEAST("senderId", "receiverId") = cp."ownerId1" AND GREATEST("senderId", "receiverId") = cp."ownerId2")
FROM "convo_pairs" cp;

-- Create participants (resolve ownerIds to userIds)
INSERT INTO "conversation_participants" ("id", "conversationId", "userId")
SELECT gen_random_uuid()::TEXT, cp."conversationId", ow."userId"
FROM "convo_pairs" cp JOIN "owners" ow ON ow."id" = cp."ownerId1";

INSERT INTO "conversation_participants" ("id", "conversationId", "userId")
SELECT gen_random_uuid()::TEXT, cp."conversationId", ow."userId"
FROM "convo_pairs" cp JOIN "owners" ow ON ow."id" = cp."ownerId2";

-- Link messages to conversations
UPDATE "messages" m SET "conversationId" = cp."conversationId"
FROM "convo_pairs" cp
WHERE LEAST(m."senderId", m."receiverId") = cp."ownerId1"
AND GREATEST(m."senderId", m."receiverId") = cp."ownerId2";

-- Update senderId from ownerId to userId
UPDATE "messages" m SET "senderId" = ow."userId" FROM "owners" ow WHERE ow."id" = m."senderId";

DROP TABLE IF EXISTS "convo_pairs";

-- ============================================================================
-- 9b. Deduplicate follows (multiple owners per user can create duplicates)
-- ============================================================================

-- Remove duplicate followingUserId entries (keep the earliest)
DELETE FROM "follows" a USING "follows" b
WHERE a."id" > b."id"
AND a."followerId" = b."followerId"
AND a."followingUserId" IS NOT NULL
AND a."followingUserId" = b."followingUserId";

-- Remove duplicate followingPageId entries (keep the earliest)
DELETE FROM "follows" a USING "follows" b
WHERE a."id" > b."id"
AND a."followerId" = b."followerId"
AND a."followingPageId" IS NOT NULL
AND a."followingPageId" = b."followingPageId";

-- ============================================================================
-- 10. Enforce NOT NULL, add new indexes
-- ============================================================================

ALTER TABLE "events" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "posts" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "images" ALTER COLUMN "uploadedByUserId" SET NOT NULL;
ALTER TABLE "follows" ALTER COLUMN "followerId" SET NOT NULL;
ALTER TABLE "messages" ALTER COLUMN "conversationId" SET NOT NULL;

CREATE INDEX "events_userId_createdAt_idx" ON "events"("userId", "createdAt");
CREATE INDEX "events_pageId_createdAt_idx" ON "events"("pageId", "createdAt");
CREATE INDEX "posts_userId_createdAt_idx" ON "posts"("userId", "createdAt");
CREATE INDEX "posts_pageId_createdAt_idx" ON "posts"("pageId", "createdAt");
CREATE INDEX "posts_eventId_createdAt_idx" ON "posts"("eventId", "createdAt");
CREATE INDEX "posts_parentPostId_createdAt_idx" ON "posts"("parentPostId", "createdAt");
CREATE UNIQUE INDEX "follows_followerId_followingUserId_key" ON "follows"("followerId", "followingUserId");
CREATE UNIQUE INDEX "follows_followerId_followingPageId_key" ON "follows"("followerId", "followingPageId");
CREATE INDEX "follows_followerId_idx" ON "follows"("followerId");
CREATE INDEX "follows_followingUserId_idx" ON "follows"("followingUserId");
CREATE INDEX "follows_followingPageId_idx" ON "follows"("followingPageId");
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- ============================================================================
-- 11. Migrate ImageAttachment type enum
-- ============================================================================

ALTER TABLE "image_attachments" ADD COLUMN "type_new" "AttachmentTarget";
UPDATE "image_attachments" SET "type_new" = CASE
    WHEN "type"::TEXT = 'PROJECT' THEN 'PAGE'::"AttachmentTarget"
    WHEN "type"::TEXT = 'EVENT' THEN 'EVENT'::"AttachmentTarget"
    WHEN "type"::TEXT = 'POST' THEN 'POST'::"AttachmentTarget"
    WHEN "type"::TEXT = 'IMAGE' THEN 'IMAGE'::"AttachmentTarget"
    WHEN "type"::TEXT = 'MESSAGE' THEN 'MESSAGE'::"AttachmentTarget"
    ELSE 'PAGE'::"AttachmentTarget"
END;
ALTER TABLE "image_attachments" DROP COLUMN "type";
ALTER TABLE "image_attachments" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "image_attachments" ALTER COLUMN "type" SET NOT NULL;

-- ============================================================================
-- 12. Drop old columns
-- ============================================================================

ALTER TABLE "events" DROP COLUMN "ownerId";
ALTER TABLE "posts" DROP COLUMN "ownerId";
ALTER TABLE "posts" DROP COLUMN "projectId";
ALTER TABLE "images" DROP COLUMN "uploadedById";
ALTER TABLE "follows" DROP COLUMN "followerOwnerId";
ALTER TABLE "follows" DROP COLUMN "followingOwnerId";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "receiverId";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "senderOrgId";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "receiverOrgId";
ALTER TABLE "users" DROP COLUMN IF EXISTS "ownerId";

-- ============================================================================
-- 13. Drop old tables
-- ============================================================================

DROP TABLE IF EXISTS "_OrgToTopic";
DROP TABLE IF EXISTS "org_members";
DROP TABLE IF EXISTS "projects";
DROP TABLE IF EXISTS "orgs";
DROP TABLE IF EXISTS "owners";

-- ============================================================================
-- 14. Drop old enums
-- ============================================================================

DROP TYPE IF EXISTS "OrgRole";
DROP TYPE IF EXISTS "OwnerStatus";
DROP TYPE IF EXISTS "OwnerType";
DROP TYPE IF EXISTS "ArtifactType";

-- ============================================================================
-- 15. Add new foreign key constraints
-- ============================================================================

-- Pages
ALTER TABLE "pages" ADD CONSTRAINT "pages_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pages" ADD CONSTRAINT "pages_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PageToTopic join table
ALTER TABLE "_PageToTopic" ADD CONSTRAINT "_PageToTopic_A_fkey" FOREIGN KEY ("A") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PageToTopic" ADD CONSTRAINT "_PageToTopic_B_fkey" FOREIGN KEY ("B") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permissions
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Events
ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Posts (keep existing eventId FK, add new ones)
ALTER TABLE "posts" ADD CONSTRAINT "posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Images
ALTER TABLE "images" ADD CONSTRAINT "images_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Follows
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingUserId_fkey" FOREIGN KEY ("followingUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingPageId_fkey" FOREIGN KEY ("followingPageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conversations
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Messages
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
