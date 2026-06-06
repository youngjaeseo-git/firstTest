import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface MonthlyGrowth {
  month: string; // "2025-01"
  added: number;
  cumulative: number;
}

interface ExhaustionPrediction {
  resource: "space" | "power" | "memory" | "cpu";
  current: number;
  capacity: number;
  utilizationPct: number;
  monthlyGrowthRate: number;
  exhaustionDate: string | null; // ISO date or null if not trending toward exhaustion
  daysRemaining: number | null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [equipment, racks] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        id: true,
        status: true,
        rackId: true,
        rackHeight: true,
        totalMemoryGB: true,
        createdAt: true,
        cpus: { select: { cores: true, tdpWatts: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rack.findMany({
      select: {
        id: true,
        totalUnits: true,
        maxPowerWatts: true,
      },
    }),
  ]);

  // Build monthly growth history
  const monthlyMap = new Map<string, number>();
  for (const eq of equipment) {
    const key = eq.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
  }

  const sortedMonths = Array.from(monthlyMap.keys()).sort();
  let cumulative = 0;
  const growthHistory: MonthlyGrowth[] = sortedMonths.map((month) => {
    const added = monthlyMap.get(month) || 0;
    cumulative += added;
    return { month, added, cumulative };
  });

  // Current capacity totals
  const totalRackUnits = racks.reduce((s, r) => s + r.totalUnits, 0);
  const usedRackUnits = equipment
    .filter((e) => e.rackId)
    .reduce((s, e) => s + (e.rackHeight || 1), 0);

  const totalMaxPowerWatts = racks.reduce(
    (s, r) => s + (r.maxPowerWatts || 0),
    0,
  );
  const currentTdpWatts = equipment.reduce(
    (s, e) => s + e.cpus.reduce((cs, c) => cs + (c.tdpWatts || 0), 0),
    0,
  );

  const totalMemoryGB = equipment.reduce(
    (s, e) => s + (e.totalMemoryGB || 0),
    0,
  );
  const totalCpuCores = equipment.reduce(
    (s, e) => s + e.cpus.reduce((cs, c) => cs + (c.cores || 0), 0),
    0,
  );

  // Linear regression on monthly cumulative growth
  // Using the last 6 months (or all data if less) to compute growth rate
  const recentMonths = growthHistory.slice(-6);
  const monthlyGrowthRate = computeMonthlyGrowthRate(recentMonths);

  // Average resource per equipment (for projecting resource exhaustion)
  const activeEquipment = equipment.filter(
    (e) => e.rackId && e.status === "ACTIVE",
  );
  const avgUPerEquipment =
    activeEquipment.length > 0
      ? activeEquipment.reduce((s, e) => s + (e.rackHeight || 1), 0) /
        activeEquipment.length
      : 2;
  const avgTdpPerEquipment =
    activeEquipment.length > 0
      ? activeEquipment.reduce(
          (s, e) => s + e.cpus.reduce((cs, c) => cs + (c.tdpWatts || 0), 0),
          0,
        ) / activeEquipment.length
      : 300;
  const avgMemoryPerEquipment =
    activeEquipment.length > 0
      ? activeEquipment.reduce((s, e) => s + (e.totalMemoryGB || 0), 0) /
        activeEquipment.length
      : 128;
  const avgCoresPerEquipment =
    activeEquipment.length > 0
      ? activeEquipment.reduce(
          (s, e) => s + e.cpus.reduce((cs, c) => cs + (c.cores || 0), 0),
          0,
        ) / activeEquipment.length
      : 32;

  // Predict exhaustion dates
  const predictions: ExhaustionPrediction[] = [];

  if (totalRackUnits > 0) {
    predictions.push(
      predictExhaustion(
        "space",
        usedRackUnits,
        totalRackUnits,
        monthlyGrowthRate * avgUPerEquipment,
      ),
    );
  }

  if (totalMaxPowerWatts > 0) {
    predictions.push(
      predictExhaustion(
        "power",
        currentTdpWatts,
        totalMaxPowerWatts,
        monthlyGrowthRate * avgTdpPerEquipment,
      ),
    );
  }

  // Memory and CPU don't have hard ceilings in DB, so project growth rate only
  predictions.push({
    resource: "memory",
    current: totalMemoryGB,
    capacity: 0,
    utilizationPct: 0,
    monthlyGrowthRate: monthlyGrowthRate * avgMemoryPerEquipment,
    exhaustionDate: null,
    daysRemaining: null,
  });

  predictions.push({
    resource: "cpu",
    current: totalCpuCores,
    capacity: 0,
    utilizationPct: 0,
    monthlyGrowthRate: monthlyGrowthRate * avgCoresPerEquipment,
    exhaustionDate: null,
    daysRemaining: null,
  });

  // Generate future projection data points (12 months ahead)
  const projectedGrowth: MonthlyGrowth[] = [];
  const lastCumulative = growthHistory.length > 0
    ? growthHistory[growthHistory.length - 1].cumulative
    : 0;
  const now = new Date();

  for (let i = 1; i <= 12; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthStr = futureDate.toISOString().slice(0, 7);
    const projected = Math.round(lastCumulative + monthlyGrowthRate * i);
    projectedGrowth.push({
      month: monthStr,
      added: Math.round(monthlyGrowthRate),
      cumulative: projected,
    });
  }

  return NextResponse.json({
    growthHistory,
    projectedGrowth,
    predictions,
    summary: {
      totalEquipment: equipment.length,
      totalRackUnits,
      usedRackUnits,
      totalMaxPowerWatts,
      currentTdpWatts,
      totalMemoryGB,
      totalCpuCores,
      monthlyGrowthRate: Math.round(monthlyGrowthRate * 10) / 10,
      avgUPerEquipment: Math.round(avgUPerEquipment * 10) / 10,
      avgTdpPerEquipment: Math.round(avgTdpPerEquipment),
      avgMemoryPerEquipment: Math.round(avgMemoryPerEquipment),
      avgCoresPerEquipment: Math.round(avgCoresPerEquipment),
    },
    checkedAt: new Date().toISOString(),
  });
}

function computeMonthlyGrowthRate(data: MonthlyGrowth[]): number {
  if (data.length < 2) {
    return data.length === 1 ? data[0].added : 0;
  }

  // Simple linear regression on cumulative values
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i].cumulative;
    sumXY += i * data[i].cumulative;
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  return Math.max(0, slope);
}

function predictExhaustion(
  resource: "space" | "power",
  current: number,
  capacity: number,
  monthlyResourceGrowth: number,
): ExhaustionPrediction {
  const remaining = capacity - current;
  const utilizationPct = capacity > 0 ? (current / capacity) * 100 : 0;

  let exhaustionDate: string | null = null;
  let daysRemaining: number | null = null;

  if (monthlyResourceGrowth > 0 && remaining > 0) {
    const monthsToExhaustion = remaining / monthlyResourceGrowth;
    const exhaustion = new Date();
    exhaustion.setDate(
      exhaustion.getDate() + Math.round(monthsToExhaustion * 30.44),
    );
    exhaustionDate = exhaustion.toISOString().split("T")[0];
    daysRemaining = Math.round(monthsToExhaustion * 30.44);
  } else if (remaining <= 0) {
    exhaustionDate = new Date().toISOString().split("T")[0];
    daysRemaining = 0;
  }

  return {
    resource,
    current,
    capacity,
    utilizationPct,
    monthlyGrowthRate: Math.round(monthlyResourceGrowth * 10) / 10,
    exhaustionDate,
    daysRemaining,
  };
}
