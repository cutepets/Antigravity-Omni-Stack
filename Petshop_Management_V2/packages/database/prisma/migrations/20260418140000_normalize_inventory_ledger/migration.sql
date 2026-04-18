DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'stock_transactions'
      AND column_name = 'productVariantId'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'stock_transactions'
        AND column_name = 'product_variant_id'
    ) THEN
      ALTER TABLE "stock_transactions" RENAME COLUMN "product_variant_id" TO "productVariantId";
    ELSE
      ALTER TABLE "stock_transactions" ADD COLUMN "productVariantId" TEXT;
    END IF;
  END IF;
END $$;

ALTER TABLE "stock_transactions"
ADD COLUMN IF NOT EXISTS "branchId" TEXT,
ADD COLUMN IF NOT EXISTS "staffId" TEXT,
ADD COLUMN IF NOT EXISTS "referenceType" TEXT,
ADD COLUMN IF NOT EXISTS "sourceProductVariantId" TEXT,
ADD COLUMN IF NOT EXISTS "actionQuantity" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sourceQuantity" INTEGER,
ADD COLUMN IF NOT EXISTS "conversionRate" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "stock_transactions_productVariantId_idx"
ON "stock_transactions"("productVariantId");

CREATE INDEX IF NOT EXISTS "stock_transactions_branchId_idx"
ON "stock_transactions"("branchId");

CREATE INDEX IF NOT EXISTS "stock_transactions_sourceProductVariantId_idx"
ON "stock_transactions"("sourceProductVariantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_transactions_productVariantId_fkey'
  ) THEN
    ALTER TABLE "stock_transactions"
    ADD CONSTRAINT "stock_transactions_productVariantId_fkey"
    FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_transactions_branchId_fkey'
  ) THEN
    ALTER TABLE "stock_transactions"
    ADD CONSTRAINT "stock_transactions_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_transactions_staffId_fkey'
  ) THEN
    ALTER TABLE "stock_transactions"
    ADD CONSTRAINT "stock_transactions_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_transactions_sourceProductVariantId_fkey'
  ) THEN
    ALTER TABLE "stock_transactions"
    ADD CONSTRAINT "stock_transactions_sourceProductVariantId_fkey"
    FOREIGN KEY ("sourceProductVariantId") REFERENCES "product_variants"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "stock_transactions" st
SET "branchId" = o."branchId"
FROM "orders" o
WHERE st."referenceType" = 'ORDER'
  AND st."referenceId" = o."id"
  AND st."branchId" IS NULL
  AND o."branchId" IS NOT NULL;

DO $$
DECLARE
  unresolved_count INTEGER;
BEGIN
  WITH conversion_variants AS (
    SELECT
      pv."id",
      pv."productId",
      COALESCE(NULLIF(pv."variantLabel", ''), '__base__') AS group_key,
      COALESCE(
        NULLIF((pv."conversions"::jsonb ->> 'rate'), '')::DOUBLE PRECISION,
        NULLIF((pv."conversions"::jsonb ->> 'conversionRate'), '')::DOUBLE PRECISION,
        NULLIF((pv."conversions"::jsonb ->> 'mainQty'), '')::DOUBLE PRECISION
      ) AS rate
    FROM "product_variants" pv
    WHERE pv."conversions" IS NOT NULL
  ),
  source_candidates AS (
    SELECT
      cv."id" AS conversion_id,
      src."id" AS source_id,
      COUNT(src."id") OVER (PARTITION BY cv."id") AS source_count
    FROM conversion_variants cv
    LEFT JOIN "product_variants" src
      ON src."productId" = cv."productId"
     AND src."id" <> cv."id"
     AND src."conversions" IS NULL
     AND src."deletedAt" IS NULL
     AND COALESCE(NULLIF(src."variantLabel", ''), '__base__') = cv.group_key
  )
  SELECT COUNT(*)
  INTO unresolved_count
  FROM conversion_variants cv
  LEFT JOIN source_candidates sc ON sc.conversion_id = cv."id"
  WHERE cv.rate IS NULL
     OR cv.rate <= 0
     OR (cv.group_key <> '__base__' AND COALESCE(sc.source_count, 0) <> 1)
     OR COALESCE(sc.source_count, 0) > 1;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'Cannot normalize inventory ledger: % conversion variants cannot resolve exactly one source variant', unresolved_count;
  END IF;
