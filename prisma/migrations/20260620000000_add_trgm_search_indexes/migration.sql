-- Profile search (searchProfiles in src/lib/utils/server/search.ts) filters with
-- Prisma `contains` + `mode: insensitive`, i.e. `ILIKE '%query%'`. A leading
-- wildcard can't use a btree index, so every keystroke was a sequential scan of
-- users + pages. pg_trgm GIN indexes (gin_trgm_ops) accelerate LIKE/ILIKE,
-- including the leading-wildcard case.
--
-- Authored by hand (not via `prisma migrate dev`) because the trigram extension
-- and `USING gin (... gin_trgm_ops)` indexes aren't expressible in schema.prisma
-- without the postgresqlExtensions preview feature. These objects live only in
-- migration history; they do not appear in the Prisma schema and do not cause
-- migrate drift.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Columns matched by searchProfiles() — users.handle/displayName/firstName/lastName
CREATE INDEX IF NOT EXISTS "users_handle_trgm_idx" ON "users" USING gin ("handle" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_displayName_trgm_idx" ON "users" USING gin ("displayName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_firstName_trgm_idx" ON "users" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_lastName_trgm_idx" ON "users" USING gin ("lastName" gin_trgm_ops);

-- pages.handle/name
CREATE INDEX IF NOT EXISTS "pages_handle_trgm_idx" ON "pages" USING gin ("handle" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "pages_name_trgm_idx" ON "pages" USING gin ("name" gin_trgm_ops);
