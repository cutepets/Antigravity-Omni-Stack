-- Add lifecycle and reference tracking for uploaded assets.
CREATE TYPE "StoredAssetStatus" AS ENUM ('ACTIVE', 'ORPHANED', 'DELETED');

ALTER TABLE "stored_assets"
  ADD COLUMN "scope" TEXT,
  ADD COLUMN "ownerType" TEXT,
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "status" "StoredAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "referenceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReferencedAt" TIMESTAMP(3),
  ADD COLUMN "orphanedAt" TIMESTAMP(3);

CREATE TABLE "stored_asset_references" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stored_asset_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stored_assets_url_key" ON "stored_assets"("url");
CREATE INDEX "stored_assets_status_category_idx" ON "stored_assets"("status", "category");
CREATE INDEX "stored_assets_sha256_idx" ON "stored_assets"("sha256");
CREATE INDEX "stored_assets_ownerType_ownerId_idx" ON "stored_assets"("ownerType", "ownerId");
CREATE INDEX "stored_asset_references_entityType_entityId_idx" ON "stored_asset_references"("entityType", "entityId");
CREATE INDEX "stored_asset_references_fieldName_idx" ON "stored_asset_references"("fieldName");
CREATE UNIQUE INDEX "stored_asset_references_assetId_entityType_entityId_fieldName_key"
  ON "stored_asset_references"("assetId", "entityType", "entityId", "fieldName");

ALTER TABLE "stored_asset_references"
  ADD CONSTRAINT "stored_asset_references_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "stored_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
