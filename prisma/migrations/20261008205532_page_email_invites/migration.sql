-- AlterTable
ALTER TABLE "access_requests" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "page_email_invites" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "PermissionRole" NOT NULL,
    "note" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimedUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "page_email_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_email_invites_invitedById_createdAt_idx" ON "page_email_invites"("invitedById", "createdAt");

-- CreateIndex
CREATE INDEX "page_email_invites_email_idx" ON "page_email_invites"("email");

-- CreateIndex
CREATE INDEX "page_email_invites_pageId_idx" ON "page_email_invites"("pageId");

-- AddForeignKey
ALTER TABLE "page_email_invites" ADD CONSTRAINT "page_email_invites_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_email_invites" ADD CONSTRAINT "page_email_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
