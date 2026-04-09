ALTER TABLE "customers" ADD COLUMN "branchId" TEXT;
ALTER TABLE "pets" ADD COLUMN "branchId" TEXT;

WITH customer_branch_candidates AS (
  SELECT
    c.id AS customer_id,
    COALESCE(
      (
        SELECT o."branchId"
        FROM "orders" o
        WHERE o."customerId" = c.id
          AND o."branchId" IS NOT NULL
        ORDER BY o."createdAt" DESC
        LIMIT 1
      ),
      (
        SELECT hs."branchId"
        FROM "hotel_stays" hs
        WHERE hs."customerId" = c.id
          AND hs."branchId" IS NOT NULL
        ORDER BY hs."createdAt" DESC
        LIMIT 1
      )
    ) AS branch_id
  FROM "customers" c
)
UPDATE "customers" c
SET "branchId" = cbc.branch_id
FROM customer_branch_candidates cbc
WHERE c.id = cbc.customer_id
  AND c."branchId" IS NULL
  AND cbc.branch_id IS NOT NULL;

UPDATE "pets" p
SET "branchId" = c."branchId"
FROM "customers" c
WHERE p."customerId" = c.id
  AND p."branchId" IS NULL
  AND c."branchId" IS NOT NULL;

CREATE INDEX "customers_branchId_idx" ON "customers"("branchId");
CREATE INDEX "pets_branchId_idx" ON "pets"("branchId");

ALTER TABLE "customers"
ADD CONSTRAINT "customers_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "pets"
ADD CONSTRAINT "pets_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
