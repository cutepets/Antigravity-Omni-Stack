ALTER TABLE "system_configs"
ALTER COLUMN "allowMultiPayment" SET DEFAULT true;

UPDATE "system_configs"
SET "allowMultiPayment" = true,
    "updatedAt" = NOW()
WHERE COALESCE("allowMultiPayment", false) = false;
