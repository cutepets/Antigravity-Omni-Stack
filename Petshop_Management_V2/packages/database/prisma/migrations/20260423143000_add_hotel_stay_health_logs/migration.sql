-- CreateTable
CREATE TABLE "hotel_stay_health_logs" (
    "id" TEXT NOT NULL,
    "hotelStayId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "appetite" TEXT,
    "stool" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_stay_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_stay_health_logs_hotelStayId_createdAt_idx" ON "hotel_stay_health_logs"("hotelStayId", "createdAt");

-- CreateIndex
CREATE INDEX "hotel_stay_health_logs_petId_createdAt_idx" ON "hotel_stay_health_logs"("petId", "createdAt");

-- CreateIndex
CREATE INDEX "hotel_stay_health_logs_performedBy_idx" ON "hotel_stay_health_logs"("performedBy");

-- AddForeignKey
ALTER TABLE "hotel_stay_health_logs" ADD CONSTRAINT "hotel_stay_health_logs_hotelStayId_fkey" FOREIGN KEY ("hotelStayId") REFERENCES "hotel_stays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_stay_health_logs" ADD CONSTRAINT "hotel_stay_health_logs_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_stay_health_logs" ADD CONSTRAINT "hotel_stay_health_logs_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
