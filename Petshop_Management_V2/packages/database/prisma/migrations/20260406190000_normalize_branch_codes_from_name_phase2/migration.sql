WITH ranked_branches AS (
  SELECT
    b.id,
    b."createdAt",
    b."isMain",
    ROW_NUMBER() OVER (ORDER BY b."isMain" DESC, b."createdAt" ASC, b.id ASC) AS global_seq,
    REGEXP_REPLACE(
      UPPER(REPLACE(REPLACE(b.name, 'Đ', 'D'), 'đ', 'd')),
      '[^A-Z0-9 ]',
      '',
      'g'
    ) AS normalized_name
  FROM "branches" b
),
raw_codes AS (
  SELECT
    rb.id,
    rb."createdAt",
    rb."isMain",
    rb.global_seq,
    CASE
      WHEN COALESCE(
        ARRAY_LENGTH(
          ARRAY_REMOVE(
            REGEXP_SPLIT_TO_ARRAY(
              TRIM(REGEXP_REPLACE(rb.normalized_name, '\s+', ' ', 'g')),
              ' '
            ),
            ''
          ),
          1
        ),
        0
      ) >= 2
      THEN LEFT((
        SELECT STRING_AGG(LEFT(part, 1), '')
        FROM UNNEST(
          ARRAY_REMOVE(
            REGEXP_SPLIT_TO_ARRAY(
              TRIM(REGEXP_REPLACE(rb.normalized_name, '\s+', ' ', 'g')),
              ' '
            ),
            ''
          )
        ) AS part
      ), 4)
      ELSE LEFT(REPLACE(TRIM(REGEXP_REPLACE(rb.normalized_name, '\s+', ' ', 'g')), ' ', ''), 4)
    END AS raw_code
  FROM ranked_branches rb
),
prepared_codes AS (
  SELECT
    rc.id,
    rc."createdAt",
    rc."isMain",
    CASE
      WHEN COALESCE(rc.raw_code, '') ~ '^[A-Z0-9]{2,4}$' THEN rc.raw_code
      ELSE 'B' || LPAD(rc.global_seq::text, 3, '0')
    END AS base_code
  FROM raw_codes rc
),
deduped_codes AS (
  SELECT
    pc.*,
    ROW_NUMBER() OVER (
      PARTITION BY pc.base_code
      ORDER BY pc."isMain" DESC, pc."createdAt" ASC, pc.id ASC
    ) AS dup_seq
  FROM prepared_codes pc
),
final_branch_codes AS (
  SELECT
    dc.id,
    CASE
      WHEN dc.dup_seq = 1 THEN dc.base_code
      ELSE LEFT(dc.base_code, GREATEST(0, 4 - LENGTH((dc.dup_seq - 1)::text))) || (dc.dup_seq - 1)::text
    END AS next_code
  FROM deduped_codes dc
)
UPDATE "branches" b
SET "code" = fbc.next_code
FROM final_branch_codes fbc
WHERE b.id = fbc.id;

WITH hotel_code_base AS (
  SELECT
    hs.id,
    COALESCE(o."createdAt", hs."createdAt") AS code_date,
    hs."branchId" AS branch_id
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
SET "stayCode" = 'H' || hcr.yymm || hcr.branch_code || LPAD(hcr.seq::text, 3, '0')
FROM hotel_code_ranked hcr
WHERE hs.id = hcr.id;

WITH grooming_code_base AS (
  SELECT
    gs.id,
    COALESCE(o."createdAt", gs."createdAt") AS code_date,
    gs."branchId" AS branch_id
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
SET "sessionCode" = 'S' || gcr.yymm || gcr.branch_code || LPAD(gcr.seq::text, 3, '0')
FROM grooming_code_ranked gcr
WHERE gs.id = gcr.id;
