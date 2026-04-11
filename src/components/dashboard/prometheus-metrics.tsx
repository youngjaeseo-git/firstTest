"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Cpu, Thermometer, Clock, Wifi, WifiOff, Zap, Database, Network } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricData {
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

function formatBytes(bps: number): string {
  if (bps === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return `${(bps / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function PrometheusMetrics() {
  const [data, setData] = useState<MetricData>({
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/metrics/dashboard");
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (!cancelled) {
          setData({ ...json, error: null });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setData((prev) => ({ ...prev, error: "Prometheus 연결 실패" }));
          setLoading(false);
        }
      }
    }
    fetchMetrics();
    const id = setInterval(fetchMetrics, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse p-4">
            <div className="h-16" />
          </Card>
        ))}
      </div>
    );
  }

  if (data.error && data.avgCpu === null) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <WifiOff className="h-4 w-4" />
          <span>{data.error} — Prometheus 메트릭을 가져올 수 없습니다.</span>
        </div>
      </Card>
    );
  }

  const uptimeDays =
    data.avgUptime !== null ? Math.floor(data.avgUptime / 86400) : null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Average CPU */}
      <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-600/10 via-cyan-600/5 to-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Avg CPU Usage</p>
          <div className="rounded-lg bg-cyan-500/20 p-1.5">
            <Cpu className="h-4 w-4 text-cyan-400" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-100">
          {data.avgCpu !== null ? `${data.avgCpu.toFixed(1)}` : "-"}
          <span className="text-lg text-gray-500">%</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div
            className={cn(
              "h-full transition-all",
              (data.avgCpu || 0) > 80
                ? "bg-red-500"
                : (data.avgCpu || 0) > 60
                  ? "bg-amber-500"
                  : "bg-cyan-500",
            )}
            style={{ width: `${Math.min(data.avgCpu || 0, 100)}%` }}
          />
        </div>
      </Card>

      {/* Average Memory */}
      <Card className="border-green-500/30 bg-gradient-to-br from-green-600/10 via-green-600/5 to-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Avg Memory</p>
          <div className="rounded-lg bg-green-500/20 p-1.5">
            <Database className="h-4 w-4 text-green-400" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-100">
          {data.avgMemory !== null ? `${data.avgMemory.toFixed(1)}` : "-"}
          <span className="text-lg text-gray-500">%</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div
            className={cn(
              "h-full transition-all",
              (data.avgMemory || 0) > 85
                ? "bg-red-500"
                : (data.avgMemory || 0) > 70
                  ? "bg-amber-500"
                  : "bg-green-500",
            )}
            style={{ width: `${Math.min(data.avgMemory || 0, 100)}%` }}
          />
        </div>
      </Card>

      {/* Temperature */}
      <Card className="border-orange-500/30 bg-gradient-to-br from-orange-600/10 via-orange-600/5 to-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Avg Temperature</p>
          <div className="rounded-lg bg-orange-500/20 p-1.5">
            <Thermometer className="h-4 w-4 text-orange-400" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-100">
          {data.avgTemp !== null ? `${data.avgTemp.toFixed(1)}` : "-"}
          <span className="text-lg text-gray-500">°C</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">전체 서버 평균</p>
      </Card>

      {/* Total Power */}
      <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 via-yellow-600/5 to-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Total Power</p>
          <div className="rounded-lg bg-yellow-500/20 p-1.5">
            <Zap className="h-4 w-4 text-yellow-400" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-100">
          {data.totalPowerWatts !== null
            ? data.totalPowerWatts >= 1000
              ? `${(data.totalPowerWatts / 1000).toFixed(1)}`
              : `${data.totalPowerWatts.toFixed(0)}`
            : "-"}
          <span className="text-lg text-gray-500">
            {data.totalPowerWatts !== null && data.totalPowerWatts >= 1000 ? " kW" : " W"}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-500">전체 서버 합계</p>
      </Card>

      {/* Nodes Up/Down */}
      <Card
        className={cn(
          "border bg-gradient-to-br p-4",
          data.nodesDown > 0
            ? "border-red-500/30 from-red-600/10 via-red-600/5 to-transparent"
            : "border-green-500/30 from-green-600/10 via-green-600/5 to-transparent",
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Prometheus Nodes</p>
          <div
            className={cn(
              "rounded-lg p-1.5",
              data.nodesDown > 0 ? "bg-red-500/20" : "bg-green-500/20",
            )}
          >
            <Wifi
              className={cn(
                "h-4 w-4",
                data.nodesDown > 0 ? "text-red-400" : "text-green-400",
              )}
            />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-green-400">
          {data.nodesUp}
          <span className="text-lg text-gray-500"> up</span>
        </p>
        {data.nodesDown > 0 && (
          <p className="mt-1 text-xs text-red-400">
            {data.nodesDown} nodes down
          </p>
        )}
        {data.nodesDown === 0 && (
          <p className="mt-1 text-xs text-gray-500">모두 정상</p>
        )}
      </Card>

      {/* Average Uptime */}
      <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-600/10 via-indigo-600/5 to-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Avg Uptime</p>
          <div className="rounded-lg bg-indigo-500/20 p-1.5">
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-100">
          {uptimeDays !== null ? uptimeDays : "-"}
          <span className="text-lg text-gray-500"> days</span>
        </p>
        <p className="mt-1 text-xs text-gray-500">평균 서버 가동시간</p>
      </Card>

      {/* Network RX */}
      <Card className="border-sky-500/30 bg-gradient-to-br from-sky-600/10 via-sky-600/5 to-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">Network Inbound</p>
          <div className="rounded-lg bg-sky-500/20 p-1.5">
            <Network className="h-4 w-4 text-sky-400" />
          </div>
        </div>
        <p className="mt-2 text-xl font-bold text-gray-100">
          {data.totalNetworkRxBps !== null
            ? formatBytes(data.totalNetworkRxBps)
            : "-"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          TX: {data.totalNetworkTxBps !== null ? formatBytes(data.totalNetworkTxBps) : "-"}
        </p>
      </Card>

      {/* Placeholder for future GPU metric */}
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-600/10 via-purple-600/5 to-transparent p-4 flex flex-col justify-center items-center text-center">
        <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">GPU</p>
        <p className="mt-1 text-sm text-gray-600">dcgm-exporter</p>
        <p className="text-xs text-gray-700">설치 후 활성화</p>
      </Card>
    </div>
  );
}
