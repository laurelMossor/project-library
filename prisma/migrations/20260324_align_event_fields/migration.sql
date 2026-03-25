-- Rename Event.description to Event.content (data-preserving column rename)
ALTER TABLE "events" RENAME COLUMN "description" TO "content";

-- Make Event.title nullable
ALTER TABLE "events" ALTER COLUMN "title" DROP NOT NULL;
