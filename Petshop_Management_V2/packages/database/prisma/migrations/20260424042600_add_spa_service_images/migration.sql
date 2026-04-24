-- AlterTable: add service image storage to system_configs (@@map name of SystemConfig model)
ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS "spaServiceImages" TEXT;

-- AlterTable: persist editable service labels for SPA price rules
ALTER TABLE spa_price_rules ADD COLUMN IF NOT EXISTS "label" TEXT;
