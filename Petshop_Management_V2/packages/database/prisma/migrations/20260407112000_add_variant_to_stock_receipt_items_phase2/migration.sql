ALTER TABLE "stock_receipt_items"
ADD COLUMN "productVariantId" TEXT;

CREATE INDEX "stock_receipt_items_productVariantId_idx"
ON "stock_receipt_items"("productVariantId");

ALTER TABLE "stock_receipt_items"
ADD CONSTRAINT "stock_receipt_items_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
