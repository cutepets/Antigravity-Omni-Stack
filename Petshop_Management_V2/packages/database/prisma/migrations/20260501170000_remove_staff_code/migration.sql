DROP INDEX IF EXISTS "users_staffCode_key";

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "staffCode";
