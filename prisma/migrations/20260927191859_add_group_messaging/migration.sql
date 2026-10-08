-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'GROUP');

-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "name" TEXT;

-- Backfill: every existing conversation is a 1:1 DM (the kind default covers that). Seed each
-- participant's read marker from the old per-message read state: the newest readAt among messages
-- from OTHER identities. That is exact because the old mark-read was always conversation-wide, so
-- everything created before that moment was read too — unread counts are preserved as-is. (Going
-- forward, sending also advances the sender's marker; that is deliberately not back-applied, so no
-- one's unread silently changes at deploy.) "Own" is per identity: a page participant owns messages
-- sent as that page; a user participant owns messages they sent personally (asPageId IS NULL).
UPDATE "conversation_participants" cp
SET "lastReadAt" = (
  SELECT MAX(m."readAt") FROM "messages" m
  WHERE m."conversationId" = cp."conversationId"
    AND CASE WHEN cp."pageId" IS NOT NULL
             THEN m."asPageId" IS DISTINCT FROM cp."pageId"
             ELSE NOT (m."senderId" = cp."userId" AND m."asPageId" IS NULL) END
);
