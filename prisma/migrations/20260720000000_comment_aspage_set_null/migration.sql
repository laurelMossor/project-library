-- comments.asPageId: deleting a Page should demote the comment to author-attributed,
-- not delete the human author's words. Cascade -> Set Null.
ALTER TABLE "comments" DROP CONSTRAINT "comments_asPageId_fkey";
ALTER TABLE "comments" ADD CONSTRAINT "comments_asPageId_fkey"
  FOREIGN KEY ("asPageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
