"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  CalendarClock,
  HardDrive,
  Zap,
  Database,
  Cpu,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";

interface MonthlyGrowth {
  month: string;
  added: number;
  cumulative: number;
}

interface ExhaustionPrediction {
  resource: "space" | "power" | "memory" | "cpu";
  current: number;
  capacity: number;
  utilizationPct: number;
  monthlyGrowthRate: number;
  exhaustionDate: string | null;
  daysRemaining: number | null;
}

interface ForecastData {
  growthHistory: MonthlyGrowth[];
  projectedGrowth: MonthlyGrowth[];
  predictions: ExhaustionPrediction[];
  summary: {
    totalEquipment: number;
    totalRackUnits: number;
    usedRackUnits: number;
    totalMaxPowerWatts: number;
    currentTdpWatts: number;
    totalMemoryGB: number;
    totalCpuCores: number;
    monthlyGrowthRate: number;
    avgUPerEquipment: number;
    avgTdpPerEquipment: number;
    avgMemoryPerEquipment: number;
    avgCoresPerEquipment: number;
  };
  checkedAt: string;
}

const RESOURCE_CONFIG = {
  space: {
    icon: HardDrive,
    color: "cyan",
    unit: "U",
    gradient: { from: "#06b6d4", to: "#0891b2" },
  },
  power: {
    icon: Zap,
    color: "amber",
    unit: "W",
    gradient: { from: "#f59e0b", to: "#d97706" },
  },
  memory: {
    icon: Database,
    color: "green",
    unit: "GB",
    gradient: { from: "#22c55e", to: "#16a34a" },
  },
  cpu: {
    icon: Cpu,
    color: "indigo",
    unit: "cores",
    gradient: { from: "#6366f1", to: "#4f46e5" },
  },
} as const;

