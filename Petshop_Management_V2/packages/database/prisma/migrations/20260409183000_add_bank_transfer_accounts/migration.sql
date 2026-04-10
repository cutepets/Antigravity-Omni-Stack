CREATE TABLE "bank_transfer_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transfer_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_transfer_accounts_accountNumber_key" ON "bank_transfer_accounts"("accountNumber");
CREATE INDEX "bank_transfer_accounts_isDefault_isActive_idx" ON "bank_transfer_accounts"("isDefault", "isActive");
CREATE INDEX "bank_transfer_accounts_bankName_isActive_idx" ON "bank_transfer_accounts"("bankName", "isActive");