END $$;

WITH conversion_map AS (
  SELECT
    cv."id" AS conversion_id,
    src."id" AS source_id,
    COALESCE(
      NULLIF((cv."conversions"::jsonb ->> 'rate'), '')::DOUBLE PRECISION,
      NULLIF((cv."conversions"::jsonb ->> 'conversionRate'), '')::DOUBLE PRECISION,
      NULLIF((cv."conversions"::jsonb ->> 'mainQty'), '')::DOUBLE PRECISION
    ) AS rate
  FROM "product_variants" cv
  LEFT JOIN "product_variants" src
    ON src."productId" = cv."productId"
   AND src."id" <> cv."id"
   AND src."conversions" IS NULL
   AND src."deletedAt" IS NULL
   AND COALESCE(NULLIF(src."variantLabel", ''), '__base__') = COALESCE(NULLIF(cv."variantLabel", ''), '__base__')
  WHERE cv."conversions" IS NOT NULL
)
UPDATE "stock_transactions" st
SET
  "sourceProductVariantId" = CASE
    WHEN st."productVariantId" IS NULL THEN NULL
    WHEN pv."conversions" IS NULL THEN st."productVariantId"
    ELSE cm.source_id
  END,
  "actionQuantity" = COALESCE(st."actionQuantity", st."quantity"::DOUBLE PRECISION),
  "sourceQuantity" = COALESCE(
    st."sourceQuantity",
    CASE
      WHEN st."productVariantId" IS NULL THEN st."quantity"
      WHEN pv."conversions" IS NULL THEN st."quantity"
      ELSE ROUND(st."quantity"::DOUBLE PRECISION * cm.rate)::INTEGER
    END
  ),
  "conversionRate" = CASE
    WHEN pv."conversions" IS NULL THEN st."conversionRate"
    ELSE COALESCE(st."conversionRate", cm.rate)
  END
FROM "product_variants" pv
LEFT JOIN conversion_map cm ON cm.conversion_id = pv."id"
WHERE st."productVariantId" = pv."id";

UPDATE "stock_transactions" st
SET
  "actionQuantity" = COALESCE(st."actionQuantity", st."quantity"::DOUBLE PRECISION),
  "sourceQuantity" = COALESCE(st."sourceQuantity", st."quantity")
WHERE st."productVariantId" IS NULL;

DO $$
DECLARE
  fractional_count INTEGER;
BEGIN
  WITH conversion_map AS (
    SELECT
      cv."id" AS conversion_id,
      COALESCE(
        NULLIF((cv."conversions"::jsonb ->> 'rate'), '')::DOUBLE PRECISION,
        NULLIF((cv."conversions"::jsonb ->> 'conversionRate'), '')::DOUBLE PRECISION,
        NULLIF((cv."conversions"::jsonb ->> 'mainQty'), '')::DOUBLE PRECISION
      ) AS rate
    FROM "product_variants" cv
    WHERE cv."conversions" IS NOT NULL
  )
  SELECT COUNT(*)
  INTO fractional_count
  FROM "stock_transactions" st
  JOIN conversion_map cm ON cm.conversion_id = st."productVariantId"
  WHERE ABS((st."actionQuantity" * cm.rate) - ROUND(st."actionQuantity" * cm.rate)) > 0.000000001;

  IF fractional_count > 0 THEN
    RAISE EXCEPTION 'Cannot normalize inventory ledger: % stock transactions produce fractional source quantities', fractional_count;
  END IF;
END $$;

