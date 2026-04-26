-- PR2: URL flattening
--
-- 1. Create the cross-entity Handle namespace table. Routing
--    (`/[handle]`) does a single indexed lookup against this table
--    and dispatches to the linked User or Page.
-- 2. Rename `users.username` → `users.handle` (true rename — preserves
--    data and the underlying unique index, just renames both).
-- 3. Rename `pages.slug` → `pages.handle` (same).
--
-- `users.handle` and `pages.handle` keep their own per-table @unique
-- constraints (entity-scoped). The new `handles` table is the
-- cross-entity uniqueness layer (a user `foo` and a page `foo` can no
-- longer coexist).

-- 1. handles table
CREATE TABLE "handles" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "userId" TEXT,
    "pageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "handles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "handles_handle_key" ON "handles"("handle");
CREATE UNIQUE INDEX "handles_userId_key" ON "handles"("userId");
CREATE UNIQUE INDEX "handles_pageId_key" ON "handles"("pageId");

ALTER TABLE "handles"
    ADD CONSTRAINT "handles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "handles"
    ADD CONSTRAINT "handles_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "pages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Rename users.username → users.handle
ALTER TABLE "users" RENAME COLUMN "username" TO "handle";
ALTER INDEX "users_username_key" RENAME TO "users_handle_key";

-- 3. Rename pages.slug → pages.handle
ALTER TABLE "pages" RENAME COLUMN "slug" TO "handle";
ALTER INDEX "pages_slug_key" RENAME TO "pages_handle_key";
