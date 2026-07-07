-- Migration: backfill_child_post_page_id
--
-- Replies (child posts with parentPostId) must share their parent's pageId (INV-3).
-- Historic replies to page-hosted posts were stored with pageId NULL, which also made
-- the visibility cascade miss them: a page flipped PRIVATE left the reply LISTED and
-- publicly served. Sync pageId to the parent, then re-derive the reply's
-- contentVisibility from the parent — a reply's correct visibility is its parent's
-- stored value (mirrors resolveParentVisibility). Idempotent: the IS DISTINCT FROM / <>
-- guards make re-runs no-ops, and healthy data matches 0 rows.

-- 1. Reply pageId := parent's pageId.
UPDATE "posts" c
SET "pageId" = p."pageId"
FROM "posts" p
WHERE c."parentPostId" = p."id"
  AND c."pageId" IS DISTINCT FROM p."pageId";

-- 2. Reply contentVisibility := parent's contentVisibility. Rows corrected above were
--    unreachable by past cascades, so their stored visibility is untrustworthy.
UPDATE "posts" c
SET "contentVisibility" = p."contentVisibility"
FROM "posts" p
WHERE c."parentPostId" = p."id"
  AND c."contentVisibility" <> p."contentVisibility";
