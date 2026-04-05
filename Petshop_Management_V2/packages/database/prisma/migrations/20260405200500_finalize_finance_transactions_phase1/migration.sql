ALTER TABLE "transactions"
ALTER COLUMN "source" SET DEFAULT 'OTHER';

UPDATE "transactions"
SET
  "source" = CASE
    WHEN "source" = 'ORDER' THEN 'ORDER_PAYMENT'
    WHEN "orderId" IS NOT NULL AND ("source" IS NULL OR "source" IN ('', 'MANUAL')) THEN 'ORDER_PAYMENT'
    WHEN "source" IS NULL OR "source" = '' THEN 'OTHER'
    ELSE "source"
  END;

UPDATE "transactions" AS t
SET
  "refType" = COALESCE(t."refType", CASE WHEN t."orderId" IS NOT NULL THEN 'ORDER' ELSE 'MANUAL' END),
  "refId" = COALESCE(t."refId", t."orderId"),
  "refNumber" = COALESCE(t."refNumber", o."orderNumber"),
  "branchId" = COALESCE(t."branchId", o."branchId"),
  "branchName" = COALESCE(t."branchName", b."name"),
  "payerId" = COALESCE(t."payerId", o."customerId"),
  "payerName" = COALESCE(t."payerName", o."customerName"),
  "isManual" = CASE
    WHEN COALESCE(t."source", 'OTHER') = 'MANUAL' THEN true
    ELSE false
  END
FROM "orders" AS o
LEFT JOIN "branches" AS b ON b."id" = o."branchId"
WHERE t."orderId" = o."id";

UPDATE "transactions"
SET
  "refType" = COALESCE("refType", 'MANUAL'),
  "isManual" = CASE
    WHEN COALESCE("source", 'OTHER') = 'MANUAL' THEN true
    ELSE "isManual"
  END
WHERE "orderId" IS NULL;

CREATE INDEX "transactions_staffId_idx" ON "transactions"("staffId");
