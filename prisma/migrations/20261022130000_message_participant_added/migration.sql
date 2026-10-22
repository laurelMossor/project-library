-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'PARTICIPANT_ADDED');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "subjectPageId" TEXT,
ADD COLUMN     "subjectUserId" TEXT;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_subjectPageId_fkey" FOREIGN KEY ("subjectPageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A subject belongs only to a PARTICIPANT_ADDED line, and never both kinds of subject at once. (Both
-- null is allowed: the added account or page may since have been deleted, which nulls its column.)
ALTER TABLE "messages" ADD CONSTRAINT "messages_subject_only_for_participant_added"
    CHECK (
      ("kind" = 'PARTICIPANT_ADDED' OR ("subjectUserId" IS NULL AND "subjectPageId" IS NULL))
      AND ("subjectUserId" IS NULL OR "subjectPageId" IS NULL)
    );
