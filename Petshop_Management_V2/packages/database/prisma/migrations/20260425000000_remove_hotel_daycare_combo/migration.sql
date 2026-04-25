DROP TABLE IF EXISTS "hotel_daycare_price_rules";

ALTER TABLE "hotel_stays"
  DROP COLUMN IF EXISTS "careMode",
  DROP COLUMN IF EXISTS "packageKind",
  DROP COLUMN IF EXISTS "packageTotalDays",
  DROP COLUMN IF EXISTS "packageStartDate",
  DROP COLUMN IF EXISTS "packageEndDate",
  DROP COLUMN IF EXISTS "autoCompleteAt";

DROP TYPE IF EXISTS "HotelCareMode";
DROP TYPE IF EXISTS "HotelPackageKind";
