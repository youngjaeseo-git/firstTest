import { NextResponse } from "next/server";
import { fetchDashboardMetrics } from "./fetch-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const metrics = await fetchDashboardMetrics();
  return NextResponse.json(metrics);
}
