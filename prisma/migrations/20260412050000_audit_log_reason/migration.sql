-- Add reason and ticketRef columns to AuditLog for tracking the "why"
-- behind operator actions (status changes, power actions, deletes, etc.)

ALTER TABLE "AuditLog" ADD COLUMN "reason" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "ticketRef" TEXT;
