ALTER TABLE "stock_transactions"
ADD COLUMN "product_variant_id" TEXT;

CREATE INDEX "stock_transactions_product_variant_id_idx"
ON "stock_transactions"("product_variant_id");

ALTER TABLE "stock_transactions"
ADD CONSTRAINT "stock_transactions_product_variant_id_fkey"
FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
