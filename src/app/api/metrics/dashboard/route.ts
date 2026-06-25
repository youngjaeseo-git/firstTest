import { NextRequest, NextResponse } from "next/server";
import { fetchDashboardMetrics } from "./fetch-metrics";
import { prisma } from "@/lib/db";
import type { Cluster } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cluster = (request.nextUrl.searchParams.get("cluster") || "all") as Cluster;

  const equipment = await prisma.equipment.findMany({
    where: { ipAddress: { not: null } },
    select: { ipAddress: true },
  });
  const registeredIps = new Set(
    equipment.map((e) => e.ipAddress!).filter(Boolean),
  );

  const metrics = await fetchDashboardMetrics(cluster, registeredIps);
  return NextResponse.json(metrics);
}
