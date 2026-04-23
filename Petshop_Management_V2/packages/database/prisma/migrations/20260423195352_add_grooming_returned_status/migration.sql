-- Add RETURNED enum value to GroomingStatus
ALTER TYPE "GroomingStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

-- Add contactStatus field to grooming_sessions
ALTER TABLE "grooming_sessions"
  ADD COLUMN IF NOT EXISTS "contactStatus" TEXT DEFAULT 'UNCALLED';
