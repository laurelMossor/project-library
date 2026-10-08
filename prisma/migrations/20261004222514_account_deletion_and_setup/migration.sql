-- CreateEnum
CREATE TYPE "DeletedAs" AS ENUM ('USER', 'PAGE');

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_authorId_fkey";

-- DropForeignKey
ALTER TABLE "images" DROP CONSTRAINT "images_uploadedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "deletedAs" "DeletedAs",
ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "images" ALTER COLUMN "uploadedByUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deletedAs" "DeletedAs",
ALTER COLUMN "senderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "setupCompletedAt" TIMESTAMP(3);

-- Existing accounts already passed the point where /setup would run.
UPDATE "users" SET "setupCompletedAt" = NOW() WHERE "setupCompletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
