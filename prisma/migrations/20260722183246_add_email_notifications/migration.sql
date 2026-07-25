-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('COMMENTS', 'REQUESTS', 'FOLLOWS', 'MESSAGES', 'RSVPS');

-- CreateEnum
CREATE TYPE "EmailSourceType" AS ENUM ('NOTIFICATION', 'MESSAGE');

-- NOTE: Prisma's diff wanted to DROP the pg_trgm search indexes (pages_*_trgm_idx, users_*_trgm_idx)
-- from migration 20260620000000 because they are raw-SQL GIN indexes not represented in schema.prisma.
-- Those DROP INDEX statements were removed by hand — the search indexes must stay.

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "contextPageId" TEXT,
    "category" "NotificationCategory",
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientUserId" TEXT NOT NULL,
    "contextPageId" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "sourceType" "EmailSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_contextPageId_idx" ON "notification_preferences"("contextPageId");

-- CreateIndex
CREATE INDEX "email_outbox_recipientUserId_contextPageId_idx" ON "email_outbox"("recipientUserId", "contextPageId");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_contextPageId_fkey" FOREIGN KEY ("contextPageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Uniqueness per (user, context, category). Split into four partial indexes because the nullable
-- contextPageId AND nullable category both make a plain composite unique NULL-permissive. `category`
-- NULL is the per-context master; `contextPageId` NULL is the user's personal profile.
CREATE UNIQUE INDEX "notif_pref_personal_category_uq" ON "notification_preferences" ("userId", "category")
    WHERE "contextPageId" IS NULL AND "category" IS NOT NULL;
CREATE UNIQUE INDEX "notif_pref_page_category_uq" ON "notification_preferences" ("userId", "contextPageId", "category")
    WHERE "contextPageId" IS NOT NULL AND "category" IS NOT NULL;
CREATE UNIQUE INDEX "notif_pref_personal_master_uq" ON "notification_preferences" ("userId")
    WHERE "contextPageId" IS NULL AND "category" IS NULL;
CREATE UNIQUE INDEX "notif_pref_page_master_uq" ON "notification_preferences" ("userId", "contextPageId")
    WHERE "contextPageId" IS NOT NULL AND "category" IS NULL;

-- Partial index so the flush scans only pending rows (sentAt IS NULL), not emailed history.
CREATE INDEX "email_outbox_pending" ON "email_outbox" ("createdAt") WHERE "sentAt" IS NULL;
