-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'CANT_MAKE_IT');

-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "pages" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rsvps_eventId_idx" ON "rsvps"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "rsvps_eventId_email_key" ON "rsvps"("eventId", "email");

-- CreateIndex
CREATE INDEX "image_attachments_type_targetId_idx" ON "image_attachments"("type", "targetId");

-- CreateIndex
CREATE INDEX "images_uploadedByUserId_idx" ON "images"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
