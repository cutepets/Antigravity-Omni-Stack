-- Add OAuth-backed Google Drive storage mode.
CREATE TYPE "GoogleDriveAuthMode" AS ENUM ('SERVICE_ACCOUNT', 'OAUTH');

ALTER TABLE "system_configs"
ADD COLUMN "googleDriveAuthMode" "GoogleDriveAuthMode" NOT NULL DEFAULT 'SERVICE_ACCOUNT',
ADD COLUMN "googleDriveOAuthRefreshTokenEnc" TEXT,
ADD COLUMN "googleDriveOAuthEmail" TEXT;
