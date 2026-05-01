DROP INDEX IF EXISTS "customers_supplierCode_key";

ALTER TABLE "customers"
  DROP COLUMN IF EXISTS "isSupplier",
  DROP COLUMN IF EXISTS "supplierCode";
