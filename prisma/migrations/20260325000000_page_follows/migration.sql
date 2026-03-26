-- AlterTable: make followerId optional and add followerPageId
ALTER TABLE "follows" ALTER COLUMN "followerId" DROP NOT NULL;
ALTER TABLE "follows" ADD COLUMN "followerPageId" TEXT;

-- CreateIndex
CREATE INDEX "follows_followerPageId_idx" ON "follows"("followerPageId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "follows_followerPageId_followingUserId_key" ON "follows"("followerPageId", "followingUserId");
CREATE UNIQUE INDEX "follows_followerPageId_followingPageId_key" ON "follows"("followerPageId", "followingPageId");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerPageId_fkey" FOREIGN KEY ("followerPageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
