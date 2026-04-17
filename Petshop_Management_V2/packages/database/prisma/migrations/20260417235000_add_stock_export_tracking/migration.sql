-- Add stock export tracking fields to Order (order-level)
ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "stockExportedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "stockExportedBy" TEXT;

-- Add stock export tracking fields to order_items (item-level, Phuong an B)
ALTER TABLE "order_items"
ADD COLUMN IF NOT EXISTS "stockExportedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "stockExportedBy" TEXT;

-- Add enum value ITEM_SWAPPED to OrderAction if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ITEM_SWAPPED'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderAction')
  ) THEN
    ALTER TYPE "OrderAction" ADD VALUE 'ITEM_SWAPPED';
  END IF;
END$$;
