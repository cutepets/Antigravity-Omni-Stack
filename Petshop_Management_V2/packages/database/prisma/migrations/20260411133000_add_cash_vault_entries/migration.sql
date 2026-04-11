CREATE TABLE "cash_vault_entries" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "shiftSessionId" TEXT,
    "cashBeforeAmount" DOUBLE PRECISION,
    "cashAfterAmount" DOUBLE PRECISION NOT NULL,
    "deltaAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetReserveAmount" DOUBLE PRECISION,
    "note" TEXT,
    "performedById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_vault_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_vault_entries_shiftSessionId_key" ON "cash_vault_entries"("shiftSessionId");
CREATE INDEX "cash_vault_entries_branchId_idx" ON "cash_vault_entries"("branchId");
CREATE INDEX "cash_vault_entries_entryType_idx" ON "cash_vault_entries"("entryType");
CREATE INDEX "cash_vault_entries_occurredAt_idx" ON "cash_vault_entries"("occurredAt");
CREATE INDEX "cash_vault_entries_performedById_idx" ON "cash_vault_entries"("performedById");

ALTER TABLE "cash_vault_entries" ADD CONSTRAINT "cash_vault_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_vault_entries" ADD CONSTRAINT "cash_vault_entries_shiftSessionId_fkey" FOREIGN KEY ("shiftSessionId") REFERENCES "shift_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_vault_entries" ADD CONSTRAINT "cash_vault_entries_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "cash_vault_entries" (
    "id",
    "branchId",
    "entryType",
    "shiftSessionId",
    "cashBeforeAmount",
    "cashAfterAmount",
    "deltaAmount",
    "collectedAmount",
    "targetReserveAmount",
    "note",
    "performedById",
    "occurredAt",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('cve_', MD5("id")),
    "branchId",
    'SHIFT_CLOSE',
    "id",
    NULL,
    "closeAmount",
    "closeAmount",
    0,
    2000000,
    'Backfill from closed cash shift',
    "staffId",
    COALESCE("closedAt", "openedAt"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "shift_sessions"
WHERE "status" = 'CLOSED'
  AND "closeAmount" IS NOT NULL;
