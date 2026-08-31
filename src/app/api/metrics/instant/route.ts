export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { instantQuery, instantQueryFrom, LAB3_PROMETHEUS_URL } from "@/lib/prometheus";
import { getSessionUser } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }
  // Bound the PromQL length — an authenticated user reaches this proxy, but an
  // over-long expression is either a bug or an abuse attempt (heavy query).
  if (query.length > 2000) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const source = req.nextUrl.searchParams.get("source");

  try {
    const result = source === "lab3"
      ? await instantQueryFrom(LAB3_PROMETHEUS_URL, query, 3000)
      : await instantQuery(query);
    return NextResponse.json(result, {
      // Metric responses require an authenticated session — never let a shared
      // cache serve them to another user.
      headers: { "Cache-Control": "private, max-age=15" },
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
