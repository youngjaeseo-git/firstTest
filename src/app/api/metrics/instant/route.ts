export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { instantQuery, instantQueryFrom, LAB3_PROMETHEUS_URL } from "@/lib/prometheus";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const source = req.nextUrl.searchParams.get("source");

  try {
    const result = source === "lab3"
      ? await instantQueryFrom(LAB3_PROMETHEUS_URL, query, 5000)
      : await instantQuery(query);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Prometheus query failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
