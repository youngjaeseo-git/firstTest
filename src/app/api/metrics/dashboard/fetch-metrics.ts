import { instantQuery, queries } from "@/lib/prometheus";

export interface DashboardMetrics {
  avgCpu: number | null;
  avgTemp: number | null;
  nodesUp: number;
  nodesDown: number;
  avgUptime: number | null;
  totalPowerWatts: number | null;
  avgMemory: number | null;
  totalNetworkRxBps: number | null;
  totalNetworkTxBps: number | null;
  error: string | null;
}

const EMPTY_METRICS: DashboardMetrics = {
  avgCpu: null,
  avgTemp: null,
  nodesUp: 0,
  nodesDown: 0,
  avgUptime: null,
  totalPowerWatts: null,
  avgMemory: null,
  totalNetworkRxBps: null,
  totalNetworkTxBps: null,
  error: null,
};

/**
 * Fetches dashboard metrics from Prometheus in parallel.
 * Returns all-null values (with error message) if Prometheus is unreachable.
 * Shared between the JSON endpoint and the SSE stream.
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
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

    const extractScalar = (r: typeof cpuResult): number | null => {
      if (r.status !== "fulfilled") return null;
      const first = r.value.data?.result?.[0];
      if (!first?.value) return null;
      return parseFloat(first.value[1]);
    };

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

    return {
      avgCpu: extractScalar(cpuResult),
      avgTemp: extractScalar(tempResult),
      nodesUp,
      nodesDown,
      avgUptime: extractScalar(uptimeResult),
      totalPowerWatts: extractScalar(totalPowerResult),
      avgMemory: extractScalar(avgMemoryResult),
      totalNetworkRxBps: extractScalar(totalRxResult),
      totalNetworkTxBps: extractScalar(totalTxResult),
      error: null,
    };
  } catch {
    return { ...EMPTY_METRICS, error: "Prometheus unreachable" };
  }
}
