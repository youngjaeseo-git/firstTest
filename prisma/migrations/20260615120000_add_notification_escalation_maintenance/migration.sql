-- ============================================
-- 1. MaintenanceWindow: alter existing table
-- ============================================

-- Add new columns (targetValue replaces targetId)
ALTER TABLE "MaintenanceWindow" ADD COLUMN IF NOT EXISTS "targetValue" TEXT;
ALTER TABLE "MaintenanceWindow" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MaintenanceWindow" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- Set default for targetType (existing rows already have a value)
ALTER TABLE "MaintenanceWindow" ALTER COLUMN "targetType" SET DEFAULT 'all';

-- Make targetId nullable then drop (data migrated to targetValue)
ALTER TABLE "MaintenanceWindow" ALTER COLUMN "targetId" DROP NOT NULL;

-- Copy targetId -> targetValue for existing rows, then drop targetId
UPDATE "MaintenanceWindow" SET "targetValue" = "targetId" WHERE "targetValue" IS NULL AND "targetId" IS NOT NULL;
ALTER TABLE "MaintenanceWindow" DROP COLUMN IF EXISTS "targetId";

-- Add index for time-range queries
CREATE INDEX IF NOT EXISTS "MaintenanceWindow_startTime_endTime_idx" ON "MaintenanceWindow"("startTime", "endTime");

-- ============================================
-- 2. NotificationChannel: new table
-- ============================================

CREATE TABLE IF NOT EXISTS "NotificationChannel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "minSeverity" TEXT NOT NULL DEFAULT 'WARNING',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationChannel_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- 3. EscalationPolicy: new table
-- ============================================

CREATE TABLE IF NOT EXISTS "EscalationPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL,
    "afterMinutes" INTEGER NOT NULL,
    "channelId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
ALTER TABLE "EscalationPolicy" ADD CONSTRAINT "EscalationPolicy_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "NotificationChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
