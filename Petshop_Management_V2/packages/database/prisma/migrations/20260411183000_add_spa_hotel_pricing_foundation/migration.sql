ALTER TABLE "order_items"
ADD COLUMN "pricingSnapshot" JSONB;

CREATE TABLE "service_weight_bands" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "species" TEXT,
    "label" TEXT NOT NULL,
    "minWeight" DOUBLE PRECISION NOT NULL,
    "maxWeight" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_weight_bands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hotel_price_rules" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "species" TEXT,
    "weightBandId" TEXT NOT NULL,
    "dayType" "HotelLineType" NOT NULL DEFAULT 'REGULAR',
    "halfDayPrice" DOUBLE PRECISION NOT NULL,
    "fullDayPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_price_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "holiday_calendar_dates" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_calendar_dates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hotel_stays"
ADD COLUMN "weightAtBooking" DOUBLE PRECISION,
ADD COLUMN "weightBandId" TEXT,
ADD COLUMN "pricingSnapshot" JSONB,
ADD COLUMN "breakdownSnapshot" JSONB;

CREATE TABLE "hotel_stay_charge_lines" (
    "id" TEXT NOT NULL,
    "hotelStayId" TEXT NOT NULL,
    "weightBandId" TEXT,
    "label" TEXT NOT NULL,
    "dayType" "HotelLineType" NOT NULL DEFAULT 'REGULAR',
    "quantityDays" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pricingSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_stay_charge_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_weight_bands_serviceType_species_isActive_sortOrder_idx"
ON "service_weight_bands"("serviceType", "species", "isActive", "sortOrder");

CREATE INDEX "hotel_price_rules_year_dayType_species_isActive_idx"
ON "hotel_price_rules"("year", "dayType", "species", "isActive");

CREATE INDEX "hotel_price_rules_weightBandId_year_idx"
ON "hotel_price_rules"("weightBandId", "year");

CREATE UNIQUE INDEX "holiday_calendar_dates_date_key"
ON "holiday_calendar_dates"("date");

CREATE INDEX "holiday_calendar_dates_year_isActive_idx"
ON "holiday_calendar_dates"("year", "isActive");

CREATE INDEX "hotel_stays_weightBandId_idx"
ON "hotel_stays"("weightBandId");

CREATE INDEX "hotel_stay_charge_lines_hotelStayId_sortOrder_idx"
ON "hotel_stay_charge_lines"("hotelStayId", "sortOrder");

CREATE INDEX "hotel_stay_charge_lines_dayType_idx"
ON "hotel_stay_charge_lines"("dayType");

CREATE INDEX "hotel_stay_charge_lines_weightBandId_idx"
ON "hotel_stay_charge_lines"("weightBandId");

ALTER TABLE "hotel_price_rules"
ADD CONSTRAINT "hotel_price_rules_weightBandId_fkey"
FOREIGN KEY ("weightBandId") REFERENCES "service_weight_bands"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hotel_stays"
ADD CONSTRAINT "hotel_stays_weightBandId_fkey"
FOREIGN KEY ("weightBandId") REFERENCES "service_weight_bands"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hotel_stay_charge_lines"
ADD CONSTRAINT "hotel_stay_charge_lines_hotelStayId_fkey"
FOREIGN KEY ("hotelStayId") REFERENCES "hotel_stays"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hotel_stay_charge_lines"
ADD CONSTRAINT "hotel_stay_charge_lines_weightBandId_fkey"
FOREIGN KEY ("weightBandId") REFERENCES "service_weight_bands"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
