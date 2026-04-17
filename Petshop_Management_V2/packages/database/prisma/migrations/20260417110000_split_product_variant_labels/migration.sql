ALTER TABLE "product_variants"
ADD COLUMN "variantLabel" TEXT,
ADD COLUMN "unitLabel" TEXT;

WITH resolved AS (
  SELECT
    pv."id",
    p."name" AS "productName",
    NULLIF(
      BTRIM(
        CASE
          WHEN pv."name" LIKE p."name" || ' - %'
            THEN SUBSTRING(pv."name" FROM LENGTH(p."name") + 4)
          ELSE pv."name"
        END
      ),
      ''
    ) AS "legacySuffix",
    NULLIF(
      BTRIM(
        CASE
          WHEN pv."conversions" IS NOT NULL AND pv."conversions" ~ '^\s*\{.*\}\s*$'
            THEN pv."conversions"::jsonb ->> 'unit'
          ELSE NULL
        END
      ),
      ''
    ) AS "conversionUnit"
  FROM "product_variants" pv
  JOIN "products" p ON p."id" = pv."productId"
)
UPDATE "product_variants" pv
SET
  "unitLabel" = COALESCE(pv."unitLabel", resolved."conversionUnit"),
  "variantLabel" = COALESCE(
    pv."variantLabel",
    NULLIF(
      BTRIM(
        CASE
          WHEN resolved."conversionUnit" IS NOT NULL
            AND resolved."legacySuffix" ILIKE '% - ' || resolved."conversionUnit"
            THEN LEFT(
              resolved."legacySuffix",
              LENGTH(resolved."legacySuffix") - LENGTH(' - ' || resolved."conversionUnit")
            )
          ELSE resolved."legacySuffix"
        END
      ),
      ''
    )
  )
FROM resolved
WHERE pv."id" = resolved."id";

UPDATE "product_variants" pv
SET "name" = CONCAT_WS(' - ', p."name", NULLIF(pv."variantLabel", ''), NULLIF(pv."unitLabel", ''))
FROM "products" p
WHERE p."id" = pv."productId";
