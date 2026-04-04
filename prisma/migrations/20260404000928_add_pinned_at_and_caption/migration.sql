-- AlterTable
ALTER TABLE "images" ADD COLUMN     "caption" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "pinnedAt" TIMESTAMP(3);
