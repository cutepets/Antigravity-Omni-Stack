ALTER TABLE "holiday_calendar_dates"
ADD COLUMN "endDate" TIMESTAMP(3),
ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false;

UPDATE "holiday_calendar_dates"
SET "endDate" = "date"
WHERE "endDate" IS NULL;

CREATE INDEX "holiday_calendar_dates_date_endDate_idx"
ON "holiday_calendar_dates"("date", "endDate");

CREATE INDEX "holiday_calendar_dates_isRecurring_isActive_idx"
ON "holiday_calendar_dates"("isRecurring", "isActive");
