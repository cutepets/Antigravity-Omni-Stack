ALTER TABLE "hotel_price_rules"
ADD COLUMN "branchId" TEXT;

ALTER TABLE "hotel_stays"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "checkedInAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE TABLE "hotel_stay_adjustments" (
  "id" TEXT NOT NULL,
  "hotelStayId" TEXT NOT NULL,
  "type" TEXT,
  "label" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hotel_stay_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_price_rules_year_branchId_dayType_species_isActive_idx"
ON "hotel_price_rules"("year", "branchId", "dayType", "species", "isActive");

CREATE INDEX "hotel_stays_createdById_idx"
ON "hotel_stays"("createdById");

CREATE INDEX "hotel_stays_checkedInAt_idx"
ON "hotel_stays"("checkedInAt");

CREATE INDEX "hotel_stays_cancelledAt_idx"
ON "hotel_stays"("cancelledAt");

CREATE INDEX "hotel_stay_adjustments_hotelStayId_createdAt_idx"
ON "hotel_stay_adjustments"("hotelStayId", "createdAt");

ALTER TABLE "hotel_price_rules"
ADD CONSTRAINT "hotel_price_rules_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hotel_stays"
ADD CONSTRAINT "hotel_stays_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hotel_stay_adjustments"
ADD CONSTRAINT "hotel_stay_adjustments_hotelStayId_fkey"
FOREIGN KEY ("hotelStayId") REFERENCES "hotel_stays"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
