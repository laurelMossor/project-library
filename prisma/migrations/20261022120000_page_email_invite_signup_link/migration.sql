-- AlterTable
ALTER TABLE "page_email_invites" ADD COLUMN     "joinedFromInvite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupInviteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "page_email_invites_signupInviteId_key" ON "page_email_invites"("signupInviteId");

-- AddForeignKey
ALTER TABLE "page_email_invites" ADD CONSTRAINT "page_email_invites_signupInviteId_fkey" FOREIGN KEY ("signupInviteId") REFERENCES "signup_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill 1: link each existing row to the signup link minted for it. invitePageMembersByEmail
-- writes the row, then mints the link for the same address in the same request, so the link is the
-- first one for that address created within a few seconds after the row.
UPDATE "page_email_invites" e
SET "signupInviteId" = s.id
FROM (
  SELECT DISTINCT ON (e2.id) e2.id AS invite_id, s2.id
  FROM "page_email_invites" e2
  JOIN "signup_invites" s2
    ON s2.email = e2.email
   AND s2."createdAt" >= e2."createdAt"
   AND s2."createdAt" < e2."createdAt" + INTERVAL '10 seconds'
  ORDER BY e2.id, s2."createdAt"
) s
WHERE e.id = s.invite_id;

-- Backfill 2: a claimed row whose person signed up through a link this page sent to that address.
UPDATE "page_email_invites" e
SET "joinedFromInvite" = true
WHERE e."claimedUserId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "page_email_invites" sent
    JOIN "signup_invites" s ON s.id = sent."signupInviteId"
    WHERE sent."pageId" = e."pageId"
      AND sent.email = e.email
      AND s."usedAt" IS NOT NULL
  );
