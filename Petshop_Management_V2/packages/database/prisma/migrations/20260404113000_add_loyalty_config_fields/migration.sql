ALTER TABLE "system_configs"
ADD COLUMN "loyaltySpendPerPoint" INTEGER,
ADD COLUMN "loyaltyPointValue" INTEGER,
ADD COLUMN "loyaltyPointExpiryMonths" INTEGER,
ADD COLUMN "loyaltyTierRetentionMonths" INTEGER,
ADD COLUMN "loyaltyTierRules" TEXT;
