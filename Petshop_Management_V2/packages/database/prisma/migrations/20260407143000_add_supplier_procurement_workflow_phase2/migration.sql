ALTER TABLE "suppliers"
ADD COLUMN "creditBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "stock_receipts"
ADD COLUMN "receiptStatus" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN "totalReceivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalReturnedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "shortClosedAt" TIMESTAMP(3);

ALTER TABLE "stock_receipt_items"
ADD COLUMN "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "closedQuantity" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "stock_receipt_receives" (
  "id" TEXT NOT NULL,
  "receiveNumber" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "branchId" TEXT,
  "staffId" TEXT,
  "notes" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalQuantity" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_receipt_receives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_receipt_receive_items" (
  "id" TEXT NOT NULL,
  "receiveId" TEXT NOT NULL,
  "receiptItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "totalPrice" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_receipt_receive_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_payments" (
  "id" TEXT NOT NULL,
  "paymentNumber" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "branchId" TEXT,
  "staffId" TEXT,
  "transactionId" TEXT,
  "targetReceiptId" TEXT,
  "targetReceiptNumber" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "appliedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unappliedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentMethod" TEXT,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_payment_allocations" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_returns" (
  "id" TEXT NOT NULL,
  "returnNumber" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "branchId" TEXT,
  "staffId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "notes" TEXT,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "creditedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_return_items" (
  "id" TEXT NOT NULL,
  "returnId" TEXT NOT NULL,
  "receiptItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "totalPrice" DOUBLE PRECISION NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_return_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_return_refunds" (
  "id" TEXT NOT NULL,
  "refundNumber" TEXT NOT NULL,
  "supplierReturnId" TEXT NOT NULL,
  "branchId" TEXT,
  "staffId" TEXT,
  "transactionId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMethod" TEXT,
  "notes" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_return_refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_receipt_receives_receiveNumber_key" ON "stock_receipt_receives"("receiveNumber");
CREATE UNIQUE INDEX "supplier_payments_paymentNumber_key" ON "supplier_payments"("paymentNumber");
CREATE UNIQUE INDEX "supplier_payments_transactionId_key" ON "supplier_payments"("transactionId");
CREATE UNIQUE INDEX "supplier_returns_returnNumber_key" ON "supplier_returns"("returnNumber");
CREATE UNIQUE INDEX "supplier_return_refunds_refundNumber_key" ON "supplier_return_refunds"("refundNumber");
CREATE UNIQUE INDEX "supplier_return_refunds_transactionId_key" ON "supplier_return_refunds"("transactionId");

CREATE INDEX "stock_receipts_receiptStatus_idx" ON "stock_receipts"("receiptStatus");
CREATE INDEX "stock_receipts_paymentStatus_idx" ON "stock_receipts"("paymentStatus");
CREATE INDEX "stock_receipt_receives_receiptId_idx" ON "stock_receipt_receives"("receiptId");
CREATE INDEX "stock_receipt_receives_branchId_idx" ON "stock_receipt_receives"("branchId");
CREATE INDEX "stock_receipt_receives_staffId_idx" ON "stock_receipt_receives"("staffId");
CREATE INDEX "stock_receipt_receives_receivedAt_idx" ON "stock_receipt_receives"("receivedAt");
CREATE INDEX "stock_receipt_receive_items_receiveId_idx" ON "stock_receipt_receive_items"("receiveId");
CREATE INDEX "stock_receipt_receive_items_receiptItemId_idx" ON "stock_receipt_receive_items"("receiptItemId");
CREATE INDEX "stock_receipt_receive_items_productId_idx" ON "stock_receipt_receive_items"("productId");
CREATE INDEX "stock_receipt_receive_items_productVariantId_idx" ON "stock_receipt_receive_items"("productVariantId");
CREATE INDEX "supplier_payments_supplierId_idx" ON "supplier_payments"("supplierId");
CREATE INDEX "supplier_payments_branchId_idx" ON "supplier_payments"("branchId");
CREATE INDEX "supplier_payments_staffId_idx" ON "supplier_payments"("staffId");
CREATE INDEX "supplier_payments_targetReceiptId_idx" ON "supplier_payments"("targetReceiptId");
CREATE INDEX "supplier_payments_paidAt_idx" ON "supplier_payments"("paidAt");
CREATE INDEX "supplier_payment_allocations_paymentId_idx" ON "supplier_payment_allocations"("paymentId");
CREATE INDEX "supplier_payment_allocations_receiptId_idx" ON "supplier_payment_allocations"("receiptId");
CREATE INDEX "supplier_returns_receiptId_idx" ON "supplier_returns"("receiptId");
CREATE INDEX "supplier_returns_supplierId_idx" ON "supplier_returns"("supplierId");
CREATE INDEX "supplier_returns_branchId_idx" ON "supplier_returns"("branchId");
CREATE INDEX "supplier_returns_staffId_idx" ON "supplier_returns"("staffId");
CREATE INDEX "supplier_returns_returnedAt_idx" ON "supplier_returns"("returnedAt");
CREATE INDEX "supplier_return_items_returnId_idx" ON "supplier_return_items"("returnId");
CREATE INDEX "supplier_return_items_receiptItemId_idx" ON "supplier_return_items"("receiptItemId");
CREATE INDEX "supplier_return_items_productId_idx" ON "supplier_return_items"("productId");
CREATE INDEX "supplier_return_items_productVariantId_idx" ON "supplier_return_items"("productVariantId");
CREATE INDEX "supplier_return_refunds_supplierReturnId_idx" ON "supplier_return_refunds"("supplierReturnId");
CREATE INDEX "supplier_return_refunds_branchId_idx" ON "supplier_return_refunds"("branchId");
CREATE INDEX "supplier_return_refunds_staffId_idx" ON "supplier_return_refunds"("staffId");
CREATE INDEX "supplier_return_refunds_receivedAt_idx" ON "supplier_return_refunds"("receivedAt");

ALTER TABLE "stock_receipt_receives"
ADD CONSTRAINT "stock_receipt_receives_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "stock_receipt_receives_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "stock_receipt_receives_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_receipt_receive_items"
ADD CONSTRAINT "stock_receipt_receive_items_receiveId_fkey" FOREIGN KEY ("receiveId") REFERENCES "stock_receipt_receives"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "stock_receipt_receive_items_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "stock_receipt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "stock_receipt_receive_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "stock_receipt_receive_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_payments"
ADD CONSTRAINT "supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_payments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_payment_allocations"
ADD CONSTRAINT "supplier_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_payment_allocations_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_returns"
ADD CONSTRAINT "supplier_returns_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_returns_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_returns_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_returns_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_return_items"
ADD CONSTRAINT "supplier_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "supplier_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_return_items_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "stock_receipt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_return_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_return_refunds"
ADD CONSTRAINT "supplier_return_refunds_supplierReturnId_fkey" FOREIGN KEY ("supplierReturnId") REFERENCES "supplier_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_return_refunds_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "supplier_return_refunds_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "stock_receipts"
SET
  "receiptStatus" = CASE
    WHEN "status" = 'CANCELLED' THEN 'CANCELLED'
    WHEN "status" = 'RECEIVED' THEN 'FULL_RECEIVED'
    ELSE 'DRAFT'
  END,
  "paymentStatus" = CASE
    WHEN COALESCE("paidAmount", 0) <= 0 THEN 'UNPAID'::"PaymentStatus"
    WHEN COALESCE("paidAmount", 0) < COALESCE("totalAmount", 0) THEN 'PARTIAL'::"PaymentStatus"
    ELSE 'PAID'::"PaymentStatus"
  END,
  "totalReceivedAmount" = CASE
    WHEN "status" = 'RECEIVED' THEN COALESCE("totalAmount", 0)
    ELSE 0
  END,
  "completedAt" = CASE
    WHEN "status" = 'RECEIVED' THEN COALESCE("receivedAt", "createdAt")
    ELSE NULL
  END,
  "cancelledAt" = CASE
    WHEN "status" = 'CANCELLED' THEN COALESCE("updatedAt", "createdAt")
    ELSE NULL
  END;

UPDATE "stock_receipt_items" AS "item"
SET "receivedQuantity" = CASE
    WHEN "receipt"."status" = 'RECEIVED' THEN COALESCE("item"."quantity", 0)
    ELSE 0
  END
FROM "stock_receipts" AS "receipt"
WHERE "receipt"."id" = "item"."receiptId";
