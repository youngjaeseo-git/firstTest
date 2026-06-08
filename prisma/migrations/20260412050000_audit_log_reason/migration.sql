-- Add reason and ticketRef columns to AuditLog for tracking the "why"
-- behind operator actions (status changes, power actions, deletes, etc.)

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ticketRef" TEXT;
