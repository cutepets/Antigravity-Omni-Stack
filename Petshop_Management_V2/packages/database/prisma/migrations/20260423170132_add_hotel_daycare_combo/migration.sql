-- CreateEnum
CREATE TYPE "HotelCareMode" AS ENUM ('BOARDING', 'DAYCARE');

-- CreateEnum
CREATE TYPE "HotelPackageKind" AS ENUM ('NONE', 'COMBO_10_DAYS');

-- AlterTable
ALTER TABLE "hotel_stays" ADD COLUMN     "autoCompleteAt" TIMESTAMP(3),
ADD COLUMN     "careMode" "HotelCareMode" NOT NULL DEFAULT 'BOARDING',
ADD COLUMN     "packageEndDate" TIMESTAMP(3),
ADD COLUMN     "packageKind" "HotelPackageKind" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "packageStartDate" TIMESTAMP(3),
ADD COLUMN     "packageTotalDays" INTEGER;

-- CreateTable
CREATE TABLE "hotel_daycare_price_rules" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "species" TEXT,
    "branchId" TEXT,
    "weightBandId" TEXT NOT NULL,
    "packageDays" INTEGER NOT NULL DEFAULT 10,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_daycare_price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_daycare_price_rules_branchId_species_isActive_idx" ON "hotel_daycare_price_rules"("branchId", "species", "isActive");

-- CreateIndex
CREATE INDEX "hotel_daycare_price_rules_weightBandId_packageDays_idx" ON "hotel_daycare_price_rules"("weightBandId", "packageDays");

-- CreateIndex
CREATE INDEX "hotel_stays_careMode_status_idx" ON "hotel_stays"("careMode", "status");

-- CreateIndex
CREATE INDEX "hotel_stays_autoCompleteAt_idx" ON "hotel_stays"("autoCompleteAt");

-- AddForeignKey
ALTER TABLE "hotel_daycare_price_rules" ADD CONSTRAINT "hotel_daycare_price_rules_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_daycare_price_rules" ADD CONSTRAINT "hotel_daycare_price_rules_weightBandId_fkey" FOREIGN KEY ("weightBandId") REFERENCES "service_weight_bands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
