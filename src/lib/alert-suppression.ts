import { prisma } from "@/lib/db";

export interface SuppressionWindow {
  targetType: string;
  targetValue: string | null;
}

/**
 * Maintenance windows that are enabled and active right now.
 * Returns [] if the table doesn't exist yet (pre-migration) so callers
 * never break before `prisma db push` has run on the server.
 */
export async function getActiveMaintenanceWindows(): Promise<SuppressionWindow[]> {
  try {
    const now = new Date();
    return await prisma.maintenanceWindow.findMany({
      where: { enabled: true, startTime: { lte: now }, endTime: { gte: now } },
      select: { targetType: true, targetValue: true },
    });
  } catch {
    return [];
  }
}

/** Whether an alert is covered by any active maintenance window. */
export function isAlertSuppressed(
  alert: { source?: string | null; category?: string | null },
  windows: SuppressionWindow[],
): boolean {
  return windows.some((w) => {
    if (w.targetType === "all") return true;
    if (w.targetType === "source") {
      return !!alert.source && !!w.targetValue && alert.source === w.targetValue;
    }
    if (w.targetType === "category") {
      return !!alert.category && !!w.targetValue && alert.category === w.targetValue;
    }
    return false;
  });
}
