-- CreateEnum
CREATE TYPE "EventSubmissionStatus" AS ENUM ('PENDING', 'READY', 'NEEDS_FIX', 'FAILED', 'PUBLISHED', 'REJECTED');

-- DropIndex
DROP INDEX "pages_handle_trgm_idx";

-- DropIndex
DROP INDEX "pages_name_trgm_idx";

-- DropIndex
DROP INDEX "users_displayName_trgm_idx";

-- DropIndex
DROP INDEX "users_firstName_trgm_idx";

-- DropIndex
DROP INDEX "users_handle_trgm_idx";

-- DropIndex
DROP INDEX "users_lastName_trgm_idx";

-- CreateTable
CREATE TABLE "event_submissions" (
    "id" TEXT NOT NULL,
    "status" "EventSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submitterTelegramId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT,
    "rawCaption" TEXT,
    "rawImageId" TEXT,
    "title" TEXT,
    "content" TEXT,
    "eventDate" TIMESTAMP(3),
    "eventTimezone" TEXT,
    "location" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errorNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_submissions_status_submittedAt_idx" ON "event_submissions"("status", "submittedAt");

-- AddForeignKey
ALTER TABLE "event_submissions" ADD CONSTRAINT "event_submissions_rawImageId_fkey" FOREIGN KEY ("rawImageId") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
