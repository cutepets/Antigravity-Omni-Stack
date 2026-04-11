ALTER TABLE "shift_sessions"
ADD COLUMN "reserveTargetAmount" DOUBLE PRECISION NOT NULL DEFAULT 2000000,
ADD COLUMN "reserveShortageAtOpen" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "netCashAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "reserveTopUpAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "withdrawableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "collectedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "pendingCollectionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "shift_sessions"
SET
  "reserveTargetAmount" = 2000000,
  "reserveShortageAtOpen" = GREATEST(0, 2000000 - COALESCE("openAmount", 0)),
  "netCashAmount" = COALESCE("cashIncomeAmount", 0) - COALESCE("cashExpenseAmount", 0),
  "reserveTopUpAmount" = LEAST(
    GREATEST(0, 2000000 - COALESCE("openAmount", 0)),
    GREATEST(0, COALESCE("cashIncomeAmount", 0) - COALESCE("cashExpenseAmount", 0))
  ),
  "withdrawableAmount" = CASE
    WHEN "status" = 'CLOSED' AND "closeAmount" IS NOT NULL THEN GREATEST(0, "closeAmount" - 2000000)
    ELSE 0
  END,
  "collectedAmount" = 0,
  "pendingCollectionAmount" = CASE
    WHEN "status" = 'CLOSED' AND "closeAmount" IS NOT NULL THEN GREATEST(0, "closeAmount" - 2000000)
    ELSE 0
  END
WHERE "status" = 'CLOSED';
