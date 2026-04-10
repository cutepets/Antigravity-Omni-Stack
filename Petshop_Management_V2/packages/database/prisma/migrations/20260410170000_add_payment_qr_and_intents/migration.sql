CREATE TYPE "PaymentQrProvider" AS ENUM ('VIETQR');

CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED');

ALTER TABLE "payment_methods"
ADD COLUMN "qrEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qrProvider" "PaymentQrProvider",
ADD COLUMN "qrBankBin" TEXT,
ADD COLUMN "qrTemplate" TEXT,
ADD COLUMN "transferNotePrefix" TEXT;

CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT,
    "branchId" TEXT,
    "paymentMethodId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentQrProvider",
    "transferContent" TEXT NOT NULL,
    "qrUrl" TEXT,
    "qrPayload" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_intents_code_key" ON "payment_intents"("code");
CREATE INDEX "payment_intents_orderId_idx" ON "payment_intents"("orderId");
CREATE INDEX "payment_intents_branchId_idx" ON "payment_intents"("branchId");
CREATE INDEX "payment_intents_paymentMethodId_idx" ON "payment_intents"("paymentMethodId");
CREATE INDEX "payment_intents_status_expiresAt_idx" ON "payment_intents"("status", "expiresAt");

ALTER TABLE "payment_intents"
ADD CONSTRAINT "payment_intents_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_intents"
ADD CONSTRAINT "payment_intents_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_intents"
ADD CONSTRAINT "payment_intents_paymentMethodId_fkey"
FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
