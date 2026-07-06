-- Split profile visibility into two independent sibling fields and rename the shared
-- content enum. profileVisibility {PUBLIC,PRIVATE} governs profile access; contentVisibility
-- {LISTED,UNLISTED,PRIVATE} is the profile-wide default a post/event inherits.
--
-- ⚠️ BREAKING: this renames the content enum value PUBLIC -> LISTED, so it must ship
-- coordinated with the code that reads LISTED (see plan). Expand-then-contract: the
-- deprecated users/pages.visibility column is KEPT here and dropped in a later Phase-2 PR.

-- 1) Rename the shared content enum value + type in place (non-destructive; data preserved).
ALTER TYPE "Visibility" RENAME VALUE 'PUBLIC' TO 'LISTED';
ALTER TYPE "Visibility" RENAME TO "ContentVisibility";

-- 2) New profile-access enum.
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- 3) Add the two new profile columns (nullable first so we can backfill).
ALTER TABLE "users" ADD COLUMN "profileVisibility" "ProfileVisibility";
ALTER TABLE "users" ADD COLUMN "contentVisibility" "ContentVisibility";
ALTER TABLE "pages" ADD COLUMN "profileVisibility" "ProfileVisibility";
ALTER TABLE "pages" ADD COLUMN "contentVisibility" "ContentVisibility";

-- 4) Backfill from the existing (now renamed) single visibility column:
--    profileVisibility: PRIVATE stays PRIVATE, everything else becomes PUBLIC (discoverable).
--    contentVisibility: carries the old value 1:1 (LISTED/UNLISTED/PRIVATE).
--    => old PUBLIC -> (PUBLIC, LISTED); UNLISTED -> (PUBLIC, UNLISTED); PRIVATE -> (PRIVATE, PRIVATE).
UPDATE "users" SET
  "profileVisibility" = (CASE WHEN "visibility" = 'PRIVATE' THEN 'PRIVATE' ELSE 'PUBLIC' END)::"ProfileVisibility",
  "contentVisibility" = "visibility";
UPDATE "pages" SET
  "profileVisibility" = (CASE WHEN "visibility" = 'PRIVATE' THEN 'PRIVATE' ELSE 'PUBLIC' END)::"ProfileVisibility",
  "contentVisibility" = "visibility";

-- 5) Enforce NOT NULL + defaults on the new columns.
ALTER TABLE "users" ALTER COLUMN "profileVisibility" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "profileVisibility" SET DEFAULT 'PUBLIC';
ALTER TABLE "users" ALTER COLUMN "contentVisibility" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "contentVisibility" SET DEFAULT 'LISTED';
ALTER TABLE "pages" ALTER COLUMN "profileVisibility" SET NOT NULL;
ALTER TABLE "pages" ALTER COLUMN "profileVisibility" SET DEFAULT 'PUBLIC';
ALTER TABLE "pages" ALTER COLUMN "contentVisibility" SET NOT NULL;
ALTER TABLE "pages" ALTER COLUMN "contentVisibility" SET DEFAULT 'LISTED';

-- 6) The old columns' DEFAULT referenced 'PUBLIC', which no longer exists after the value
--    rename — reset every visibility default to 'LISTED' so inserts stay valid.
ALTER TABLE "users" ALTER COLUMN "visibility" SET DEFAULT 'LISTED';
ALTER TABLE "pages" ALTER COLUMN "visibility" SET DEFAULT 'LISTED';
ALTER TABLE "posts" ALTER COLUMN "visibility" SET DEFAULT 'LISTED';
ALTER TABLE "events" ALTER COLUMN "visibility" SET DEFAULT 'LISTED';

-- 7) Fix content that was born too PUBLIC under a stricter parent (the audit's root cause:
--    content defaulted to PUBLIC/LISTED even when its owner's contentVisibility was narrower).
--    NARROW-ONLY: a row is rewritten to the parent's value only when the parent is strictly
--    stricter than the child (rank LISTED < UNLISTED < PRIVATE). This never widens content a
--    user deliberately narrowed (e.g. a PRIVATE event under a PUBLIC-content profile stays
--    PRIVATE). Order matters (events before event-attached posts). At this point the post/event
--    column is still named "visibility" — the rename to "contentVisibility" is a later migration.
UPDATE "events" e SET "visibility" = p."contentVisibility"
  FROM "pages" p WHERE e."pageId" = p."id"
    AND (CASE p."contentVisibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END)
      > (CASE e."visibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END);
UPDATE "events" e SET "visibility" = u."contentVisibility"
  FROM "users" u WHERE e."pageId" IS NULL AND e."userId" = u."id"
    AND (CASE u."contentVisibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END)
      > (CASE e."visibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END);
UPDATE "posts" po SET "visibility" = p."contentVisibility"
  FROM "pages" p WHERE po."pageId" = p."id"
    AND (CASE p."contentVisibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END)
      > (CASE po."visibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END);
UPDATE "posts" po SET "visibility" = u."contentVisibility"
  FROM "users" u WHERE po."pageId" IS NULL AND po."eventId" IS NULL AND po."userId" = u."id"
    AND (CASE u."contentVisibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END)
      > (CASE po."visibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END);
UPDATE "posts" po SET "visibility" = e."visibility"
  FROM "events" e WHERE po."eventId" = e."id"
    AND (CASE e."visibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END)
      > (CASE po."visibility" WHEN 'LISTED' THEN 0 WHEN 'UNLISTED' THEN 1 WHEN 'PRIVATE' THEN 2 END);
