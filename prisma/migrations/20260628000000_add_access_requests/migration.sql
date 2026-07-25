-- CreateEnum
CREATE TYPE "AccessRequestKind" AS ENUM ('FOLLOW', 'JOIN');

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "kind" "AccessRequestKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requesterId" TEXT,
    "requesterPageId" TEXT,
    "targetUserId" TEXT,
    "targetPageId" TEXT,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_requesterId_targetUserId_kind_key" ON "access_requests"("requesterId", "targetUserId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_requesterId_targetPageId_kind_key" ON "access_requests"("requesterId", "targetPageId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_requesterPageId_targetUserId_kind_key" ON "access_requests"("requesterPageId", "targetUserId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_requesterPageId_targetPageId_kind_key" ON "access_requests"("requesterPageId", "targetPageId", "kind");

-- CreateIndex
CREATE INDEX "access_requests_targetPageId_idx" ON "access_requests"("targetPageId");

-- CreateIndex
CREATE INDEX "access_requests_targetUserId_idx" ON "access_requests"("targetUserId");

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requesterPageId_fkey" FOREIGN KEY ("requesterPageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly-one invariants (mirrors the Follow model's hand-added CHECKs):
-- exactly one requester, and exactly one target.
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_one_requester"
    CHECK (("requesterId" IS NOT NULL)::int + ("requesterPageId" IS NOT NULL)::int = 1);

ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_one_target"
    CHECK (("targetUserId" IS NOT NULL)::int + ("targetPageId" IS NOT NULL)::int = 1);
