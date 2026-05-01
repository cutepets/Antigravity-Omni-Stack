CREATE TABLE IF NOT EXISTS "customer_point_history" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "actorId" TEXT,
  "delta" INTEGER NOT NULL,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_point_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_point_history_customerId_createdAt_idx"
ON "customer_point_history"("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "customer_point_history_actorId_idx"
ON "customer_point_history"("actorId");

CREATE INDEX IF NOT EXISTS "customer_point_history_source_idx"
ON "customer_point_history"("source");

ALTER TABLE "customer_point_history"
ADD CONSTRAINT "customer_point_history_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_point_history"
ADD CONSTRAINT "customer_point_history_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
