"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Cpu,
  Database,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  WifiOff,
  RefreshCw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import { queries } from "@/lib/prometheus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveMetrics {
  cpuPct: number | null;
  memoryPct: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  totalCpuCores: number | null;
  powerWatts: number | null;
}

interface TrendData {
  cpuDelta: number | null; // 5-min change in pct points
  memoryDelta: number | null;
  powerDelta: number | null;
}

const REFRESH_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchScalar(query: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/metrics/instant?query=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const first = json?.data?.result?.[0];
    if (!first?.value) return null;
    const val = parseFloat(first.value[1]);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatWatts(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(1)} kW`;
  return `${w.toFixed(0)} W`;
}

function trendDirection(delta: number | null): "up" | "down" | "stable" {
  if (delta === null) return "stable";
  if (delta > 0.5) return "up";
  if (delta < -0.5) return "down";
  return "stable";
}

function barColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-amber-500";
  if (pct >= 50) return "bg-blue-500";
  return "bg-green-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveCapacityMetrics() {
  const t = useT();
  const [metrics, setMetrics] = useState<LiveMetrics>({
    cpuPct: null,
    memoryPct: null,
    memoryUsedBytes: null,
    memoryTotalBytes: null,
    totalCpuCores: null,
    powerWatts: null,
  });
  const [trend, setTrend] = useState<TrendData>({
    cpuDelta: null,
    memoryDelta: null,
    powerDelta: null,
  });
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const prevMetrics = useRef<LiveMetrics | null>(null);

  const fetchAll = useCallback(async () => {
    const results = await Promise.all([
      fetchScalar(queries.fleetAvgCpu()),
      fetchScalar(queries.fleetAvgMemory()),
      fetchScalar(queries.fleetTotalPower()),
      fetchScalar(queries.fleetTotalMemoryUsedBytes()),
      fetchScalar(queries.fleetTotalMemoryBytes()),
      fetchScalar(queries.fleetTotalCpuCores()),
    ]);

    const [cpuPct, memoryPct, powerWatts, memUsed, memTotal, cpuCores] =
      results;

    const allNull = results.every((r) => r === null);
    if (allNull) {
      setError(true);
      return;
    }
    setError(false);

    const newMetrics: LiveMetrics = {
      cpuPct,
      memoryPct,
      memoryUsedBytes: memUsed,
      memoryTotalBytes: memTotal,
      totalCpuCores: cpuCores,
      powerWatts,
    };

    // Compute trend from previous fetch
    if (prevMetrics.current) {
      const prev = prevMetrics.current;
      setTrend({
        cpuDelta:
          newMetrics.cpuPct !== null && prev.cpuPct !== null
            ? newMetrics.cpuPct - prev.cpuPct
            : null,
        memoryDelta:
          newMetrics.memoryPct !== null && prev.memoryPct !== null
            ? newMetrics.memoryPct - prev.memoryPct
            : null,
        powerDelta:
          newMetrics.powerWatts !== null && prev.powerWatts !== null
            ? ((newMetrics.powerWatts - prev.powerWatts) /
                Math.max(prev.powerWatts, 1)) *
              100
            : null,
      });
    }

    prevMetrics.current = newMetrics;
    setMetrics(newMetrics);
    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, []);

  // Initial fetch + interval
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Tick the "seconds ago" counter every second
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // ── Error state ──
  if (error && metrics.cpuPct === null) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-3 text-sm text-amber-400">
          <div className="rounded-xl bg-amber-500/15 p-2">
            <WifiOff className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">
              {t("capacity.liveMetrics.unavailable")}
            </p>
            <p className="mt-0.5 text-xs text-amber-400/70">
              {t("capacity.liveMetrics.unavailableSub")}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // ── Forecast: linear extrapolation from current trend ──
  // We project the 30-sec delta to 1h (120 intervals)
  const forecastCpu =
    metrics.cpuPct !== null && trend.cpuDelta !== null
      ? Math.max(0, Math.min(100, metrics.cpuPct + trend.cpuDelta * 120))
      : null;
  const forecastMem =
    metrics.memoryPct !== null && trend.memoryDelta !== null
      ? Math.max(0, Math.min(100, metrics.memoryPct + trend.memoryDelta * 120))
      : null;
  const forecastPower =
    metrics.powerWatts !== null && trend.powerDelta !== null
      ? Math.max(0, metrics.powerWatts * (1 + (trend.powerDelta / 100) * 120))
      : null;

  const TrendIcon = ({
    delta,
    className,
  }: {
    delta: number | null;
    className?: string;
  }) => {
    const dir = trendDirection(delta);
    if (dir === "up")
      return <ArrowUp className={cn("h-3.5 w-3.5 text-red-400", className)} />;
    if (dir === "down")
      return (
        <ArrowDown className={cn("h-3.5 w-3.5 text-green-400", className)} />
      );
    return <Minus className={cn("h-3.5 w-3.5 text-gray-500", className)} />;
  };

  const agoLabel =
    secondsAgo < 60
      ? `${secondsAgo}s ${t("capacity.liveMetrics.ago")}`
      : `${Math.floor(secondsAgo / 60)}m ${t("capacity.liveMetrics.ago")}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">
            {t("capacity.liveMetrics")}
          </h2>
          <p className="text-xs text-gray-500">
            {t("capacity.liveMetrics.sub")}
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <RefreshCw className="h-3 w-3 animate-spin text-gray-600" />
            <span>
              {t("capacity.liveMetrics.lastUpdated")}: {agoLabel}
            </span>
          </div>
        )}
      </div>

      {/* Live metric cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* CPU */}
        <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-600/10 via-cyan-600/5 to-transparent">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {t("capacity.liveMetrics.cpuUsage")}
            </p>
            <div className="flex items-center gap-1.5">
              <TrendIcon delta={trend.cpuDelta} />
              <div className="rounded-xl bg-cyan-500/15 p-1.5">
                <Cpu className="h-4 w-4 text-cyan-400" />
              </div>
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-100">
            {metrics.cpuPct !== null ? metrics.cpuPct.toFixed(1) : "-"}
            <span className="text-lg text-gray-500">%</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className={cn("h-full rounded-full transition-all duration-700", barColor(metrics.cpuPct ?? 0))}
              style={{ width: `${Math.min(metrics.cpuPct ?? 0, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {metrics.totalCpuCores !== null
              ? `${metrics.totalCpuCores.toFixed(0)} ${t("capacity.liveMetrics.cores")} ${t("common.total")}`
              : ""}
          </p>
        </Card>

        {/* Memory */}
        <Card className="border-green-500/30 bg-gradient-to-br from-green-600/10 via-green-600/5 to-transparent">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {t("capacity.liveMetrics.memoryUsage")}
            </p>
            <div className="flex items-center gap-1.5">
              <TrendIcon delta={trend.memoryDelta} />
              <div className="rounded-xl bg-green-500/15 p-1.5">
                <Database className="h-4 w-4 text-green-400" />
              </div>
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-100">
            {metrics.memoryPct !== null ? metrics.memoryPct.toFixed(1) : "-"}
            <span className="text-lg text-gray-500">%</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className={cn("h-full rounded-full transition-all duration-700", barColor(metrics.memoryPct ?? 0))}
              style={{ width: `${Math.min(metrics.memoryPct ?? 0, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {metrics.memoryUsedBytes !== null &&
            metrics.memoryTotalBytes !== null
              ? `${formatBytes(metrics.memoryUsedBytes)} ${t("capacity.liveMetrics.of")} ${formatBytes(metrics.memoryTotalBytes)}`
              : ""}
          </p>
        </Card>

        {/* Power */}
        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 via-yellow-600/5 to-transparent">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {t("capacity.liveMetrics.powerConsumption")}
            </p>
            <div className="flex items-center gap-1.5">
              <TrendIcon delta={trend.powerDelta} />
              <div className="rounded-xl bg-yellow-500/15 p-1.5">
                <Zap className="h-4 w-4 text-yellow-400" />
              </div>
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-100">
            {metrics.powerWatts !== null
              ? metrics.powerWatts >= 1000
                ? (metrics.powerWatts / 1000).toFixed(1)
                : metrics.powerWatts.toFixed(0)
              : "-"}
            <span className="text-lg text-gray-500">
              {metrics.powerWatts !== null && metrics.powerWatts >= 1000
                ? " kW"
                : " W"}
            </span>
          </p>
          {trend.powerDelta !== null && (
            <p
              className={cn(
                "mt-2 text-xs font-medium",
                trend.powerDelta > 0.5
                  ? "text-red-400"
                  : trend.powerDelta < -0.5
                    ? "text-green-400"
                    : "text-gray-500",
              )}
            >
              {trend.powerDelta > 0 ? "+" : ""}
              {trend.powerDelta.toFixed(1)}% vs prev
            </p>
          )}
        </Card>
      </div>

      {/* Resource Forecast */}
      {(forecastCpu !== null ||
        forecastMem !== null ||
        forecastPower !== null) && (
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-600/5 via-transparent to-transparent">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <div>
              <p className="text-sm font-medium text-gray-200">
                {t("capacity.forecast")}
              </p>
              <p className="text-xs text-gray-500">
                {t("capacity.forecast.sub")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* CPU forecast */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <p className="text-xs text-gray-500">
                {t("capacity.forecast.cpu1h")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-bold text-gray-100">
                  {forecastCpu !== null ? `${forecastCpu.toFixed(1)}%` : "-"}
                </span>
                <ForecastBadge delta={trend.cpuDelta} t={t} />
              </div>
              {forecastCpu !== null && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      barColor(forecastCpu),
                    )}
                    style={{ width: `${Math.min(forecastCpu, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Memory forecast */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <p className="text-xs text-gray-500">
                {t("capacity.forecast.mem1h")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-bold text-gray-100">
                  {forecastMem !== null ? `${forecastMem.toFixed(1)}%` : "-"}
                </span>
                <ForecastBadge delta={trend.memoryDelta} t={t} />
              </div>
              {forecastMem !== null && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      barColor(forecastMem),
                    )}
                    style={{ width: `${Math.min(forecastMem, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Power forecast */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <p className="text-xs text-gray-500">
                {t("capacity.forecast.power1h")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-bold text-gray-100">
                  {forecastPower !== null ? formatWatts(forecastPower) : "-"}
                </span>
                <ForecastBadge delta={trend.powerDelta} t={t} />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forecast badge
// ---------------------------------------------------------------------------

function ForecastBadge({
  delta,
  t,
}: {
  delta: number | null;
  t: (key: string) => string;
}) {
  const dir = trendDirection(delta);
  if (dir === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
        <TrendingUp className="h-3 w-3" />
        {t("capacity.forecast.rising")}
      </span>
    );
  }
  if (dir === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
        <TrendingDown className="h-3 w-3" />
        {t("capacity.forecast.falling")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-700/50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
      <Minus className="h-3 w-3" />
      {t("capacity.forecast.stable")}
    </span>
  );
}
