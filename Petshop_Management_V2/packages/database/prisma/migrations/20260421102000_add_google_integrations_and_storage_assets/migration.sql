CREATE TYPE "StorageProviderKind" AS ENUM ('LOCAL', 'GOOGLE_DRIVE');

ALTER TABLE "users"
ADD COLUMN "googleId" TEXT,
ADD COLUMN "googleEmail" TEXT,
ADD COLUMN "googleAvatar" TEXT;

CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

ALTER TABLE "system_configs"
ADD COLUMN "storageProvider" "StorageProviderKind" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "googleAuthEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googleAuthClientId" TEXT,
ADD COLUMN "googleAuthClientSecretEnc" TEXT,
ADD COLUMN "googleAuthAllowedDomain" TEXT,
ADD COLUMN "googleDriveEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googleDriveClientEmail" TEXT,
ADD COLUMN "googleDriveSharedDriveId" TEXT,
ADD COLUMN "googleDriveRootFolderId" TEXT,
ADD COLUMN "googleDriveImageFolderId" TEXT,
ADD COLUMN "googleDriveDocumentFolderId" TEXT,
ADD COLUMN "googleDriveBackupFolderId" TEXT,
ADD COLUMN "googleDriveServiceAccountEnc" TEXT;

CREATE TABLE "stored_assets" (
  "id" TEXT NOT NULL,
  "provider" "StorageProviderKind" NOT NULL,
  "category" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "extension" TEXT,
  "storageKey" TEXT,
  "url" TEXT NOT NULL,
  "previewUrl" TEXT,
  "googleFileId" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "stored_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stored_assets_provider_category_idx" ON "stored_assets"("provider", "category");
CREATE INDEX "stored_assets_uploadedById_idx" ON "stored_assets"("uploadedById");
CREATE INDEX "stored_assets_googleFileId_idx" ON "stored_assets"("googleFileId");

ALTER TABLE "stored_assets"
ADD CONSTRAINT "stored_assets_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
