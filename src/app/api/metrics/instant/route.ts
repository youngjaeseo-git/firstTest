export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { instantQuery } from "@/lib/prometheus";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await instantQuery(query);
    return NextResponse.json(result);
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
