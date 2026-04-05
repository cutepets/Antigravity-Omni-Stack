ALTER TABLE "transactions"
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "branchId" TEXT,
ADD COLUMN "branchName" TEXT,
ADD COLUMN "refType" TEXT,
ADD COLUMN "refId" TEXT,
ADD COLUMN "refNumber" TEXT,
ADD COLUMN "payerId" TEXT,
ADD COLUMN "payerName" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "tags" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN "isManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "transactions"
SET
  "source" = CASE
    WHEN "orderId" IS NOT NULL THEN 'ORDER_PAYMENT'
    ELSE 'MANUAL'
  END,
  "isManual" = CASE
    WHEN "orderId" IS NOT NULL THEN false
    ELSE true
  END,
  "refType" = CASE
    WHEN "orderId" IS NOT NULL THEN COALESCE("refType", 'ORDER')
    ELSE "refType"
  END,
  "refId" = CASE
    WHEN "orderId" IS NOT NULL THEN COALESCE("refId", "orderId")
    ELSE "refId"
  END;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "transactions_branchId_idx" ON "transactions"("branchId");
CREATE INDEX "transactions_paymentMethod_idx" ON "transactions"("paymentMethod");
CREATE INDEX "transactions_refType_idx" ON "transactions"("refType");
CREATE INDEX "transactions_refId_idx" ON "transactions"("refId");
CREATE INDEX "transactions_refNumber_idx" ON "transactions"("refNumber");
CREATE INDEX "transactions_source_idx" ON "transactions"("source");
