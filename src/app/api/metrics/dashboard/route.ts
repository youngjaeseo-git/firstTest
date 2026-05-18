import { NextRequest, NextResponse } from "next/server";
import { fetchDashboardMetrics } from "./fetch-metrics";
import type { Cluster } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cluster = (request.nextUrl.searchParams.get("cluster") || "all") as Cluster;
  const metrics = await fetchDashboardMetrics(cluster);
  return NextResponse.json(metrics);
}
