ALTER TABLE "hotel_stays"
ADD COLUMN IF NOT EXISTS "hotel_stay_secondaryPhone" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'hotel_stays'
      AND column_name = 'secondaryPhone'
  ) THEN
    EXECUTE 'UPDATE "hotel_stays"
      SET "hotel_stay_secondaryPhone" = "secondaryPhone"
      WHERE "hotel_stay_secondaryPhone" IS NULL';
  END IF;
END $$;
