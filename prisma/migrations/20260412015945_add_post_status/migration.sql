-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable: add column with DRAFT default so no existing row is missed
ALTER TABLE "posts" ADD COLUMN "status" "PostStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: every pre-existing post is already considered published
UPDATE "posts" SET "status" = 'PUBLISHED';
