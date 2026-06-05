import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { instantQuery } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export async function GET() {
  const emptyResult = { data: { result: [] as { metric?: Record<string, string>; value?: [number, string] }[] } };
  const [equipments, tempResult, unameResult] = await Promise.all([
    prisma.equipment.findMany({
      where: { hostname: { not: null }, ipAddress: { not: null } },
      select: { hostname: true, ipAddress: true },
    }),
    // Degrade gracefully if Prometheus is unreachable rather than 500-ing
    instantQuery(`avg by (instance) (node_hwmon_temp_celsius)`).catch(() => emptyResult),
    instantQuery(`node_uname_info`).catch(() => emptyResult),
  ]);

  const ipToHostname: Record<string, string> = {};

  for (const eq of equipments) {
    if (eq.ipAddress && eq.hostname) {
      ipToHostname[eq.ipAddress] = eq.hostname;
    }
  }

  for (const r of unameResult.data?.result ?? []) {
    const instance = r.metric?.instance || "";
    const nodename = r.metric?.nodename || "";
    if (!instance || !nodename) continue;
    const ip = instance.replace(/:.*/, "");
    if (!ipToHostname[ip]) {
      ipToHostname[ip] = nodename;
    }
  }

  const nodeTemps: Record<string, number> = {};
  for (const r of tempResult.data?.result ?? []) {
    const instance = r.metric?.instance || "";
    const ip = instance.replace(/:.*/, "");
    const val = r.value ? parseFloat(r.value[1]) : NaN;
    if (isNaN(val)) continue;

    const hostname = ipToHostname[ip];
    if (hostname) {
      nodeTemps[hostname] = Math.round(val * 10) / 10;
    }
    nodeTemps[ip] = Math.round(val * 10) / 10;
  }

  return NextResponse.json(nodeTemps);
}
