import { NextResponse } from "next/server";
import { instantQuery, queries } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      cpuResult,
      tempResult,
      upResult,
      uptimeResult,
      totalPowerResult,
      avgMemoryResult,
      totalRxResult,
      totalTxResult,
    ] = await Promise.allSettled([
      instantQuery(
        'avg(100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100))',
      ),
      instantQuery("avg(node_hwmon_temp_celsius)"),
      instantQuery(queries.allNodesUp()),
      instantQuery("avg(node_time_seconds - node_boot_time_seconds)"),
      instantQuery(queries.fleetTotalPower()),
      instantQuery(queries.fleetAvgMemory()),
      instantQuery(queries.fleetTotalNetworkRx()),
      instantQuery(queries.fleetTotalNetworkTx()),
    ]);

    const extractScalar = (
      r: (typeof cpuResult),
    ): number | null => {
      if (r.status !== "fulfilled") return null;
      const first = r.value.data?.result?.[0];
      if (!first?.value) return null;
      return parseFloat(first.value[1]);
    };

    // Node up/down counts
    let nodesUp = 0;
    let nodesDown = 0;
    if (upResult.status === "fulfilled" && upResult.value.data?.result) {
      for (const r of upResult.value.data.result) {
        if (r.value) {
          const val = parseFloat(r.value[1]);
          if (val === 1) nodesUp++;
          else nodesDown++;
        }
      }
    }

    return NextResponse.json({
      avgCpu: extractScalar(cpuResult),
      avgTemp: extractScalar(tempResult),
      nodesUp,
      nodesDown,
      avgUptime: extractScalar(uptimeResult),
      totalPowerWatts: extractScalar(totalPowerResult),
      avgMemory: extractScalar(avgMemoryResult),
      totalNetworkRxBps: extractScalar(totalRxResult),
      totalNetworkTxBps: extractScalar(totalTxResult),
    });
  } catch {
    return NextResponse.json(
      {
        avgCpu: null,
        avgTemp: null,
        nodesUp: 0,
        nodesDown: 0,
        avgUptime: null,
        totalPowerWatts: null,
        avgMemory: null,
        totalNetworkRxBps: null,
        totalNetworkTxBps: null,
        error: "Prometheus unreachable",
      },
      { status: 200 },
    );
  }
}
