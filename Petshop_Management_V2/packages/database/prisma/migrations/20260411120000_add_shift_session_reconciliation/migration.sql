ALTER TABLE "shift_sessions"
  ADD COLUMN "expectedCloseAmount" DOUBLE PRECISION,
  ADD COLUMN "differenceAmount" DOUBLE PRECISION,
  ADD COLUMN "cashIncomeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "cashExpenseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "orderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refundCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "manualIncomeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "manualExpenseCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nonCashSummary" JSONB,
  ADD COLUMN "openDenominations" JSONB,
  ADD COLUMN "closeDenominations" JSONB,
  ADD COLUMN "summarySnapshot" JSONB,
  ADD COLUMN "lastReclosedAt" TIMESTAMP(3),
  ADD COLUMN "closeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "employeeNote" TEXT,
  ADD COLUMN "managerNote" TEXT,
  ADD COLUMN "managerConclusion" TEXT,
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT;

CREATE INDEX "shift_sessions_staffId_idx" ON "shift_sessions"("staffId");
CREATE INDEX "shift_sessions_reviewStatus_idx" ON "shift_sessions"("reviewStatus");
CREATE INDEX "shift_sessions_openedAt_idx" ON "shift_sessions"("openedAt");
