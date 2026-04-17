-- Migration: Add Order Return Request tables and exchange order fields
-- 2026-04-18T00:00:00Z

-- Add exchange order fields to orders table
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "linkedReturnId" TEXT,
  ADD COLUMN IF NOT EXISTS "creditAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create order_return_requests table
CREATE TABLE IF NOT EXISTS "order_return_requests" (
  "id"            TEXT NOT NULL,
  "orderId"       TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "reason"        TEXT,
  "refundAmount"  DOUBLE PRECISION DEFAULT 0,
  "refundMethod"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "performedBy"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "order_return_requests_pkey" PRIMARY KEY ("id")
);

-- Create order_return_items table
CREATE TABLE IF NOT EXISTS "order_return_items" (
  "id"              TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "orderItemId"     TEXT NOT NULL,
  "quantity"        DOUBLE PRECISION NOT NULL,
  "action"          TEXT NOT NULL,
  "reason"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_return_items_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "order_return_requests"
  ADD CONSTRAINT "order_return_requests_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_return_items"
  ADD CONSTRAINT "order_return_items_returnRequestId_fkey"
    FOREIGN KEY ("returnRequestId") REFERENCES "order_return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_return_items"
  ADD CONSTRAINT "order_return_items_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "order_return_requests_orderId_idx"     ON "order_return_requests"("orderId");
CREATE INDEX IF NOT EXISTS "order_return_requests_performedBy_idx" ON "order_return_requests"("performedBy");
CREATE INDEX IF NOT EXISTS "order_return_requests_createdAt_idx"   ON "order_return_requests"("createdAt");
CREATE INDEX IF NOT EXISTS "order_return_items_returnRequestId_idx" ON "order_return_items"("returnRequestId");
CREATE INDEX IF NOT EXISTS "order_return_items_orderItemId_idx"    ON "order_return_items"("orderItemId");
