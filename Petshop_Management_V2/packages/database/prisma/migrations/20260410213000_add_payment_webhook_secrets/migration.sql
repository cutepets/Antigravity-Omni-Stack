CREATE TABLE "payment_webhook_secrets" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "secretPreview" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_secrets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_secrets_provider_name_key"
ON "payment_webhook_secrets"("provider", "name");

CREATE INDEX "payment_webhook_secrets_provider_createdAt_idx"
ON "payment_webhook_secrets"("provider", "createdAt");

CREATE INDEX "payment_webhook_secrets_secretHash_idx"
ON "payment_webhook_secrets"("secretHash");