WITH conversion_map AS (
  SELECT
    cv."id" AS conversion_id,
    cv."productId",
    src."id" AS source_id,
    COALESCE(
      NULLIF((cv."conversions"::jsonb ->> 'rate'), '')::DOUBLE PRECISION,
      NULLIF((cv."conversions"::jsonb ->> 'conversionRate'), '')::DOUBLE PRECISION,
      NULLIF((cv."conversions"::jsonb ->> 'mainQty'), '')::DOUBLE PRECISION
    ) AS rate
  FROM "product_variants" cv
  LEFT JOIN "product_variants" src
    ON src."productId" = cv."productId"
   AND src."id" <> cv."id"
   AND src."conversions" IS NULL
   AND src."deletedAt" IS NULL
   AND COALESCE(NULLIF(src."variantLabel", ''), '__base__') = COALESCE(NULLIF(cv."variantLabel", ''), '__base__')
  WHERE cv."conversions" IS NOT NULL
),
legacy_rows AS (
  SELECT
    bs.*,
    cm.source_id,
    ROUND(bs."stock"::DOUBLE PRECISION * cm.rate)::INTEGER AS source_stock,
    ROUND(bs."reservedStock"::DOUBLE PRECISION * cm.rate)::INTEGER AS source_reserved
  FROM "branch_stocks" bs
  JOIN conversion_map cm ON cm.conversion_id = bs."productVariantId"
)
UPDATE "branch_stocks" target
SET
  "stock" = target."stock" + legacy.source_stock,
  "reservedStock" = target."reservedStock" + legacy.source_reserved
FROM legacy_rows legacy
WHERE target."branchId" = legacy."branchId"
  AND target."productId" = legacy."productId"
  AND target."productVariantId" IS NOT DISTINCT FROM legacy.source_id;

WITH conversion_map AS (
  SELECT
    cv."id" AS conversion_id,
    cv."productId",
    src."id" AS source_id,
    COALESCE(
      NULLIF((cv."conversions"::jsonb ->> 'rate'), '')::DOUBLE PRECISION,
      NULLIF((cv."conversions"::jsonb ->> 'conversionRate'), '')::DOUBLE PRECISION,
      NULLIF((cv."conversions"::jsonb ->> 'mainQty'), '')::DOUBLE PRECISION
    ) AS rate
  FROM "product_variants" cv
  LEFT JOIN "product_variants" src
    ON src."productId" = cv."productId"
   AND src."id" <> cv."id"
   AND src."conversions" IS NULL
   AND src."deletedAt" IS NULL
   AND COALESCE(NULLIF(src."variantLabel", ''), '__base__') = COALESCE(NULLIF(cv."variantLabel", ''), '__base__')
  WHERE cv."conversions" IS NOT NULL
),
legacy_rows AS (
  SELECT
    bs.*,
    cm.source_id,
    ROUND(bs."stock"::DOUBLE PRECISION * cm.rate)::INTEGER AS source_stock,
    ROUND(bs."reservedStock"::DOUBLE PRECISION * cm.rate)::INTEGER AS source_reserved
  FROM "branch_stocks" bs
  JOIN conversion_map cm ON cm.conversion_id = bs."productVariantId"
),
missing_targets AS (
  SELECT legacy.*
  FROM legacy_rows legacy
  WHERE NOT EXISTS (
    SELECT 1
    FROM "branch_stocks" target
    WHERE target."branchId" = legacy."branchId"
      AND target."productId" = legacy."productId"
      AND target."productVariantId" IS NOT DISTINCT FROM legacy.source_id
  )
)
INSERT INTO "branch_stocks" (
  "id",
  "branchId",
  "productId",
  "productVariantId",
  "stock",
  "reservedStock",
  "minStock",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || legacy."id"),
  legacy."branchId",
  legacy."productId",
  legacy.source_id,
  legacy.source_stock,
  legacy.source_reserved,
  5,
  NOW(),
  NOW()
FROM missing_targets legacy;

DELETE FROM "branch_stocks" bs
USING "product_variants" pv
WHERE bs."productVariantId" = pv."id"
  AND pv."conversions" IS NOT NULL;
