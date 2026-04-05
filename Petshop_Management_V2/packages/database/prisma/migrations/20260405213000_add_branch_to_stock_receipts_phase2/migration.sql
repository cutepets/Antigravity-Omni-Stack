ALTER TABLE "stock_receipts"
ADD COLUMN "branchId" TEXT;

CREATE INDEX "stock_receipts_branchId_idx" ON "stock_receipts"("branchId");

ALTER TABLE "stock_receipts"
ADD CONSTRAINT "stock_receipts_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
