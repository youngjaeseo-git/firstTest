export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL || "http://10.100.175.248:8080";

export async function GET(req: NextRequest) {
  const results: Record<string, unknown> = {
    promUrl: PROMETHEUS_URL,
    timestamp: new Date().toISOString(),
  };

  const testQueries: Record<string, string> = {
    simple: "up",
    cpuNE: '(1 - avg(rate(node_cpu_seconds_total{mode="idle",job="node-exporter"}[5m]))) * 100',
    memNE: 'node_memory_MemTotal_bytes{job="node-exporter"}',
    cpuCA: 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m]))',
    orQuery:
      '(1 - avg(rate(node_cpu_seconds_total{mode="idle",job="node-exporter"}[5m]))) * 100' +
      ' or ' +
      'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m]))',
  };

  const end = new Date();
  const start = new Date(end.getTime() - 5 * 60 * 1000);

  for (const [name, query] of Object.entries(testQueries)) {
    try {
      const url = new URL("/api/v1/query_range", PROMETHEUS_URL);
      url.searchParams.set("query", query);
      url.searchParams.set("start", (start.getTime() / 1000).toString());
      url.searchParams.set("end", (end.getTime() / 1000).toString());
      url.searchParams.set("step", "30s");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url.toString(), { signal: controller.signal });
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
      };
    }
  }

  return NextResponse.json(results, {
    headers: { "Cache-Control": "no-store" },
  });
}
