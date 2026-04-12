ALTER TABLE "grooming_sessions"
ADD COLUMN "packageCode" TEXT,
ADD COLUMN "weightAtBooking" DOUBLE PRECISION,
ADD COLUMN "weightBandId" TEXT,
ADD COLUMN "pricingSnapshot" JSONB;

CREATE TABLE "spa_price_rules" (
    "id" TEXT NOT NULL,
    "species" TEXT,
    "packageCode" TEXT NOT NULL,
    "weightBandId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "durationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spa_price_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grooming_sessions_weightBandId_idx"
ON "grooming_sessions"("weightBandId");

CREATE INDEX "spa_price_rules_packageCode_species_isActive_idx"
ON "spa_price_rules"("packageCode", "species", "isActive");

CREATE INDEX "spa_price_rules_weightBandId_packageCode_idx"
ON "spa_price_rules"("weightBandId", "packageCode");

ALTER TABLE "grooming_sessions"
ADD CONSTRAINT "grooming_sessions_weightBandId_fkey"
FOREIGN KEY ("weightBandId") REFERENCES "service_weight_bands"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "spa_price_rules"
ADD CONSTRAINT "spa_price_rules_weightBandId_fkey"
FOREIGN KEY ("weightBandId") REFERENCES "service_weight_bands"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
