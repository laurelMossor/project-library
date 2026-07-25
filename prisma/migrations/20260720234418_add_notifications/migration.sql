-- Additive-only: new Notification table + two enums. No changes to existing tables/columns.
-- NOTE: `prisma migrate dev` also tried to DROP the pg_trgm search indexes
-- (pages_*_trgm_idx / users_*_trgm_idx) because they were hand-added via raw SQL in
-- 20260620000000 and aren't represented in schema.prisma. Those DROP statements were removed
-- by hand — the search indexes must survive.

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMMENT', 'FOLLOW_REQUEST', 'JOIN_REQUEST', 'NEW_FOLLOWER', 'NEW_MEMBER', 'RSVP', 'REQUEST_APPROVED');

-- CreateEnum
CREATE TYPE "NotificationObject" AS ENUM ('POST', 'EVENT', 'PAGE');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "recipientUserId" TEXT NOT NULL,
    "contextPageId" TEXT,
    "type" "NotificationType" NOT NULL,
    "actorUserId" TEXT,
    "actorPageId" TEXT,
    "actorName" TEXT,
    "objectType" "NotificationObject",
    "objectId" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_contextPageId_readAt_idx" ON "notifications"("recipientUserId", "contextPageId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_contextPageId_createdAt_idx" ON "notifications"("recipientUserId", "contextPageId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_contextPageId_fkey" FOREIGN KEY ("contextPageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorPageId_fkey" FOREIGN KEY ("actorPageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Actor is a user OR a page OR account-less (guest RSVP) — never both an account and... both.
-- Matches the hand-written CHECK style in 20260706000100_add_invariant_check_constraints.
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_at_most_one_account"
    CHECK (("actorUserId" IS NOT NULL)::int + ("actorPageId" IS NOT NULL)::int <= 1);
