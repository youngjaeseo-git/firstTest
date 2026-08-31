import { NextResponse } from "next/server";
import { instantQuery } from "@/lib/prometheus";
import { buildHostnameIpMap } from "@/lib/hostname-resolver";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const emptyResult = { data: { result: [] as { metric?: Record<string, string>; value?: [number, string] }[] } };
  const [hostnameIpMap, tempResult] = await Promise.all([
    buildHostnameIpMap({ withPrometheusFallback: true }),
    instantQuery(`avg by (instance) (node_hwmon_temp_celsius)`).catch(() => emptyResult),
  ]);

  const nodeTemps: Record<string, number> = {};
  for (const r of tempResult.data?.result ?? []) {
    const instance = r.metric?.instance || "";
    const ip = instance.replace(/:.*/, "");
    const val = r.value ? parseFloat(r.value[1]) : NaN;
    if (isNaN(val)) continue;

    const hostname = hostnameIpMap[ip];
    if (hostname) {
      nodeTemps[hostname] = Math.round(val * 10) / 10;
    }
    nodeTemps[ip] = Math.round(val * 10) / 10;
  }

  return NextResponse.json(nodeTemps);
}
