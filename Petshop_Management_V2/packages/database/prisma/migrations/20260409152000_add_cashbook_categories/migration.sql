CREATE TYPE "CashbookCategoryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "cashbook_categories" (
  "id" TEXT NOT NULL,
  "type" "CashbookCategoryType" NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cashbook_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cashbook_categories_type_name_key" ON "cashbook_categories"("type", "name");
CREATE INDEX "cashbook_categories_type_isActive_sortOrder_idx" ON "cashbook_categories"("type", "isActive", "sortOrder");
