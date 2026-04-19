CREATE TABLE "pet_timelines" (
    "id"        TEXT NOT NULL,
    "petId"     TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "note"      TEXT,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_timelines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pet_timelines_petId_idx" ON "pet_timelines"("petId");
CREATE INDEX "pet_timelines_createdAt_idx" ON "pet_timelines"("createdAt");

ALTER TABLE "pet_timelines"
ADD CONSTRAINT "pet_timelines_petId_fkey"
FOREIGN KEY ("petId") REFERENCES "pets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
