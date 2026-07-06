-- Phase 2 (contract): drop the deprecated single `visibility` column from users/pages. It was
-- kept through the split/rename (expand-then-contract) while code migrated to the two-field model
-- (profileVisibility + contentVisibility); nothing reads it anymore, so it can be removed.
ALTER TABLE "users" DROP COLUMN "visibility";
ALTER TABLE "pages" DROP COLUMN "visibility";
