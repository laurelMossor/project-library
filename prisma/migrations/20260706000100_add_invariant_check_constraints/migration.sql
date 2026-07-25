-- Migration: add_invariant_check_constraints
--
-- Adds the exactly-one / XOR / lowercase DB CHECK constraints that several schema.prisma
-- comments long *claimed* existed but were never migrated. Until now these invariants held
-- only by caller discipline (see docs/audits/schema-invariant-findings-2026-07-06.md).
--
-- The comment in 20260628000000_add_access_requests ("mirrors the Follow model's hand-added
-- CHECKs") was aspirational — the Follow CHECKs it referenced never existed and are created
-- here for the first time, alongside the rest of the polymorphic-XOR family.
--
-- Each ADD CONSTRAINT is preceded by defensive cleanup so the migration succeeds on real data.
-- Every cleanup is a no-op on healthy rows. ADD CONSTRAINT ... CHECK takes an ACCESS EXCLUSIVE
-- lock and scans the table; tables are small at this stage. If that changes, split into
-- ADD CONSTRAINT ... NOT VALID + VALIDATE CONSTRAINT.
--
-- PRE-DEPLOY PREFLIGHT (run read-only against prod before releasing this migration):
--   SELECT handle FROM handles WHERE handle <> lower(handle);
-- For each result, check for a case-insensitive twin. If any exists, the handles cleanup below
-- will deliberately fail this migration mid-deploy (see that section) — resolve the collisions
-- by hand first. Zero rows returned → this migration applies cleanly.

-- ── posts: an event update XOR a reply, never both (INV-1) ──
-- Cleanup: a row with both is a bug/exploit artifact; keep the reply edge (threading is
-- user-visible) and drop the event link. Expected 0 rows.
UPDATE "posts" SET "eventId" = NULL WHERE "parentPostId" IS NOT NULL AND "eventId" IS NOT NULL;
ALTER TABLE "posts" ADD CONSTRAINT "posts_parent_xor_event"
    CHECK ("parentPostId" IS NULL OR "eventId" IS NULL);

-- ── follows: exactly one follower AND exactly one followee (INV-4) ──
-- Cleanup: a malformed edge has no recoverable intent — delete. Expected 0 rows.
DELETE FROM "follows" WHERE ("followerId" IS NOT NULL)::int + ("followerPageId" IS NOT NULL)::int <> 1;
DELETE FROM "follows" WHERE ("followingUserId" IS NOT NULL)::int + ("followingPageId" IS NOT NULL)::int <> 1;
ALTER TABLE "follows" ADD CONSTRAINT "follows_one_follower"
    CHECK (("followerId" IS NOT NULL)::int + ("followerPageId" IS NOT NULL)::int = 1);
ALTER TABLE "follows" ADD CONSTRAINT "follows_one_followee"
    CHECK (("followingUserId" IS NOT NULL)::int + ("followingPageId" IS NOT NULL)::int = 1);

-- ── conversation_participants: exactly one of userId/pageId (INV-5) ──
-- Cleanup: both-null is meaningless; both-set cannot be attributed — delete either. Expected 0 rows.
DELETE FROM "conversation_participants" WHERE ("userId" IS NOT NULL)::int + ("pageId" IS NOT NULL)::int <> 1;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_one_owner"
    CHECK (("userId" IS NOT NULL)::int + ("pageId" IS NOT NULL)::int = 1);

-- ── profile_elements: exactly one owner (INV-6 backstop) ──
-- Cleanup: both-set rows are the INV-6 exploit shape (a user element that had pageId injected)
-- — restore user ownership by nulling pageId; orphans (both null) are unreachable — delete.
UPDATE "profile_elements" SET "pageId" = NULL WHERE "userId" IS NOT NULL AND "pageId" IS NOT NULL;
DELETE FROM "profile_elements" WHERE "userId" IS NULL AND "pageId" IS NULL;
ALTER TABLE "profile_elements" ADD CONSTRAINT "profile_elements_one_owner"
    CHECK (("userId" IS NOT NULL)::int + ("pageId" IS NOT NULL)::int = 1);

-- ── handles: exactly one owner + always lowercase (INV-7) ──
-- Cleanup: orphan rows (no owner) are dead URLs — delete; both-set keeps the user (mirrors
-- profile_elements). Lowercase only where doing so does NOT collide with an existing row; a
-- genuine collision must fail this migration loudly rather than silently drop someone's URL.
-- Two collision shapes, both abort the transaction (full rollback, no partial state):
--   * "Foo" alongside an existing "foo": the NOT EXISTS guard skips "Foo"; the leftover
--     mixed-case row then fails the handles_lowercase CHECK below.
--   * "Foo" and "FOO" with no "foo": the case-sensitive NOT EXISTS clears both, the UPDATE
--     tries to set both to "foo", and the second hits a unique violation on handles_handle_key
--     — i.e. this shape aborts at the UPDATE, not at the CHECK.
-- Run the pre-deploy preflight in the header to detect either shape before releasing.
DELETE FROM "handles" WHERE "userId" IS NULL AND "pageId" IS NULL;
UPDATE "handles" SET "pageId" = NULL WHERE "userId" IS NOT NULL AND "pageId" IS NOT NULL;
UPDATE "handles" h
SET "handle" = lower(h."handle")
WHERE h."handle" <> lower(h."handle")
  AND NOT EXISTS (
    SELECT 1 FROM "handles" x WHERE x."handle" = lower(h."handle") AND x."id" <> h."id"
  );
ALTER TABLE "handles" ADD CONSTRAINT "handles_one_owner"
    CHECK (("userId" IS NOT NULL)::int + ("pageId" IS NOT NULL)::int = 1);
ALTER TABLE "handles" ADD CONSTRAINT "handles_lowercase"
    CHECK ("handle" = lower("handle"));
