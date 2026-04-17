-- AddColumn: isTemp and tempLabel to order_items for temporary product support
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "isTemp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "tempLabel" TEXT;
