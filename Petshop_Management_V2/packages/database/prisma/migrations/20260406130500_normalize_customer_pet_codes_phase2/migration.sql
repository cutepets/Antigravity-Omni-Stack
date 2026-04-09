WITH customer_base AS (
  SELECT COALESCE(MAX(CAST(SUBSTRING("customerCode" FROM '([0-9]+)$') AS INTEGER)), 0) AS max_number
  FROM "customers"
  WHERE "customerCode" ~ '^KH-[0-9]+$'
),
invalid_customers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS row_number
  FROM "customers"
  WHERE "customerCode" IS NULL OR "customerCode" !~ '^KH-[0-9]+$'
)
UPDATE "customers" AS customer
SET "customerCode" = 'KH-' || LPAD((customer_base.max_number + invalid_customers.row_number)::text, 6, '0')
FROM customer_base, invalid_customers
WHERE customer.id = invalid_customers.id;

WITH pet_base AS (
  SELECT COALESCE(MAX(CAST(SUBSTRING("petCode" FROM '([0-9]+)$') AS INTEGER)), 0) AS max_number
  FROM "pets"
  WHERE "petCode" ~ '^PET-[0-9]+$'
),
invalid_pets AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS row_number
  FROM "pets"
  WHERE "petCode" IS NULL OR "petCode" !~ '^PET-[0-9]+$'
)
UPDATE "pets" AS pet
SET "petCode" = 'PET-' || LPAD((pet_base.max_number + invalid_pets.row_number)::text, 6, '0')
FROM pet_base, invalid_pets
WHERE pet.id = invalid_pets.id;
