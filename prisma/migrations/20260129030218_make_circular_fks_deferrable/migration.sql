-- Make circular foreign key constraints deferrable to allow atomic User+Owner creation
-- This enables inserting both records in a transaction without FK constraint violations

-- Drop and recreate owners_userId_fkey as DEFERRABLE INITIALLY DEFERRED
ALTER TABLE "owners" DROP CONSTRAINT "owners_userId_fkey";
ALTER TABLE "owners" ADD CONSTRAINT "owners_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE 
  DEFERRABLE INITIALLY DEFERRED;

-- Drop and recreate users_ownerId_fkey as DEFERRABLE INITIALLY DEFERRED  
ALTER TABLE "users" DROP CONSTRAINT "users_ownerId_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_ownerId_fkey" 
  FOREIGN KEY ("ownerId") REFERENCES "owners"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE 
  DEFERRABLE INITIALLY DEFERRED;