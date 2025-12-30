/*
  Warnings:

  - You are about to drop the column `imageUrls` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the `project_entries` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "project_entries" DROP CONSTRAINT "project_entries_projectId_fkey";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "imageUrls";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "imageUrl";

-- DropTable
DROP TABLE "project_entries";

-- CreateTable
CREATE TABLE "entries" (
    "id" TEXT NOT NULL,
    "collectionType" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "altText" TEXT,
    "projectId" TEXT,
    "eventId" TEXT,
    "postId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entries_collectionType_collectionId_idx" ON "entries"("collectionType", "collectionId");

-- CreateIndex
CREATE INDEX "images_projectId_idx" ON "images"("projectId");

-- CreateIndex
CREATE INDEX "images_eventId_idx" ON "images"("eventId");

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
