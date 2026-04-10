-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'BANK', 'EWALLET', 'CARD');

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minAmount" DOUBLE PRECISION,
    "maxAmount" DOUBLE PRECISION,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "branchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountHolder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE INDEX "payment_methods_type_isActive_sortOrder_idx" ON "payment_methods"("type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "payment_methods_isDefault_isActive_idx" ON "payment_methods"("isDefault", "isActive");

-- Seed fixed cash payment method
INSERT INTO "payment_methods" (
  "id",
  "code",
  "name",
  "type",
  "isSystem",
  "isDefault",
  "isActive",
  "sortOrder",
  "weekdays",
  "branchIds",
  "createdAt",
  "updatedAt"
)
SELECT
  'pm_sys_cash',
  'SYS_CASH',
  'Tien mat',
  'CASH'::"PaymentMethodType",
  true,
  CASE
    WHEN EXISTS (SELECT 1 FROM "bank_transfer_accounts" WHERE "isDefault" = true) THEN false
    ELSE true
  END,
  true,
  0,
  ARRAY[]::INTEGER[],
  ARRAY[]::TEXT[],
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "payment_methods" WHERE "code" = 'SYS_CASH'
);

-- Migrate existing bank transfer accounts into unified payment methods
INSERT INTO "payment_methods" (
  "id",
  "name",
  "type",
  "isSystem",
  "isDefault",
  "isActive",
  "sortOrder",
  "weekdays",
  "branchIds",
  "notes",
  "bankName",
  "accountNumber",
  "accountHolder",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "name",
  'BANK'::"PaymentMethodType",
  false,
  "isDefault",
  "isActive",
  ROW_NUMBER() OVER (ORDER BY "isDefault" DESC, "createdAt" ASC) + 10,
  ARRAY[]::INTEGER[],
  ARRAY[]::TEXT[],
  "notes",
  "bankName",
  "accountNumber",
  "accountHolder",
  "createdAt",
  "updatedAt"
FROM "bank_transfer_accounts"
WHERE NOT EXISTS (
  SELECT 1 FROM "payment_methods" pm WHERE pm."id" = "bank_transfer_accounts"."id"
);
