-- ============================================
-- Migration Script: Schema v1 → Schema v2
-- ============================================
-- This script migrates the database from v1 schema to v2 schema
-- Run this on your LOCAL database first to test
-- 
-- IMPORTANT: Backup your database before running this!
-- ============================================

BEGIN;

-- ============================================
-- Step 1: Create Enums
-- ============================================

CREATE TYPE "ActorType" AS ENUM ('USER', 'ORG');
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'FOLLOWER');
CREATE TYPE "AttachmentType" AS ENUM ('PROJECT', 'EVENT', 'POST');

-- ============================================
-- Step 2: Create Actor records for all Users
-- ============================================

-- Create actors table
CREATE TABLE "actors" (
  "id" TEXT NOT NULL,
  "type" "ActorType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "actors_pkey" PRIMARY KEY ("id")
);

-- Create Actor record for each existing User
-- Using cuid() equivalent: generate random string IDs
INSERT INTO "actors" ("id", "type", "createdAt")
SELECT 
  -- Generate a cuid-like ID (simplified: uses timestamp + random)
  'cl' || substr(md5(random()::text || clock_timestamp()::text), 1, 22),
  'USER'::"ActorType",
  "createdAt"
FROM "users";

-- ============================================
-- Step 3: Link Users to Actors
-- ============================================

-- Add actorId column to users
ALTER TABLE "users" ADD COLUMN "actorId" TEXT;

-- Create temporary mapping table to link users to actors
-- We'll use the order of creation to match them
CREATE TEMP TABLE user_actor_mapping AS
SELECT 
  u.id as user_id,
  a.id as actor_id,
  ROW_NUMBER() OVER (ORDER BY u."createdAt") as row_num
FROM "users" u
ORDER BY u."createdAt";

-- Update users with their actor IDs
UPDATE "users" u
SET "actorId" = (
  SELECT actor_id 
  FROM user_actor_mapping m 
  WHERE m.user_id = u.id
);

-- Make actorId required and add foreign key
ALTER TABLE "users" ALTER COLUMN "actorId" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_actorId_fkey" 
  FOREIGN KEY ("actorId") REFERENCES "actors"("id") ON DELETE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_actorId_key" UNIQUE ("actorId");

-- ============================================
-- Step 4: Migrate User.name to firstName/lastName
-- ============================================

-- Add new name columns
ALTER TABLE "users" ADD COLUMN "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN "middleName" TEXT;
ALTER TABLE "users" ADD COLUMN "lastName" TEXT;

-- Simple migration: split name on first space
-- First word → firstName, rest → lastName
UPDATE "users"
SET 
  "firstName" = CASE 
    WHEN "name" IS NULL OR "name" = '' THEN NULL
    WHEN position(' ' in "name") > 0 THEN split_part("name", ' ', 1)
    ELSE "name"
  END,
  "lastName" = CASE 
    WHEN "name" IS NULL OR "name" = '' THEN NULL
    WHEN position(' ' in "name") > 0 THEN 
      -- Get everything after first space
      substring("name" from position(' ' in "name") + 1)
    ELSE NULL
  END
WHERE "name" IS NOT NULL;

-- ============================================
-- Step 5: Update Projects to use ownerActorId
-- ============================================

-- Add ownerActorId column
ALTER TABLE "projects" ADD COLUMN "ownerActorId" TEXT;

-- Populate ownerActorId from user's actorId
UPDATE "projects" p
SET "ownerActorId" = (
  SELECT u."actorId"
  FROM "users" u
  WHERE u.id = p."ownerId"
);

-- Make ownerActorId required and add foreign key
ALTER TABLE "projects" ALTER COLUMN "ownerActorId" SET NOT NULL;
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerActorId_fkey"
  FOREIGN KEY ("ownerActorId") REFERENCES "actors"("id") ON DELETE CASCADE;

-- Create index
CREATE INDEX "projects_ownerActorId_idx" ON "projects"("ownerActorId");

