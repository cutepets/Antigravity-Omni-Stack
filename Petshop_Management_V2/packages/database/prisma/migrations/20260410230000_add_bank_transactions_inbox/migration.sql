CREATE TYPE "BankTransactionStatus" AS ENUM (
    'RECEIVED',
    'SUGGESTED',
    'APPLIED',
    'REVIEW',
    'DUPLICATE',
    'IGNORED',
    'REJECTED'
);

CREATE TYPE "BankTransactionClassification" AS ENUM (
    'UNCLASSIFIED',
    'SALES_PAYMENT',
    'SUPPLIER_PAYMENT',
    'CUSTOMER_CREDIT',
    'MANUAL_TRANSACTION'
);

CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "sourceEventKey" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "externalEventId" TEXT,
    "externalTxnId" TEXT,
    "bankBin" TEXT,
    "accountNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "direction" TEXT NOT NULL DEFAULT 'IN',
    "description" TEXT NOT NULL,
    "normalizedDescription" TEXT NOT NULL,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'RECEIVED',
    "classification" "BankTransactionClassification" NOT NULL DEFAULT 'UNCLASSIFIED',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "matchedPaymentIntentId" TEXT,
    "matchedOrderId" TEXT,
    "matchedPaymentMethodId" TEXT,
    "matchReason" TEXT,
    "note" TEXT,
    "txnAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_transactions_provider_createdAt_idx"
ON "bank_transactions"("provider", "createdAt");

CREATE INDEX "bank_transactions_sourceEventKey_idx"
ON "bank_transactions"("sourceEventKey");

CREATE INDEX "bank_transactions_dedupeKey_idx"
ON "bank_transactions"("dedupeKey");

CREATE INDEX "bank_transactions_status_createdAt_idx"
ON "bank_transactions"("status", "createdAt");

CREATE INDEX "bank_transactions_classification_createdAt_idx"
ON "bank_transactions"("classification", "createdAt");

CREATE INDEX "bank_transactions_isTest_createdAt_idx"
ON "bank_transactions"("isTest", "createdAt");

CREATE INDEX "bank_transactions_accountNumber_amount_createdAt_idx"
ON "bank_transactions"("accountNumber", "amount", "createdAt");

CREATE INDEX "bank_transactions_matchedPaymentIntentId_idx"
ON "bank_transactions"("matchedPaymentIntentId");

ALTER TABLE "bank_transactions"
ADD CONSTRAINT "bank_transactions_matchedPaymentIntentId_fkey"
FOREIGN KEY ("matchedPaymentIntentId") REFERENCES "payment_intents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transactions"
ADD CONSTRAINT "bank_transactions_matchedOrderId_fkey"
FOREIGN KEY ("matchedOrderId") REFERENCES "orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_transactions"
ADD CONSTRAINT "bank_transactions_matchedPaymentMethodId_fkey"
FOREIGN KEY ("matchedPaymentMethodId") REFERENCES "payment_methods"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_webhook_events"
ADD COLUMN "bankTransactionId" TEXT;

CREATE INDEX "payment_webhook_events_bankTransactionId_idx"
ON "payment_webhook_events"("bankTransactionId");

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_bankTransactionId_fkey"
FOREIGN KEY ("bankTransactionId") REFERENCES "bank_transactions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
