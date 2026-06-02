export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rangeQuery } from "@/lib/prometheus";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const parsedDuration = parseInt(
    req.nextUrl.searchParams.get("duration") || "60"
  );
  const durationMin =
    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 60;
  const step = req.nextUrl.searchParams.get("step") || "30s";

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