-- ============================================
-- Step 6: Update Events to use ownerActorId
-- ============================================

-- Add ownerActorId column
ALTER TABLE "events" ADD COLUMN "ownerActorId" TEXT;

-- Populate ownerActorId from user's actorId
UPDATE "events" e
SET "ownerActorId" = (
  SELECT u."actorId"
  FROM "users" u
  WHERE u.id = e."ownerId"
);

-- Make ownerActorId required and add foreign key
ALTER TABLE "events" ALTER COLUMN "ownerActorId" SET NOT NULL;
ALTER TABLE "events" ADD CONSTRAINT "events_ownerActorId_fkey"
  FOREIGN KEY ("ownerActorId") REFERENCES "actors"("id") ON DELETE CASCADE;

-- Create index
CREATE INDEX "events_ownerActorId_idx" ON "events"("ownerActorId");

-- ============================================
-- Step 7: Create ImageAttachment system
-- ============================================

-- Create image_attachments table
CREATE TABLE "image_attachments" (
  "id" TEXT NOT NULL,
  "imageId" TEXT NOT NULL,
  "type" "AttachmentType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "image_attachments_pkey" PRIMARY KEY ("id")
);

-- Migrate existing images to image_attachments
-- For project images
INSERT INTO "image_attachments" ("id", "imageId", "type", "targetId", "createdAt")
SELECT 
  'cl' || substr(md5(random()::text || clock_timestamp()::text), 1, 22),
  i.id,
  'PROJECT'::"AttachmentType",
  i."projectId",
  i."createdAt"
FROM "images" i
WHERE i."projectId" IS NOT NULL;

-- For event images
INSERT INTO "image_attachments" ("id", "imageId", "type", "targetId", "createdAt")
SELECT 
  'cl' || substr(md5(random()::text || clock_timestamp()::text), 1, 22),
  i.id,
  'EVENT'::"AttachmentType",
  i."eventId",
  i."createdAt"
FROM "images" i
WHERE i."eventId" IS NOT NULL;

-- Add foreign keys
ALTER TABLE "image_attachments" ADD CONSTRAINT "image_attachments_imageId_fkey"
  FOREIGN KEY ("imageId") REFERENCES "images"("id") ON DELETE CASCADE;

-- Create indexes
CREATE INDEX "image_attachments_imageId_idx" ON "image_attachments"("imageId");
CREATE INDEX "image_attachments_targetId_idx" ON "image_attachments"("targetId");
CREATE INDEX "image_attachments_type_targetId_idx" ON "image_attachments"("type", "targetId");

-- ============================================
-- Step 8: Migrate Entries to Posts
-- ============================================

