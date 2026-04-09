ALTER TABLE "grooming_sessions"
ADD COLUMN "sessionCode" TEXT;

WITH ranked_customers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS seq
  FROM "customers"
)
UPDATE "customers" AS c
SET "customerCode" = 'KH' || LPAD(r.seq::text, 6, '0')
FROM ranked_customers AS r
WHERE c.id = r.id;

WITH ranked_pets AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS seq
  FROM "pets"
)
UPDATE "pets" AS p
SET "petCode" = 'PET' || LPAD(r.seq::text, 6, '0')
FROM ranked_pets AS r
WHERE p.id = r.id;

WITH ranked_orders AS (
  SELECT
    id,
    TO_CHAR("createdAt", 'YYYYMMDD') AS day_code,
    ROW_NUMBER() OVER (
      PARTITION BY DATE("createdAt")
      ORDER BY "createdAt", id
    ) AS seq
  FROM "orders"
)
UPDATE "orders" AS o
SET "orderNumber" = 'DH' || r.day_code || LPAD(r.seq::text, 4, '0')
FROM ranked_orders AS r
WHERE o.id = r.id;

UPDATE "transactions" AS t
SET "refNumber" = o."orderNumber"
FROM "orders" AS o
WHERE t."refId" = o.id;

WITH ranked_stays AS (
  SELECT
    id,
    TO_CHAR("checkIn", 'YYMMDD') AS day_code,
    ROW_NUMBER() OVER (
      PARTITION BY DATE("checkIn")
      ORDER BY "createdAt", id
    ) AS seq
  FROM "hotel_stays"
)
UPDATE "hotel_stays" AS hs
SET "stayCode" = 'HOTEL' || r.day_code || LPAD(r.seq::text, 3, '0')
FROM ranked_stays AS r
WHERE hs.id = r.id;

WITH ranked_grooming_sessions AS (
  SELECT
    id,
    TO_CHAR("createdAt", 'YYMMDD') AS day_code,
    ROW_NUMBER() OVER (
      PARTITION BY DATE("createdAt")
      ORDER BY "createdAt", id
    ) AS seq
  FROM "grooming_sessions"
)
UPDATE "grooming_sessions" AS gs
SET "sessionCode" = 'SPA' || r.day_code || LPAD(r.seq::text, 3, '0')
FROM ranked_grooming_sessions AS r
WHERE gs.id = r.id;

UPDATE "grooming_sessions" AS gs
SET "orderId" = NULL
WHERE "orderId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "orders" AS o
    WHERE o.id = gs."orderId"
  );

ALTER TABLE "grooming_sessions"
ALTER COLUMN "sessionCode" SET NOT NULL;

CREATE UNIQUE INDEX "grooming_sessions_sessionCode_key"
ON "grooming_sessions"("sessionCode");

CREATE INDEX "grooming_sessions_orderId_idx"
ON "grooming_sessions"("orderId");

ALTER TABLE "grooming_sessions"
ADD CONSTRAINT "grooming_sessions_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
