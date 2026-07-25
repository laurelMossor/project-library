-- Migration: drop_content_visibility_defaults
--
-- contentVisibility was `@default(LISTED)` on users/pages/posts/events. That default
-- silently absorbed any create path that forgot to derive visibility — content was born
-- LISTED (public) instead of failing loudly. That masking is exactly what produced the
-- 2026-07-03 "born LISTED" finding. Dropping the default makes the column required in the
-- generated Prisma types, so the compiler flags any create site that omits it. Every live
-- create path already sets it explicitly (verified).

ALTER TABLE "users"  ALTER COLUMN "contentVisibility" DROP DEFAULT;
ALTER TABLE "pages"  ALTER COLUMN "contentVisibility" DROP DEFAULT;
ALTER TABLE "posts"  ALTER COLUMN "contentVisibility" DROP DEFAULT;
ALTER TABLE "events" ALTER COLUMN "contentVisibility" DROP DEFAULT;
