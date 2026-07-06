-- Condense to a single clear content-visibility concept: rename the per-item
-- Post/Event `visibility` column to `contentVisibility`, matching the profile-wide
-- default of the same name on users/pages. All four models now expose
-- `contentVisibility` = "where this content (or content by default) surfaces".
-- The column keeps its ContentVisibility type + LISTED default (preserved by RENAME).

ALTER TABLE "posts"  RENAME COLUMN "visibility" TO "contentVisibility";
ALTER TABLE "events" RENAME COLUMN "visibility" TO "contentVisibility";
