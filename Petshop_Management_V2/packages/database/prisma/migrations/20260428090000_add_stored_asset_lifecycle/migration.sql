-- Add lifecycle and reference tracking for uploaded assets.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StoredAssetStatus') THEN
    CREATE TYPE "StoredAssetStatus" AS ENUM ('ACTIVE', 'ORPHANED', 'DELETED');
  END IF;
END $$;

ALTER TABLE "stored_assets"
  ADD COLUMN IF NOT EXISTS "scope" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerType" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "StoredAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "referenceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastReferencedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "orphanedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "stored_asset_references" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stored_asset_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stored_assets_url_key" ON "stored_assets"("url");
CREATE INDEX IF NOT EXISTS "stored_assets_status_category_idx" ON "stored_assets"("status", "category");
CREATE INDEX IF NOT EXISTS "stored_assets_sha256_idx" ON "stored_assets"("sha256");
CREATE INDEX IF NOT EXISTS "stored_assets_ownerType_ownerId_idx" ON "stored_assets"("ownerType", "ownerId");
CREATE INDEX IF NOT EXISTS "stored_asset_references_entityType_entityId_idx" ON "stored_asset_references"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "stored_asset_references_fieldName_idx" ON "stored_asset_references"("fieldName");
CREATE UNIQUE INDEX IF NOT EXISTS "stored_asset_references_assetId_entityType_entityId_fieldName_key"
  ON "stored_asset_references"("assetId", "entityType", "entityId", "fieldName");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'stored_asset_references_assetId_fkey'
      AND table_name = 'stored_asset_references'
  ) THEN
    ALTER TABLE "stored_asset_references"
      ADD CONSTRAINT "stored_asset_references_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "stored_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