export function CapacityForecast() {
  const t = useT();
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/capacity/forecast");
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-12">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-500">
          {t("capacity.forecast.loading")}
        </span>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-500/30 bg-red-500/5 py-8 text-center">
        <p className="text-sm text-red-400">
          {t("capacity.forecast.error")}
        </p>
      </Card>
    );
  }

  // Merge history + projection for chart
  const chartData = [
    ...data.growthHistory.map((d) => ({
      month: d.month,
      actual: d.cumulative,
      projected: null as number | null,
    })),
    // Bridge: last history point also starts projection
    ...(data.growthHistory.length > 0
      ? [
          {
            month: data.growthHistory[data.growthHistory.length - 1].month,
            actual:
              data.growthHistory[data.growthHistory.length - 1].cumulative,
            projected:
              data.growthHistory[data.growthHistory.length - 1].cumulative,
          },
        ]
      : []),
    ...data.projectedGrowth.map((d) => ({
      month: d.month,
      actual: null as number | null,
      projected: d.cumulative,
    })),
  ];

  // Deduplicate the bridge month
  const seen = new Set<string>();
  const deduped = chartData.filter((d) => {
    if (d.projected !== null && d.actual !== null) {
      if (seen.has(d.month)) return false;
      seen.add(d.month);
      return true;
    }
    if (seen.has(d.month + (d.projected !== null ? "_p" : "_a"))) return false;
    seen.add(d.month + (d.projected !== null ? "_p" : "_a"));
    return true;
  });

  const spacePred = data.predictions.find((p) => p.resource === "space");
  const powerPred = data.predictions.find((p) => p.resource === "power");

  const urgentPredictions = data.predictions.filter(
    (p) => p.daysRemaining !== null && p.daysRemaining <= 180,
  );

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-indigo-400" />
        <div>
          <h2 className="text-lg font-semibold text-gray-100">
            {t("capacity.forecast.longTerm")}
          </h2>
          <p className="text-xs text-gray-500">
            {t("capacity.forecast.longTermSub")}
          </p>
        </div>
      </div>

      {/* Urgent warnings */}
      {urgentPredictions.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <div>
              <p className="font-medium text-red-300">
                {t("capacity.forecast.urgentWarning")}
              </p>
              <ul className="mt-1.5 space-y-1">
                {urgentPredictions.map((p) => (
                  <li
                    key={p.resource}
                    className="text-sm text-red-300/80"
                  >
                    <span className="font-medium">
                      {t(`capacity.forecast.res.${p.resource}`)}
                    </span>
                    {": "}
                    {p.daysRemaining === 0
                      ? t("capacity.forecast.alreadyFull")
                      : `D-${p.daysRemaining} (${p.exhaustionDate})`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Growth trend chart */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">
              {t("capacity.forecast.growthChart")}
            </p>
            <p className="text-xs text-gray-500">
              {t("capacity.forecast.growthChartSub")}
            </p>
          </div>
          <Badge variant="info" className="text-xs">
            +{data.summary.monthlyGrowthRate}{" "}
            {t("capacity.forecast.perMonth")}
          </Badge>
        </div>

        {deduped.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deduped}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient
                    id="projectedGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tickFormatter={(v: string) => v.slice(2)} // "25-01"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(v: string) => v}
                  formatter={(value: number, name: string) => [
                    value,
                    name === "actual"
                      ? t("capacity.forecast.actual")
                      : t("capacity.forecast.projected"),
                  ]}
                />
                {/* Current month reference line */}
                <ReferenceLine
                  x={new Date().toISOString().slice(0, 7)}
                  stroke="#4b5563"
                  strokeDasharray="3 3"
                  label={{
                    value: t("capacity.forecast.now"),
                    position: "top",
                    fill: "#9ca3af",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#actualGrad)"
                  connectNulls={false}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  fill="url(#projectedGrad)"
                  connectNulls={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">
            {t("capacity.forecast.noData")}
          </p>
        )}
      </Card>

      {/* Exhaustion prediction cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {spacePred && (
          <ExhaustionCard prediction={spacePred} t={t} />
        )}
        {powerPred && (
          <ExhaustionCard prediction={powerPred} t={t} />
        )}
      </div>

      {/* Growth rate summary */}
      <Card>
        <p className="mb-3 text-sm font-medium text-gray-200">
          {t("capacity.forecast.growthSummary")}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["space", "power", "memory", "cpu"] as const).map((res) => {
            const cfg = RESOURCE_CONFIG[res];
            const Icon = cfg.icon;
            const pred = data.predictions.find((p) => p.resource === res);
            return (
              <div
                key={res}
                className="rounded-lg border border-gray-800 bg-gray-900/50 p-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 text-${cfg.color}-400`} />
                  <p className="text-xs text-gray-400">
                    {t(`capacity.forecast.res.${res}`)}
                  </p>
                </div>
                <p className="mt-1 text-lg font-bold text-gray-100">
                  +{pred?.monthlyGrowthRate ?? 0}
                  <span className="text-xs text-gray-500">
                    {" "}
                    {cfg.unit}/{t("capacity.forecast.mo")}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ExhaustionCard({
  prediction: p,
  t,
}: {
  prediction: ExhaustionPrediction;
  t: (key: string) => string;
}) {
  const cfg = RESOURCE_CONFIG[p.resource];
  const Icon = cfg.icon;

  const severityColor =
    p.daysRemaining === null
      ? "border-gray-700"
      : p.daysRemaining <= 90
        ? "border-red-500/40 bg-red-500/5"
        : p.daysRemaining <= 180
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-green-500/20 bg-green-500/5";

  const badgeVariant =
    p.daysRemaining === null
      ? "default"
      : p.daysRemaining <= 90
        ? "critical"
        : p.daysRemaining <= 180
          ? "warning"
          : "active";

  return (
    <Card className={cn(severityColor)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-lg bg-${cfg.color}-500/15 p-2`}
          >
            <Icon className={`h-4 w-4 text-${cfg.color}-400`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">
              {t(`capacity.forecast.res.${p.resource}`)}
            </p>
            <p className="text-xs text-gray-500">
              {p.current.toLocaleString()} / {p.capacity.toLocaleString()}{" "}
              {cfg.unit}
            </p>
          </div>
        </div>
        <Badge variant={badgeVariant}>
          {p.utilizationPct.toFixed(1)}%
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            p.utilizationPct >= 90
              ? "bg-red-500"
              : p.utilizationPct >= 75
                ? "bg-amber-500"
                : p.utilizationPct >= 50
                  ? "bg-blue-500"
                  : "bg-green-500",
          )}
          style={{ width: `${Math.min(p.utilizationPct, 100)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-500">
          +{p.monthlyGrowthRate} {cfg.unit}/{t("capacity.forecast.mo")}
        </span>
        {p.exhaustionDate ? (
          <span
            className={cn(
              "font-medium",
              p.daysRemaining !== null && p.daysRemaining <= 90
                ? "text-red-400"
                : p.daysRemaining !== null && p.daysRemaining <= 180
                  ? "text-amber-400"
                  : "text-green-400",
            )}
          >
            {p.daysRemaining === 0
              ? t("capacity.forecast.alreadyFull")
              : `D-${p.daysRemaining} (${p.exhaustionDate})`}
          </span>
        ) : (
          <span className="text-gray-600">
            {t("capacity.forecast.noExhaustion")}
          </span>
        )}
      </div>
    </Card>
  );
}
