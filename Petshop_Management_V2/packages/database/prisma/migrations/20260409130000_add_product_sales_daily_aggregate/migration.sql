ALTER TABLE "orders"
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TABLE "product_sales_daily" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "branchId" TEXT,
  "branchScope" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT,
  "salesKey" TEXT NOT NULL,
  "quantitySold" INTEGER NOT NULL DEFAULT 0,
  "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_sales_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_sales_daily_date_branchScope_salesKey_key"
ON "product_sales_daily"("date", "branchScope", "salesKey");

CREATE INDEX "product_sales_daily_branchId_date_idx"
ON "product_sales_daily"("branchId", "date");

CREATE INDEX "product_sales_daily_productId_date_idx"
ON "product_sales_daily"("productId", "date");

CREATE INDEX "product_sales_daily_productVariantId_date_idx"
ON "product_sales_daily"("productVariantId", "date");

CREATE INDEX "product_sales_daily_salesKey_date_idx"
ON "product_sales_daily"("salesKey", "date");

CREATE INDEX "orders_completedAt_idx"
ON "orders"("completedAt");

ALTER TABLE "product_sales_daily"
ADD CONSTRAINT "product_sales_daily_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "product_sales_daily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "product_sales_daily_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "orders"
SET "completedAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" = 'COMPLETED'
  AND "completedAt" IS NULL;

INSERT INTO "product_sales_daily" (
  "id",
  "date",
  "branchId",
  "branchScope",
  "productId",
  "productVariantId",
  "salesKey",
  "quantitySold",
  "revenue",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || oi."productId" || COALESCE(oi."productVariantId", 'base')),
  date_trunc('day', COALESCE(o."completedAt", o."createdAt")),
  o."branchId",
  COALESCE(o."branchId", 'UNASSIGNED'),
  oi."productId",
  oi."productVariantId",
  CASE
    WHEN oi."productVariantId" IS NOT NULL THEN 'variant:' || oi."productVariantId"
    ELSE 'product:' || oi."productId"
  END,
  SUM(oi."quantity")::integer,
  COALESCE(SUM(oi."subtotal"), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "order_items" oi
INNER JOIN "orders" o ON o."id" = oi."orderId"
WHERE o."status" = 'COMPLETED'
  AND oi."productId" IS NOT NULL
GROUP BY
  date_trunc('day', COALESCE(o."completedAt", o."createdAt")),
  o."branchId",
  oi."productId",
  oi."productVariantId"
ON CONFLICT ("date", "branchScope", "salesKey")
DO UPDATE SET
  "quantitySold" = EXCLUDED."quantitySold",
  "revenue" = EXCLUDED."revenue",
  "updatedAt" = CURRENT_TIMESTAMP;
