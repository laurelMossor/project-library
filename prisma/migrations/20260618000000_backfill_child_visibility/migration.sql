-- Migration: backfill_child_visibility
--
-- The add_visibility_enum migration created posts.visibility and events.visibility
-- with DEFAULT 'PUBLIC' and NO inheritance from their parent. Because pages can
-- already be UNLISTED/PRIVATE (the old PageVisibility enum, and v04 backfilled some
-- pages to PRIVATE from org.isPublic), a non-public page's published posts/events
-- were left PUBLIC and could surface in Explore/feeds even though the page is gated.
--
-- This backfill makes every child inherit its parent's visibility. Idempotent
-- (re-running yields the same result). Events are finalized BEFORE posts so that
-- event-attached posts inherit the event's corrected visibility.

-- 1. Events hosted by a non-public page inherit the page's visibility.
UPDATE "events" e
SET "visibility" = pg."visibility"
FROM "pages" pg
WHERE e."pageId" = pg."id" AND pg."visibility" <> 'PUBLIC';

-- 2. Standalone events (no page) inherit their owner user's visibility.
UPDATE "events" e
SET "visibility" = u."visibility"
FROM "users" u
WHERE e."userId" = u."id" AND e."pageId" IS NULL AND u."visibility" <> 'PUBLIC';

-- 3. Posts on a non-public page inherit the page's visibility.
UPDATE "posts" p
SET "visibility" = pg."visibility"
FROM "pages" pg
WHERE p."pageId" = pg."id" AND pg."visibility" <> 'PUBLIC';

-- 4. Standalone user posts (no page, no event) inherit the owner user's visibility.
UPDATE "posts" p
SET "visibility" = u."visibility"
FROM "users" u
WHERE p."userId" = u."id"
  AND p."pageId" IS NULL
  AND p."eventId" IS NULL
  AND u."visibility" <> 'PUBLIC';

-- 5. Event-attached posts inherit their (now-corrected) event's visibility.
UPDATE "posts" p
SET "visibility" = e."visibility"
FROM "events" e
WHERE p."eventId" = e."id" AND e."visibility" <> 'PUBLIC';
