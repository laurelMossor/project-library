-- CreateEnum
CREATE TYPE "MembershipPolicy" AS ENUM ('CLOSED', 'INVITE_ONLY', 'REQUEST_TO_JOIN', 'OPEN');

-- AlterEnum
ALTER TYPE "AccessRequestKind" ADD VALUE 'INVITE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MEMBER_INVITE';
ALTER TYPE "NotificationType" ADD VALUE 'ROLE_CHANGED';

-- AlterTable
ALTER TABLE "access_requests" ADD COLUMN     "role" "PermissionRole";

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "asPageId" TEXT,
ADD COLUMN     "showOnAuthorProfile" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "allowMemberPosts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "membershipPolicy" "MembershipPolicy" NOT NULL DEFAULT 'CLOSED';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "asPageId" TEXT,
ADD COLUMN     "showOnAuthorProfile" BOOLEAN NOT NULL DEFAULT false;

-- Existing page content was "posted AS the page". Keep that meaning: asPageId mirrors pageId.
UPDATE "posts" SET "asPageId" = "pageId" WHERE "pageId" IS NOT NULL;
UPDATE "events" SET "asPageId" = "pageId" WHERE "pageId" IS NOT NULL;

-- Who's speaking, when set, is the same page the content lives on. A scalar (no second FK)
-- because pageId already cascades; this CHECK makes the two columns unable to drift.
ALTER TABLE "posts" ADD CONSTRAINT "posts_as_page_matches_page"
    CHECK ("asPageId" IS NULL OR "asPageId" = "pageId");
ALTER TABLE "events" ADD CONSTRAINT "events_as_page_matches_page"
    CHECK ("asPageId" IS NULL OR "asPageId" = "pageId");
