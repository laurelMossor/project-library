/*
  Warnings:

  - You are about to drop the column `parentTopic` on the `pages` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProfileElementKind" AS ENUM ('SOCIAL_LINK', 'CTA', 'TEXT');

-- AlterTable
ALTER TABLE "pages" DROP COLUMN "parentTopic",
ADD COLUMN     "aboutContent" TEXT,
ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aboutContent" TEXT;

-- CreateTable
CREATE TABLE "profile_elements" (
    "id" TEXT NOT NULL,
    "kind" "ProfileElementKind" NOT NULL,
    "userId" TEXT,
    "pageId" TEXT,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "caption" TEXT,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_elements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_elements_userId_sortOrder_idx" ON "profile_elements"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX "profile_elements_pageId_sortOrder_idx" ON "profile_elements"("pageId", "sortOrder");

-- AddForeignKey
ALTER TABLE "profile_elements" ADD CONSTRAINT "profile_elements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_elements" ADD CONSTRAINT "profile_elements_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
