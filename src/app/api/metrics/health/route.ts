export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL || "http://10.100.175.248:8080";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {
    promUrl: PROMETHEUS_URL,
    timestamp: new Date().toISOString(),
  };

  // Get a real equipment to test instance-filtered query
  let sampleInstance = "";
  let sampleIp = "";
  try {
    const eq = await prisma.equipment.findFirst({
      where: { ipAddress: { not: null } },
      include: { prometheusTarget: true },
      orderBy: { createdAt: "asc" },
    });
    sampleInstance = eq?.prometheusInstance || eq?.prometheusTarget?.instance || (eq?.ipAddress ? `${eq.ipAddress}:10250` : "");
    sampleIp = eq?.ipAddress || "";
    results.sampleEquipment = {
      hostname: eq?.hostname,
      ip: eq?.ipAddress,
      instance: sampleInstance,
      promInstance: eq?.prometheusInstance,
      targetInstance: eq?.prometheusTarget?.instance,
    };
  } catch (err) {
    results.dbError = err instanceof Error ? err.message : String(err);
  }

  const addr = sampleIp ? escapeRe(sampleIp) : escapeRe(sampleInstance.split(":")[0]);
  const end = new Date();
  const start = new Date(end.getTime() - 5 * 60 * 1000);

  const testQueries: Record<string, { query: string; useCache: boolean }> = {
    "1_simple": { query: "up", useCache: false },
    "2_simple_cached": { query: "up", useCache: true },
    "3_instance_nocache": {
      query: `node_cpu_seconds_total{mode="idle",instance=~"${addr}(:.*)?",job="node-exporter"}`,
      useCache: false,
    },
    "4_instance_cached": {
      query: `node_cpu_seconds_total{mode="idle",instance=~"${addr}(:.*)?",job="node-exporter"}`,
      useCache: true,
    },
    "5_full_cpu": {
      query: `(1 - avg(rate(node_cpu_seconds_total{mode="idle",instance=~"${addr}(:.*)?",job="node-exporter"}[5m]))) * 100`,
      useCache: true,
    },
  };

  for (const [name, test] of Object.entries(testQueries)) {
    try {
      const url = new URL("/api/v1/query_range", PROMETHEUS_URL);
      url.searchParams.set("query", test.query);
      url.searchParams.set("start", (start.getTime() / 1000).toString());
      url.searchParams.set("end", (end.getTime() / 1000).toString());
      url.searchParams.set("step", "30s");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const fetchOptions: RequestInit = { signal: controller.signal };
      if (test.useCache) {
        (fetchOptions as Record<string, unknown>).next = { revalidate: 15 };
      }
      const res = await fetch(url.toString(), fetchOptions);
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        const count = json.data?.result?.length ?? 0;
        results[name] = { ok: true, status: res.status, results: count };
      } else {
        const body = await res.text();
        results[name] = { ok: false, status: res.status, error: body.slice(0, 300) };
      }
    } catch (err) {
      results[name] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        type: err instanceof Error ? err.constructor.name : typeof err,
      };
    }
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
