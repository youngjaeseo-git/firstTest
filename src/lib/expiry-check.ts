import { prisma } from "@/lib/db";
import type { AlertSeverity } from "@prisma/client";

export interface ExpiryCheckResult {
  checked: number;
  expired: number;
  alertsCreated: number;
  alertsEscalated: number;
}

function severityFor(daysLeft: number): AlertSeverity {
  if (daysLeft < 0) return "CRITICAL";
  if (daysLeft <= 7) return "WARNING";
  return "INFO";
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
};

/**
 * Scan all ACTIVE expiry items and raise/escalate alerts.
 * - Items past their date are flipped to EXPIRED and raise a CRITICAL alert.
 * - Items within notifyDays raise a WARNING (<=7d) or INFO alert.
 * - An existing open alert is escalated in place if the situation worsened,
 *   so an INFO warning becomes CRITICAL when the item actually expires
 *   (instead of being silently deduped).
 *
 * Shared by the manual check endpoint and the cron endpoint.
 */
export async function runExpiryCheck(): Promise<ExpiryCheckResult> {
  const now = new Date();
  const items = await prisma.expiryTracker.findMany({
    where: { status: "ACTIVE" },
  });

  let alertsCreated = 0;
  let alertsEscalated = 0;
  let expiredCount = 0;

  for (const item of items) {
    const daysLeft = Math.ceil(
      (item.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const isExpired = daysLeft < 0;
    const shouldAlert = isExpired || daysLeft <= item.notifyDays;

    if (isExpired) {
      await prisma.expiryTracker.update({
        where: { id: item.id },
        data: { status: "EXPIRED" },
      });
      expiredCount++;
    }

    if (!shouldAlert) continue;

    const severity = severityFor(daysLeft);
    const summary = isExpired
      ? `[만료] ${item.name} — ${Math.abs(daysLeft)}일 경과`
      : `[만기 ${daysLeft}일 전] ${item.name}`;
    const details = `카테고리: ${item.category}, 만기일: ${item.expiresAt
      .toISOString()
      .slice(0, 10)}, 출처: ${item.source || "-"}`;

    const existing = await prisma.alert.findFirst({
      where: { source: `expiry:${item.id}`, status: "FIRING" },
    });

    if (!existing) {
      await prisma.alert.create({
        data: {
          severity,
          category: "expiry",
          summary,
          details,
          source: `expiry:${item.id}`,
          status: "FIRING",
        },
      });
      alertsCreated++;
    } else if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) {
      // Situation worsened (e.g. WARNING → CRITICAL): escalate in place.
      await prisma.alert.update({
        where: { id: existing.id },
        data: { severity, summary, details },
      });
      alertsEscalated++;
    }
  }

  return {
    checked: items.length,
    expired: expiredCount,
    alertsCreated,
    alertsEscalated,
  };
}
