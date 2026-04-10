CREATE TYPE "PaymentWebhookEventStatus" AS ENUM (
    'RECEIVED',
    'DUPLICATE',
    'UNMATCHED',
    'APPLIED',
    'IGNORED_ALREADY_PAID',
    'REJECTED'
);

CREATE TABLE "payment_webhook_events" (
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
    "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "duplicateOfId" TEXT,
    "matchedPaymentIntentId" TEXT,
    "matchedOrderId" TEXT,
    "matchedPaymentMethodId" TEXT,
    "matchReason" TEXT,
    "note" TEXT,
    "txnAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_webhook_events_provider_createdAt_idx" ON "payment_webhook_events"("provider", "createdAt");
CREATE INDEX "payment_webhook_events_sourceEventKey_idx" ON "payment_webhook_events"("sourceEventKey");
CREATE INDEX "payment_webhook_events_dedupeKey_idx" ON "payment_webhook_events"("dedupeKey");
CREATE INDEX "payment_webhook_events_status_createdAt_idx" ON "payment_webhook_events"("status", "createdAt");
CREATE INDEX "payment_webhook_events_accountNumber_amount_createdAt_idx" ON "payment_webhook_events"("accountNumber", "amount", "createdAt");
CREATE INDEX "payment_webhook_events_matchedPaymentIntentId_idx" ON "payment_webhook_events"("matchedPaymentIntentId");

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_duplicateOfId_fkey"
FOREIGN KEY ("duplicateOfId") REFERENCES "payment_webhook_events"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_matchedPaymentIntentId_fkey"
FOREIGN KEY ("matchedPaymentIntentId") REFERENCES "payment_intents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_matchedOrderId_fkey"
FOREIGN KEY ("matchedOrderId") REFERENCES "orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_matchedPaymentMethodId_fkey"
FOREIGN KEY ("matchedPaymentMethodId") REFERENCES "payment_methods"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