-- Create posts table
CREATE TABLE "posts" (
  "id" TEXT NOT NULL,
  "ownerActorId" TEXT NOT NULL,
  "projectId" TEXT,
  "eventId" TEXT,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- Migrate project entries to posts
INSERT INTO "posts" ("id", "ownerActorId", "projectId", "title", "content", "createdAt", "updatedAt")
SELECT 
  e.id,
  p."ownerActorId",  -- Use project's ownerActorId
  e."collectionId" as "projectId",
  e.title,
  e.content,
  e."createdAt",
  e."updatedAt"
FROM "entries" e
JOIN "projects" p ON e."collectionId" = p.id
WHERE e."collectionType" = 'project';

-- Migrate event entries to posts
INSERT INTO "posts" ("id", "ownerActorId", "eventId", "title", "content", "createdAt", "updatedAt")
SELECT 
  e.id,
  ev."ownerActorId",  -- Use event's ownerActorId
  e."collectionId" as "eventId",
  e.title,
  e.content,
  e."createdAt",
  e."updatedAt"
FROM "entries" e
JOIN "events" ev ON e."collectionId" = ev.id
WHERE e."collectionType" = 'event';

-- Note: Standalone entries (no matching collectionType) are skipped
-- You may want to handle these separately if they exist

-- Add foreign keys
ALTER TABLE "posts" ADD CONSTRAINT "posts_ownerActorId_fkey"
  FOREIGN KEY ("ownerActorId") REFERENCES "actors"("id") ON DELETE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE;

-- Create indexes
CREATE INDEX "posts_ownerActorId_createdAt_idx" ON "posts"("ownerActorId", "createdAt");
CREATE INDEX "posts_projectId_createdAt_idx" ON "posts"("projectId", "createdAt");
CREATE INDEX "posts_eventId_createdAt_idx" ON "posts"("eventId", "createdAt");

-- ============================================
-- Step 9: Add Avatar Support
-- ============================================

-- Add avatarImageId to users
ALTER TABLE "users" ADD COLUMN "avatarImageId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_avatarImageId_fkey"
  FOREIGN KEY ("avatarImageId") REFERENCES "images"("id") ON DELETE SET NULL;

-- Note: Orgs table doesn't exist yet, so we'll skip that for now
-- (Orgs will be created when you run the Prisma migration)

-- ============================================
-- Step 10: Create Org tables (for future use)
-- ============================================

-- Create orgs table
CREATE TABLE "orgs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "headline" TEXT,
  "bio" TEXT,
  "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "location" TEXT,
  "avatarImageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orgs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orgs" ADD CONSTRAINT "orgs_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "actors"("id") ON DELETE CASCADE;
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_actorId_key" UNIQUE ("actorId");
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_slug_key" UNIQUE ("slug");
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_avatarImageId_fkey"
  FOREIGN KEY ("avatarImageId") REFERENCES "images"("id") ON DELETE SET NULL;

-- Create org_members table
CREATE TABLE "org_members" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "org_members" ADD CONSTRAINT "org_members_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_orgId_userId_key" UNIQUE ("orgId", "userId");

CREATE INDEX "org_members_orgId_role_idx" ON "org_members"("orgId", "role");

-- Create org_role_labels table
CREATE TABLE "org_role_labels" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "OrgRole" NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "org_role_labels_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "org_role_labels" ADD CONSTRAINT "org_role_labels_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE;

-- Create follows table
CREATE TABLE "follows" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "actors"("id") ON DELETE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_fkey"
  FOREIGN KEY ("followingId") REFERENCES "actors"("id") ON DELETE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_followingId_key" UNIQUE ("followerId", "followingId");

CREATE INDEX "follows_followingId_idx" ON "follows"("followingId");

-- ============================================
-- Step 11: Remove deprecated fields (OPTIONAL - Commented out for safety)
-- ============================================

-- Remove type field from projects/events (if not needed)
-- ALTER TABLE "projects" DROP COLUMN IF EXISTS "type";
-- ALTER TABLE "events" DROP COLUMN IF EXISTS "type";

-- Remove old ownerId columns (after verification that ownerActorId works)
-- ALTER TABLE "projects" DROP COLUMN "ownerId";
-- ALTER TABLE "events" DROP COLUMN "ownerId";

-- Remove projectId/eventId from images (after ImageAttachment migration verified)
-- ALTER TABLE "images" DROP COLUMN IF EXISTS "projectId";
-- ALTER TABLE "images" DROP COLUMN IF EXISTS "eventId";
-- ALTER TABLE "images" DROP COLUMN IF EXISTS "postId";

-- Remove name column from users (after firstName/lastName migration verified)
-- ALTER TABLE "users" DROP COLUMN "name";

-- Drop entries table (after posts migration verified)
-- DROP TABLE "entries";

COMMIT;

-- ============================================
-- Migration Complete!
-- ============================================
-- Next steps:
-- 1. Verify data integrity
-- 2. Test the application
-- 3. Once verified, uncomment the cleanup steps in Step 11
-- 4. Run Prisma generate: npx prisma generate
-- ============================================

