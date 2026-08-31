import { prisma } from "@/lib/db";
import { instantQuery } from "@/lib/prometheus";

/**
 * Build a bidirectional hostname↔IP map from pre-fetched data.
 * Use when the caller already has Equipment + PrometheusTarget data (e.g. dashboard page).
 */
export function buildHostnameIpMapFromData(
  equipments: { hostname: string | null; ipAddress: string | null }[],
  promTargets: { instance: string; hostname: string | null }[],
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const e of equipments) {
    if (e.hostname && e.ipAddress) {
      map[e.hostname] = e.ipAddress;
      map[e.ipAddress] = e.hostname;
    }
  }

  for (const pt of promTargets) {
    const ip = pt.instance.replace(/:\d+$/, "");
    if (pt.hostname && !map[ip]) {
      map[ip] = pt.hostname;
      map[pt.hostname] = ip;
    }
  }

  return map;
}

/**
 * Build a bidirectional hostname↔IP map from DB.
 * Optionally queries Prometheus node_uname_info to fill gaps
 * (handles servers not yet registered in Equipment table).
 */
export async function buildHostnameIpMap(options?: {
  withPrometheusFallback?: boolean;
}): Promise<Record<string, string>> {
  const [equipments, promTargets] = await Promise.all([
    prisma.equipment.findMany({
      where: { ipAddress: { not: null } },
      select: { hostname: true, ipAddress: true },
    }),
    prisma.prometheusTarget.findMany({
      where: { hostname: { not: null } },
      select: { instance: true, hostname: true },
    }),
  ]);

  const map = buildHostnameIpMapFromData(equipments, promTargets);

  if (options?.withPrometheusFallback) {
    try {
      const unameResult = await instantQuery("node_uname_info");
      for (const r of unameResult.data?.result ?? []) {
        const instance = r.metric?.instance || "";
        const nodename = r.metric?.nodename || "";
        if (!instance || !nodename) continue;
        const ip = instance.replace(/:.*/, "");
        if (!map[ip]) {
          map[ip] = nodename;
          map[nodename] = ip;
        }
      }
    } catch {
      // Prometheus unavailable — continue with DB data only
    }
  }

  return map;
}
