export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const PROMETHEUS_URL =
  process.env.PROMETHEUS_URL || "http://10.100.175.248:8080";

export async function GET() {
  const result: Record<string, unknown> = {
    promUrl: PROMETHEUS_URL,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${PROMETHEUS_URL}/api/v1/query?query=up`,
      { signal: controller.signal },
    );
    clearTimeout(timer);

    result.httpStatus = res.status;
    result.httpOk = res.ok;

    if (res.ok) {
      const json = await res.json();
      result.promStatus = json.status;
      result.resultCount = json.data?.result?.length ?? 0;
      result.ok = true;
    } else {
      result.body = await res.text().then((t) => t.slice(0, 200));
      result.ok = false;
    }
  } catch (err) {
    result.ok = false;
    result.error = err instanceof Error ? err.message : String(err);
    result.errorType = err instanceof Error ? err.constructor.name : typeof err;
  }

  return NextResponse.json(result);
}
