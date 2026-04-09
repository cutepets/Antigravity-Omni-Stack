ALTER TABLE "branches"
ADD COLUMN IF NOT EXISTS "code" TEXT;

ALTER TABLE "grooming_sessions"
ADD COLUMN IF NOT EXISTS "branchId" TEXT;

WITH ranked_branches AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "isMain" DESC, "createdAt" ASC, id ASC) AS seq,
    "isMain"
  FROM "branches"
),
branch_codes AS (
  SELECT
    id,
    CASE
      WHEN "isMain" AND seq = 1 THEN 'MAIN'
      ELSE 'B' || LPAD(seq::text, 3, '0')
    END AS next_code
  FROM ranked_branches
)
UPDATE "branches" AS b
SET "code" = branch_codes.next_code
FROM branch_codes
WHERE b.id = branch_codes.id
  AND (
    b."code" IS NULL
    OR b."code" !~ '^[A-Z0-9]{2,4}$'
  );

ALTER TABLE "branches"
ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "branches_code_key" ON "branches"("code");
CREATE INDEX IF NOT EXISTS "grooming_sessions_branchId_idx" ON "grooming_sessions"("branchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'grooming_sessions_branchId_fkey'
  ) THEN
    ALTER TABLE "grooming_sessions"
    ADD CONSTRAINT "grooming_sessions_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

WITH default_branch AS (
  SELECT id
  FROM "branches"
  ORDER BY "isMain" DESC, "createdAt" ASC, id ASC
  LIMIT 1
),
resolved_grooming_branch AS (
  SELECT
    gs.id,
    COALESCE(gs."branchId", o."branchId", u."branchId", (SELECT id FROM default_branch)) AS branch_id
  FROM "grooming_sessions" gs
  LEFT JOIN "orders" o ON o.id = gs."orderId"
  LEFT JOIN "users" u ON u.id = gs."staffId"
)
UPDATE "grooming_sessions" gs
SET "branchId" = rgb.branch_id
FROM resolved_grooming_branch rgb
WHERE gs.id = rgb.id
  AND gs."branchId" IS DISTINCT FROM rgb.branch_id;

WITH default_branch AS (
  SELECT id
  FROM "branches"
  ORDER BY "isMain" DESC, "createdAt" ASC, id ASC
  LIMIT 1
),
resolved_hotel_branch AS (
  SELECT
    hs.id,
    COALESCE(hs."branchId", o."branchId", (SELECT id FROM default_branch)) AS branch_id
  FROM "hotel_stays" hs
  LEFT JOIN "orders" o ON o.id = hs."orderId"
)
UPDATE "hotel_stays" hs
SET "branchId" = rhb.branch_id
FROM resolved_hotel_branch rhb
WHERE hs.id = rhb.id
  AND hs."branchId" IS DISTINCT FROM rhb.branch_id;

WITH hotel_code_base AS (
  SELECT
    hs.id,
    COALESCE(o."createdAt", hs."createdAt") AS code_date,
    COALESCE(hs."branchId", o."branchId") AS branch_id
  FROM "hotel_stays" hs
  LEFT JOIN "orders" o ON o.id = hs."orderId"
),
hotel_code_ranked AS (
  SELECT
    hcb.id,
    hcb.branch_id,
    TO_CHAR(hcb.code_date, 'YYMM') AS yymm,
    b."code" AS branch_code,
    ROW_NUMBER() OVER (
      PARTITION BY TO_CHAR(hcb.code_date, 'YYMM'), b."code"
      ORDER BY hcb.code_date ASC, hcb.id ASC
    ) AS seq
  FROM hotel_code_base hcb
  JOIN "branches" b ON b.id = hcb.branch_id
)
UPDATE "hotel_stays" hs
SET
  "branchId" = hcr.branch_id,
  "stayCode" = 'H' || hcr.yymm || hcr.branch_code || LPAD(hcr.seq::text, 3, '0')
FROM hotel_code_ranked hcr
WHERE hs.id = hcr.id;

WITH grooming_code_base AS (
  SELECT
    gs.id,
    COALESCE(o."createdAt", gs."createdAt") AS code_date,
    COALESCE(gs."branchId", o."branchId") AS branch_id
  FROM "grooming_sessions" gs
  LEFT JOIN "orders" o ON o.id = gs."orderId"
),
grooming_code_ranked AS (
  SELECT
    gcb.id,
    gcb.branch_id,
    TO_CHAR(gcb.code_date, 'YYMM') AS yymm,
    b."code" AS branch_code,
    ROW_NUMBER() OVER (
      PARTITION BY TO_CHAR(gcb.code_date, 'YYMM'), b."code"
      ORDER BY gcb.code_date ASC, gcb.id ASC
    ) AS seq
  FROM grooming_code_base gcb
  JOIN "branches" b ON b.id = gcb.branch_id
)
UPDATE "grooming_sessions" gs
SET
  "branchId" = gcr.branch_id,
  "sessionCode" = 'S' || gcr.yymm || gcr.branch_code || LPAD(gcr.seq::text, 3, '0')
FROM grooming_code_ranked gcr
WHERE gs.id = gcr.id;
