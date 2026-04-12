import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchDashboardMetrics } from "./fetch-metrics";
import { instantQuery } from "@/lib/prometheus";

vi.mock("@/lib/prometheus", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/prometheus")>("@/lib/prometheus");
  return {
    ...actual,
    instantQuery: vi.fn(),
  };
});

const mockedInstantQuery = instantQuery as ReturnType<typeof vi.fn>;

function scalarResult(value: number) {
  return {
    status: "success",
    data: {
      resultType: "vector",
      result: [{ metric: {}, value: [0, String(value)] }],
    },
  };
}

describe("fetchDashboardMetrics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps Prometheus results to the dashboard metrics shape", async () => {
    mockedInstantQuery
      .mockResolvedValueOnce(scalarResult(42.5)) // avgCpu
      .mockResolvedValueOnce(scalarResult(55.3)) // avgTemp
      .mockResolvedValueOnce({
        status: "success",
        data: {
          resultType: "vector",
          result: [
            { metric: {}, value: [0, "1"] },
            { metric: {}, value: [0, "1"] },
            { metric: {}, value: [0, "0"] },
          ],
        },
      }) // up
      .mockResolvedValueOnce(scalarResult(86400 * 7)) // uptime
      .mockResolvedValueOnce(scalarResult(2500)) // totalPower
      .mockResolvedValueOnce(scalarResult(61.2)) // avgMemory
      .mockResolvedValueOnce(scalarResult(1_000_000)) // rx
      .mockResolvedValueOnce(scalarResult(500_000)); // tx

    const result = await fetchDashboardMetrics();

    expect(result.avgCpu).toBe(42.5);
    expect(result.avgTemp).toBe(55.3);
    expect(result.nodesUp).toBe(2);
    expect(result.nodesDown).toBe(1);
    expect(result.avgUptime).toBe(86400 * 7);
    expect(result.totalPowerWatts).toBe(2500);
    expect(result.avgMemory).toBe(61.2);
    expect(result.totalNetworkRxBps).toBe(1_000_000);
    expect(result.totalNetworkTxBps).toBe(500_000);
    expect(result.error).toBeNull();
  });

  it("returns null fields when individual queries reject", async () => {
    mockedInstantQuery.mockRejectedValue(new Error("prometheus down"));

    const result = await fetchDashboardMetrics();

    expect(result.avgCpu).toBeNull();
    expect(result.avgTemp).toBeNull();
    expect(result.nodesUp).toBe(0);
    expect(result.nodesDown).toBe(0);
    expect(result.error).toBeNull(); // allSettled -> no top-level error
  });

  it("calls instantQuery 8 times in parallel", async () => {
    mockedInstantQuery.mockResolvedValue(scalarResult(0));

    await fetchDashboardMetrics();

    expect(mockedInstantQuery).toHaveBeenCalledTimes(8);
  });
});
