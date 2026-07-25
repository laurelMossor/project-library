-- Migration: add_visibility_enum
--
-- 1. Create the new Visibility enum (supersedes PageVisibility)
-- 2. Add visibility to users, posts, events (all default PUBLIC)
-- 3. Migrate Page.visibility from PageVisibility → Visibility
--    (values are identical; done via type cast)
-- 4. Backfill:
--    - users: isPublic=false → PRIVATE, all others → PUBLIC (already default)
-- 5. Drop isPublic from users
-- 6. Drop the old PageVisibility enum

-- Step 1: Create the new enum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- Step 2a: Add visibility to users (nullable first so existing rows don't fail)
ALTER TABLE "users" ADD COLUMN "visibility" "Visibility";

-- Step 2b: Backfill users: map isPublic → visibility before dropping the column
UPDATE "users" SET "visibility" = CASE
  WHEN "isPublic" = false THEN 'PRIVATE'::"Visibility"
  ELSE 'PUBLIC'::"Visibility"
END;

-- Step 2c: Make visibility non-nullable with default
ALTER TABLE "users" ALTER COLUMN "visibility" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC'::"Visibility";

-- Step 2d: Drop isPublic
ALTER TABLE "users" DROP COLUMN "isPublic";

-- Step 3: Migrate pages.visibility from PageVisibility → Visibility
-- Add a new column, copy, drop old, rename
ALTER TABLE "pages" ADD COLUMN "visibility_new" "Visibility";
UPDATE "pages" SET "visibility_new" = "visibility"::text::"Visibility";
ALTER TABLE "pages" ALTER COLUMN "visibility_new" SET NOT NULL;
ALTER TABLE "pages" ALTER COLUMN "visibility_new" SET DEFAULT 'PUBLIC'::"Visibility";
ALTER TABLE "pages" DROP COLUMN "visibility";
ALTER TABLE "pages" RENAME COLUMN "visibility_new" TO "visibility";

-- Step 4: Add visibility to events (all PUBLIC by default)
ALTER TABLE "events" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC'::"Visibility";

-- Step 5: Add visibility to posts (all PUBLIC by default)
ALTER TABLE "posts" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC'::"Visibility";

-- Step 6: Drop the old enum
DROP TYPE "PageVisibility";
