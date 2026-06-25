export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rangeQuery } from "@/lib/prometheus";
import { getSessionUser } from "@/lib/rbac";

/** Convert a step string like "15s", "2m", "1h", "1d" to seconds. */
function stepToSeconds(step: string): number {
  const match = step.match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 3600;
    case "d": return value * 86400;
    default: return 0;
  }
}

/** Validate and sanitize the step parameter. Returns a valid step string. */
function validateStep(raw: string | null): string {
  const DEFAULT_STEP = "30s";
  const MIN_SECONDS = 1;    // 1s
  const MAX_SECONDS = 3600; // 1h

  if (!raw) return DEFAULT_STEP;

  // Must match format: digits + time unit (s/m/h/d)
  if (!/^\d+[smhd]$/.test(raw)) return DEFAULT_STEP;

  const seconds = stepToSeconds(raw);
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) return DEFAULT_STEP;

  return raw;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("query");
  const parsedDuration = parseInt(
    req.nextUrl.searchParams.get("duration") || "60"
  );
  const durationMin =
    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60;
  const step = validateStep(req.nextUrl.searchParams.get("step"));

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const end = new Date();
  const start = new Date(end.getTime() - durationMin * 60 * 1000);

  try {
    const result = await rangeQuery(query, start, end, step);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Prometheus range query failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
