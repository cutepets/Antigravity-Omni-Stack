CREATE TYPE "EquipmentStatus" AS ENUM (
  'IN_USE',
  'STANDBY',
  'MAINTENANCE',
  'BROKEN',
  'LIQUIDATED'
);

CREATE TABLE "equipment_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_location_presets" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "equipment_location_presets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipments" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "model" TEXT,
  "status" "EquipmentStatus" NOT NULL DEFAULT 'IN_USE',
  "imageUrl" TEXT,
  "serialNumber" TEXT,
  "purchaseDate" TIMESTAMP(3),
  "inServiceDate" TIMESTAMP(3),
  "warrantyUntil" TIMESTAMP(3),
  "purchaseValue" DOUBLE PRECISION,
  "branchId" TEXT NOT NULL,
  "categoryId" TEXT,
  "locationPresetId" TEXT,
  "holderName" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment_histories" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "diffJson" JSONB,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_histories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_categories_name_key" ON "equipment_categories"("name");
CREATE UNIQUE INDEX "equipment_location_presets_branchId_name_key" ON "equipment_location_presets"("branchId", "name");
CREATE UNIQUE INDEX "equipments_code_key" ON "equipments"("code");

CREATE INDEX "equipment_categories_isActive_idx" ON "equipment_categories"("isActive");
CREATE INDEX "equipment_categories_sortOrder_idx" ON "equipment_categories"("sortOrder");
CREATE INDEX "equipment_location_presets_branchId_idx" ON "equipment_location_presets"("branchId");
CREATE INDEX "equipment_location_presets_isActive_idx" ON "equipment_location_presets"("isActive");
CREATE INDEX "equipment_location_presets_sortOrder_idx" ON "equipment_location_presets"("sortOrder");
CREATE INDEX "equipments_branchId_idx" ON "equipments"("branchId");
CREATE INDEX "equipments_categoryId_idx" ON "equipments"("categoryId");
CREATE INDEX "equipments_locationPresetId_idx" ON "equipments"("locationPresetId");
CREATE INDEX "equipments_status_idx" ON "equipments"("status");
CREATE INDEX "equipments_archivedAt_idx" ON "equipments"("archivedAt");
CREATE INDEX "equipments_warrantyUntil_idx" ON "equipments"("warrantyUntil");
CREATE INDEX "equipment_histories_equipmentId_createdAt_idx" ON "equipment_histories"("equipmentId", "createdAt");
CREATE INDEX "equipment_histories_actorId_idx" ON "equipment_histories"("actorId");
CREATE INDEX "equipment_histories_action_idx" ON "equipment_histories"("action");

ALTER TABLE "equipment_location_presets"
ADD CONSTRAINT "equipment_location_presets_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipments"
ADD CONSTRAINT "equipments_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "equipments"
ADD CONSTRAINT "equipments_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "equipment_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipments"
ADD CONSTRAINT "equipments_locationPresetId_fkey"
FOREIGN KEY ("locationPresetId") REFERENCES "equipment_location_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipments"
ADD CONSTRAINT "equipments_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipments"
ADD CONSTRAINT "equipments_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment_histories"
ADD CONSTRAINT "equipment_histories_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "equipment_histories"
ADD CONSTRAINT "equipment_histories_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
