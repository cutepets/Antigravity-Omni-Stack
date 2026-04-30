-- Promotions module: deployable as disabled module by default, safe to enable from settings.

DO $$ BEGIN
  CREATE TYPE "PromotionType" AS ENUM ('DISCOUNT', 'BUY_X_GET_Y', 'VOUCHER', 'BIRTHDAY', 'AUTO_VOUCHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromotionVoucherStatus" AS ENUM ('ACTIVE', 'LOCKED', 'REDEEMED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "manualDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promotionDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promotionSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "promotionPreviewToken" TEXT;

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "promotionDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promotionSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "promotionRedemptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "isPromotionGift" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "promotions" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PromotionType" NOT NULL,
  "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "branchIds" JSONB,
  "customerGroupIds" JSONB,
  "conditions" JSONB,
  "reward" JSONB NOT NULL,
  "allowStacking" BOOLEAN NOT NULL DEFAULT false,
  "usageLimit" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "budgetLimit" DOUBLE PRECISION,
  "budgetUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "activatedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_conditions" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotion_conditions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_rewards" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotion_rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_schedules" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "months" JSONB,
  "monthDays" JSONB,
  "weekdays" JSONB,
  "timeRanges" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotion_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_voucher_batches" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "usageLimitPerCode" INTEGER NOT NULL DEFAULT 1,
  "customerId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotion_voucher_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_voucher_codes" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "batchId" TEXT,
  "code" TEXT NOT NULL,
  "status" "PromotionVoucherStatus" NOT NULL DEFAULT 'ACTIVE',
  "customerId" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "usageLimit" INTEGER NOT NULL DEFAULT 1,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "lastRedeemedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotion_voucher_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_redemptions" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "voucherCodeId" TEXT,
  "orderId" TEXT,
  "orderNumber" TEXT,
  "customerId" TEXT,
  "branchId" TEXT,
  "staffId" TEXT,
  "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "giftValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ORDER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotion_assets" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT,
  "imageUrl" TEXT NOT NULL,
  "templateKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotion_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promotions_code_key" ON "promotions"("code");
CREATE INDEX IF NOT EXISTS "promotions_status_idx" ON "promotions"("status");
CREATE INDEX IF NOT EXISTS "promotions_type_idx" ON "promotions"("type");
CREATE INDEX IF NOT EXISTS "promotions_startsAt_idx" ON "promotions"("startsAt");
CREATE INDEX IF NOT EXISTS "promotions_endsAt_idx" ON "promotions"("endsAt");
CREATE INDEX IF NOT EXISTS "promotion_conditions_promotionId_idx" ON "promotion_conditions"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_conditions_kind_idx" ON "promotion_conditions"("kind");
CREATE INDEX IF NOT EXISTS "promotion_rewards_promotionId_idx" ON "promotion_rewards"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_rewards_kind_idx" ON "promotion_rewards"("kind");
CREATE INDEX IF NOT EXISTS "promotion_schedules_promotionId_idx" ON "promotion_schedules"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_voucher_batches_promotionId_idx" ON "promotion_voucher_batches"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_voucher_batches_customerId_idx" ON "promotion_voucher_batches"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "promotion_voucher_codes_code_key" ON "promotion_voucher_codes"("code");
CREATE INDEX IF NOT EXISTS "promotion_voucher_codes_promotionId_idx" ON "promotion_voucher_codes"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_voucher_codes_batchId_idx" ON "promotion_voucher_codes"("batchId");
CREATE INDEX IF NOT EXISTS "promotion_voucher_codes_customerId_idx" ON "promotion_voucher_codes"("customerId");
CREATE INDEX IF NOT EXISTS "promotion_voucher_codes_status_idx" ON "promotion_voucher_codes"("status");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_promotionId_idx" ON "promotion_redemptions"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_voucherCodeId_idx" ON "promotion_redemptions"("voucherCodeId");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_orderId_idx" ON "promotion_redemptions"("orderId");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_customerId_idx" ON "promotion_redemptions"("customerId");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_branchId_idx" ON "promotion_redemptions"("branchId");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_staffId_idx" ON "promotion_redemptions"("staffId");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_createdAt_idx" ON "promotion_redemptions"("createdAt");
CREATE INDEX IF NOT EXISTS "promotion_assets_promotionId_idx" ON "promotion_assets"("promotionId");
CREATE INDEX IF NOT EXISTS "promotion_assets_kind_idx" ON "promotion_assets"("kind");
CREATE INDEX IF NOT EXISTS "promotion_assets_isActive_idx" ON "promotion_assets"("isActive");
CREATE INDEX IF NOT EXISTS "order_items_promotionRedemptionId_idx" ON "order_items"("promotionRedemptionId");

ALTER TABLE "promotion_schedules" DROP CONSTRAINT IF EXISTS "promotion_schedules_promotionId_fkey";
ALTER TABLE "promotion_schedules" ADD CONSTRAINT "promotion_schedules_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_voucher_batches" DROP CONSTRAINT IF EXISTS "promotion_voucher_batches_promotionId_fkey";
ALTER TABLE "promotion_voucher_batches" ADD CONSTRAINT "promotion_voucher_batches_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_voucher_codes" DROP CONSTRAINT IF EXISTS "promotion_voucher_codes_promotionId_fkey";
ALTER TABLE "promotion_voucher_codes" ADD CONSTRAINT "promotion_voucher_codes_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_voucher_codes" DROP CONSTRAINT IF EXISTS "promotion_voucher_codes_batchId_fkey";
ALTER TABLE "promotion_voucher_codes" ADD CONSTRAINT "promotion_voucher_codes_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "promotion_voucher_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promotion_redemptions" DROP CONSTRAINT IF EXISTS "promotion_redemptions_promotionId_fkey";
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_redemptions" DROP CONSTRAINT IF EXISTS "promotion_redemptions_voucherCodeId_fkey";
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_voucherCodeId_fkey" FOREIGN KEY ("voucherCodeId") REFERENCES "promotion_voucher_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promotion_assets" DROP CONSTRAINT IF EXISTS "promotion_assets_promotionId_fkey";
ALTER TABLE "promotion_assets" ADD CONSTRAINT "promotion_assets_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "module_configs" ("id", "key", "displayName", "description", "isActive", "isCore", "version", "icon", "sortOrder", "createdAt", "updatedAt")
VALUES ('module-promotions', 'promotions', 'Khuyến mãi', 'Quản lý chương trình khuyến mãi, voucher và mua tặng trong POS/order.', false, false, '1.0.0', 'BadgePercent', 55, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
