-- AlterTable
-- Session epoch for JWT invalidation. Bumped on password reset so existing
-- sessions are rejected by the NextAuth session callback. Existing rows default
-- to 0 (matching tokens that carry no version stamp) so no one is logged out by
-- this migration.
ALTER TABLE "users" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;
