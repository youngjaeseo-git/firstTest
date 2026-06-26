import { prisma } from "@/lib/db";
import { instantQuery } from "@/lib/prometheus";

export interface AlertCheckResult {
  rulesChecked: number;
  alertsCreated: number;
  alertsResolved: number;
  errors: number;
}

function parseCondition(condition: string): { op: string; threshold: number } | null {
  const match = condition.trim().match(/^([><=!]+)\s*(-?[\d.]+)$/);
  if (!match) return null;
  return { op: match[1], threshold: parseFloat(match[2]) };
}

function evaluateCondition(value: number, op: string, threshold: number): boolean {
  switch (op) {
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    case "==": return value === threshold;
    case "!=": return value !== threshold;
    default: return false;
  }
}

export async function runAlertCheck(): Promise<AlertCheckResult> {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
  });

  let alertsCreated = 0;
  let alertsResolved = 0;
  let errors = 0;

  for (const rule of rules) {
    try {
      const parsed = parseCondition(rule.condition);
      if (!parsed) {
        errors++;
        continue;
      }

      const result = await instantQuery(rule.metric);
      const series = result?.data?.result ?? [];

      const firingSourcesNow = new Set<string>();

      for (const s of series) {
        const value = parseFloat(s.value?.[1] ?? "0");
        if (!evaluateCondition(value, parsed.op, parsed.threshold)) continue;

        const source = s.metric?.instance || s.metric?.hostname || s.metric?.job || "unknown";
        firingSourcesNow.add(source);

        const existing = await prisma.alert.findFirst({
          where: { ruleId: rule.id, source, status: "FIRING" },
        });
        if (existing) continue;

        await prisma.alert.create({
          data: {
            ruleId: rule.id,
            severity: rule.severity,
            category: rule.category,
            summary: `[${rule.name}] ${source}: ${value} ${rule.condition}`,
            details: `PromQL: ${rule.metric}\n값: ${value}, 조건: ${rule.condition}`,
            source,
            status: "FIRING",
          },
        });
        alertsCreated++;
      }

      const openAlerts = await prisma.alert.findMany({
        where: { ruleId: rule.id, status: "FIRING" },
      });
      for (const alert of openAlerts) {
        if (alert.source && !firingSourcesNow.has(alert.source)) {
          await prisma.alert.update({
            where: { id: alert.id },
            data: { status: "RESOLVED", resolvedAt: new Date() },
          });
          alertsResolved++;
        }
      }
    } catch {
      errors++;
    }
  }

  return { rulesChecked: rules.length, alertsCreated, alertsResolved, errors };
}
