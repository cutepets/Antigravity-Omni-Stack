-- Allow super admins to remove staff accounts while preserving business records.
ALTER TABLE "orders" ALTER COLUMN "staffId" DROP NOT NULL;
ALTER TABLE "shift_sessions" ALTER COLUMN "staffId" DROP NOT NULL;
ALTER TABLE "stock_count_sessions" ALTER COLUMN "createdBy" DROP NOT NULL;
ALTER TABLE "order_timelines" ALTER COLUMN "performedBy" DROP NOT NULL;
ALTER TABLE "grooming_timelines" ALTER COLUMN "performedBy" DROP NOT NULL;
ALTER TABLE "hotel_stay_timelines" ALTER COLUMN "performedBy" DROP NOT NULL;
ALTER TABLE "hotel_stay_health_logs" ALTER COLUMN "performedBy" DROP NOT NULL;

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_staffId_fkey";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shift_sessions" DROP CONSTRAINT IF EXISTS "shift_sessions_staffId_fkey";
ALTER TABLE "shift_sessions"
  ADD CONSTRAINT "shift_sessions_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_count_sessions" DROP CONSTRAINT IF EXISTS "stock_count_sessions_createdBy_fkey";
ALTER TABLE "stock_count_sessions"
  ADD CONSTRAINT "stock_count_sessions_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_timelines" DROP CONSTRAINT IF EXISTS "order_timelines_performedBy_fkey";
ALTER TABLE "order_timelines"
  ADD CONSTRAINT "order_timelines_performedBy_fkey"
  FOREIGN KEY ("performedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "grooming_timelines" DROP CONSTRAINT IF EXISTS "grooming_timelines_performedBy_fkey";
ALTER TABLE "grooming_timelines"
  ADD CONSTRAINT "grooming_timelines_performedBy_fkey"
  FOREIGN KEY ("performedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hotel_stay_timelines" DROP CONSTRAINT IF EXISTS "hotel_stay_timelines_performedBy_fkey";
ALTER TABLE "hotel_stay_timelines"
  ADD CONSTRAINT "hotel_stay_timelines_performedBy_fkey"
  FOREIGN KEY ("performedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hotel_stay_health_logs" DROP CONSTRAINT IF EXISTS "hotel_stay_health_logs_performedBy_fkey";
ALTER TABLE "hotel_stay_health_logs"
  ADD CONSTRAINT "hotel_stay_health_logs_performedBy_fkey"
  FOREIGN KEY ("performedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
