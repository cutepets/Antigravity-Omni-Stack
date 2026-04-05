ALTER TABLE "hotel_rate_tables"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "hotel_stays"
ADD COLUMN "stayCode" TEXT,
ADD COLUMN "branchId" TEXT,
ADD COLUMN "checkOutActual" TIMESTAMP(3),
ADD COLUMN "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "petNotes" TEXT,
ADD COLUMN "promotion" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "surcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "hotel_stays"
SET
  "dailyRate" = COALESCE("price", 0),
  "totalPrice" = COALESCE("price", 0)
WHERE COALESCE("dailyRate", 0) = 0;

CREATE UNIQUE INDEX "hotel_stays_stayCode_key" ON "hotel_stays"("stayCode");
CREATE INDEX "hotel_rate_tables_year_lineType_isActive_idx" ON "hotel_rate_tables"("year", "lineType", "isActive");
CREATE INDEX "hotel_stays_customerId_idx" ON "hotel_stays"("customerId");
CREATE INDEX "hotel_stays_branchId_idx" ON "hotel_stays"("branchId");
CREATE INDEX "hotel_stays_paymentStatus_idx" ON "hotel_stays"("paymentStatus");
CREATE INDEX "hotel_stays_orderId_idx" ON "hotel_stays"("orderId");
CREATE INDEX "hotel_stays_estimatedCheckOut_idx" ON "hotel_stays"("estimatedCheckOut");
CREATE INDEX "order_items_hotelStayId_idx" ON "order_items"("hotelStayId");

ALTER TABLE "hotel_stays"
ADD CONSTRAINT "hotel_stays_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hotel_stays"
ADD CONSTRAINT "hotel_stays_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hotel_stays"
ADD CONSTRAINT "hotel_stays_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_hotelStayId_fkey"
FOREIGN KEY ("hotelStayId") REFERENCES "hotel_stays"("id") ON DELETE SET NULL ON UPDATE CASCADE;
