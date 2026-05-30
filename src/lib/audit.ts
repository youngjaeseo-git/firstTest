/**
 * Audit logging helper.
 *
 * Centralized so every mutation in the API layer logs *who*, *what*,
 * *which entity*, and *why* with a single call.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "POWER_ACTION"
  | "RACK_MOVE"
  | "MAINTENANCE_START"
  | "MAINTENANCE_END"
  | "BULK_POWER"
  | "BULK_REFRESH_HW";

export type AuditEntityType =
  | "Equipment"
  | "Rack"
  | "Room"
  | "DataCenter"
  | "User"
  | "AlertRule"
  | "Alert";

export interface AuditLogInput {
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  /** Field-level diff or arbitrary action detail */
  changes?: Record<string, unknown>;
  /** Operator-supplied "why" — strongly recommended for destructive ops */
  reason?: string | null;
  /** External ticket reference (Jira, ServiceNow, etc.) */
  ticketRef?: string | null;
}

/**
 * Persist an audit log entry. Failures are logged but never thrown,
 * because losing an audit row should not break the user-facing operation
 * that triggered it.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        changes:
          input.changes !== undefined
            ? (input.changes as Prisma.InputJsonValue)
            : undefined,
        reason: input.reason ?? null,
        ticketRef: input.ticketRef ?? null,
      },
    });
  } catch (err) {
    // Never throw from the audit path; surface to server logs.
    console.error("[audit] failed to record entry", { input, err });
  }
}

/**
 * Compute a shallow field-level diff between two objects.
 * Useful for UPDATE actions that want a clean `changes` payload.
 */
export function diffShallow(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  );
  for (const key of keys) {
    if (before[key] !== after[key]) {
      out[key] = { from: before[key], to: after[key] };
    }
  }
  return out;
}
