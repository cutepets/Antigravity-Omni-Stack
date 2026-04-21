-- Create enums required by stock count tables
DO $$ BEGIN
  CREATE TYPE "StockCountSessionStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockCountShift" AS ENUM (
    'MON_A', 'MON_B', 'MON_C', 'MON_D',
    'TUE_A', 'TUE_B', 'TUE_C', 'TUE_D',
    'WED_A', 'WED_B', 'WED_C', 'WED_D',
    'THU_A', 'THU_B', 'THU_C', 'THU_D',
    'FRI_A', 'FRI_B', 'FRI_C', 'FRI_D',
    'SAT_A', 'SAT_B', 'SAT_C', 'SAT_D'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StockCountCategory" AS ENUM (
    'PRODUCT',
    'SERVICE',
    'RAW_MATERIAL',
    'PACKAGING'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "stock_count_sessions" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "StockCountSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "totalProducts" INTEGER NOT NULL DEFAULT 0,
  "countedProducts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  CONSTRAINT "stock_count_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_count_shift_sessions" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "shift" "StockCountShift" NOT NULL,
  "countDate" TIMESTAMP(3) NOT NULL,
  "status" "StockCountSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "countedBy" TEXT,
  "notes" TEXT,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "countedItems" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "stock_count_shift_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_count_items" (
  "id" TEXT NOT NULL,
  "shiftSessionId" TEXT NOT NULL,
  "productId" TEXT,
  "productVariantId" TEXT,
  "categoryId" "StockCountCategory" NOT NULL DEFAULT 'PRODUCT',
  "systemQuantity" INTEGER NOT NULL DEFAULT 0,
  "countedQuantity" INTEGER,
  "variance" INTEGER,
  "notes" TEXT,
  CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_sessions_branchId_fkey'
  ) THEN
    ALTER TABLE "stock_count_sessions"
      ADD CONSTRAINT "stock_count_sessions_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_sessions_createdBy_fkey'
  ) THEN
    ALTER TABLE "stock_count_sessions"
      ADD CONSTRAINT "stock_count_sessions_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_sessions_approvedBy_fkey'
  ) THEN
    ALTER TABLE "stock_count_sessions"
      ADD CONSTRAINT "stock_count_sessions_approvedBy_fkey"
      FOREIGN KEY ("approvedBy") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_shift_sessions_sessionId_fkey'
  ) THEN
    ALTER TABLE "stock_count_shift_sessions"
      ADD CONSTRAINT "stock_count_shift_sessions_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "stock_count_sessions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_shift_sessions_countedBy_fkey'
  ) THEN
    ALTER TABLE "stock_count_shift_sessions"
      ADD CONSTRAINT "stock_count_shift_sessions_countedBy_fkey"
      FOREIGN KEY ("countedBy") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_items_shiftSessionId_fkey'
  ) THEN
    ALTER TABLE "stock_count_items"
      ADD CONSTRAINT "stock_count_items_shiftSessionId_fkey"
      FOREIGN KEY ("shiftSessionId") REFERENCES "stock_count_shift_sessions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_items_productId_fkey'
  ) THEN
    ALTER TABLE "stock_count_items"
      ADD CONSTRAINT "stock_count_items_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_count_items_productVariantId_fkey'
  ) THEN
    ALTER TABLE "stock_count_items"
      ADD CONSTRAINT "stock_count_items_productVariantId_fkey"
      FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_count_sessions_branchId_weekNumber_year_key"
  ON "stock_count_sessions"("branchId", "weekNumber", "year");

CREATE INDEX IF NOT EXISTS "stock_count_sessions_branchId_idx"
  ON "stock_count_sessions"("branchId");

CREATE INDEX IF NOT EXISTS "stock_count_sessions_weekNumber_year_idx"
  ON "stock_count_sessions"("weekNumber", "year");

CREATE INDEX IF NOT EXISTS "stock_count_shift_sessions_sessionId_idx"
  ON "stock_count_shift_sessions"("sessionId");

CREATE INDEX IF NOT EXISTS "stock_count_shift_sessions_shift_idx"
  ON "stock_count_shift_sessions"("shift");

CREATE INDEX IF NOT EXISTS "stock_count_shift_sessions_countDate_idx"
  ON "stock_count_shift_sessions"("countDate");

CREATE INDEX IF NOT EXISTS "stock_count_items_shiftSessionId_idx"
  ON "stock_count_items"("shiftSessionId");

CREATE INDEX IF NOT EXISTS "stock_count_items_productId_idx"
  ON "stock_count_items"("productId");

CREATE INDEX IF NOT EXISTS "stock_count_items_productVariantId_idx"
  ON "stock_count_items"("productVariantId");
