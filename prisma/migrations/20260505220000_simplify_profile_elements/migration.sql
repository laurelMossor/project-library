-- Remove old element kinds and replace enum with LINK + TEXT
-- Remove isOpenToCollaborators from pages

-- Clear elements with old enum values before changing the enum
DELETE FROM "profile_elements" WHERE "kind" IN ('SOCIAL_LINK', 'CTA');

-- Create new enum type
CREATE TYPE "ProfileElementKind_new" AS ENUM ('LINK', 'TEXT');

-- Migrate column to new enum (only TEXT values remain after delete above)
ALTER TABLE "profile_elements"
  ALTER COLUMN "kind" TYPE "ProfileElementKind_new"
  USING ("kind"::text::"ProfileElementKind_new");

-- Swap enum types
DROP TYPE "ProfileElementKind";
ALTER TYPE "ProfileElementKind_new" RENAME TO "ProfileElementKind";

-- Drop isOpenToCollaborators column
ALTER TABLE "pages" DROP COLUMN IF EXISTS "isOpenToCollaborators";
