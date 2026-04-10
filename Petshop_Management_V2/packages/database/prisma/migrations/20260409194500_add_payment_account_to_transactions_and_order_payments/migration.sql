ALTER TABLE "order_payments"
ADD COLUMN "note" TEXT,
ADD COLUMN "paymentAccountId" TEXT,
ADD COLUMN "paymentAccountLabel" TEXT;

ALTER TABLE "transactions"
ADD COLUMN "paymentAccountId" TEXT,
ADD COLUMN "paymentAccountLabel" TEXT;

CREATE INDEX "order_payments_paymentAccountId_idx" ON "order_payments"("paymentAccountId");
CREATE INDEX "transactions_paymentAccountId_idx" ON "transactions"("paymentAccountId");
