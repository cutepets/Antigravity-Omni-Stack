ALTER TABLE "products"
ADD COLUMN "groupCode" TEXT;

UPDATE "products"
SET "groupCode" = COALESCE(NULLIF("sku", ''), CONCAT('PRD-', "id"))
WHERE "groupCode" IS NULL;

CREATE UNIQUE INDEX "products_groupCode_key" ON "products"("groupCode");
CREATE INDEX "products_groupCode_idx" ON "products"("groupCode");
