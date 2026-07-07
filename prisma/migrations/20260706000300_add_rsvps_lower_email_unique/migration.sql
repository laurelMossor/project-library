-- Migration: add_rsvps_lower_email_unique
--
-- createOrUpdateRsvp lowercases email on every write and upserts on the Prisma compound
-- unique (eventId, email), so case-variant duplicates ("Foo@x.com" vs "foo@x.com") cannot
-- arise through the app today. This functional unique index is a structural backstop for any
-- future/raw writer. It SUPPLEMENTS the existing rsvps_eventId_email_key (which the Prisma
-- upsert targets and cannot be dropped — Prisma can't upsert on an expression index).

-- Dedupe any pre-existing case-variant rows, keeping the most recently updated per
-- (eventId, lower(email)). No-op on healthy data.
DELETE FROM "rsvps" r
USING "rsvps" k
WHERE r."eventId" = k."eventId"
  AND lower(r."email") = lower(k."email")
  AND r."id" <> k."id"
  AND (r."updatedAt" < k."updatedAt"
       OR (r."updatedAt" = k."updatedAt" AND r."id" < k."id"));

CREATE UNIQUE INDEX "rsvps_eventId_lower_email_key" ON "rsvps" ("eventId", lower("email"));
