"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartSkeleton } from "@/components/ui/skeleton";

interface Series {
  label: string;
  query: string;
  color: string;
}

interface MetricChartProps {
  title: string;
  unit: string;
  series: Series[];
  durationMin?: number;
  step?: string;
  yDomain?: [number | "auto", number | "auto"];
  formatValue?: (v: number) => string;
  refreshSec?: number;
  height?: number;
}

interface ChartPoint {
  time: number;
  [key: string]: number;
}

interface PromResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      values: Array<[number, string]>;
    }>;
  };
}

function CustomTooltip({
  active,
  payload,
  label,
  formatY,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  formatY: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-900/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-medium text-gray-400">
        {label ? new Date(label).toLocaleString("ko-KR") : ""}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-400">{entry.name}</span>
            <span className="ml-auto text-xs font-semibold text-gray-100">
              {formatY(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload || payload.length <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[11px] text-gray-400">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MetricChart({
  title,
  unit,
  series,
  durationMin = 60,
  step = "30s",
  yDomain = [0, "auto"],
  formatValue,
  refreshSec = 30,
  height = 240,
}: MetricChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const seriesKey = useMemo(
    () => series.map((s) => s.query).join("|"),
    [series],
  );

  const stepSec = useMemo(() => {
    const match = step.match(/^(\d+)([sm])$/);
    if (!match) return 30;
    const val = parseInt(match[1]);
    return match[2] === "m" ? val * 60 : val;
  }, [step]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const results = await Promise.all(
          series.map((s) =>
            fetch(
              `/api/metrics/range?query=${encodeURIComponent(s.query)}&duration=${durationMin}&step=${step}`
            ).then((r) => r.json() as Promise<PromResponse>)
          )
        );

        if (cancelled) return;

        const errs = results.filter(
          (r) => !r.data || r.status !== "success"
        );
        if (errs.length === results.length) {
          setError("Prometheus data unavailable");
          setLoading(false);
          return;
        }

        const timeMap = new Map<number, ChartPoint>();
        results.forEach((resp, idx) => {
          const label = series[idx].label;
          if (!resp.data?.result) return;
          resp.data.result.forEach((metric) => {
            metric.values?.forEach(([ts, val]) => {
              const t = Math.round(ts / stepSec) * stepSec * 1000;
              if (!timeMap.has(t)) {
                timeMap.set(t, { time: t });
              }
              timeMap.get(t)![label] = parseFloat(val);
            });
          });
        });

        const points = Array.from(timeMap.values()).sort(
          (a, b) => a.time - b.time
        );
        setData(points);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Connection failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, refreshSec * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMin, step, refreshSec, seriesKey]);

  const formatTick = (v: number) =>
    new Date(v).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatY = formatValue || ((v: number) => v.toFixed(1));

  if (loading && data.length === 0) {
    return <ChartSkeleton height={height} />;
  }

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm transition-all duration-200 hover:border-gray-700/60">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        <span className="rounded-md bg-gray-800/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          {unit}
        </span>
      </div>

      {error && data.length === 0 && (
        <div
          className="flex flex-col items-center justify-center text-sm text-gray-500"
          style={{ height }}
        >
          <div className="rounded-lg bg-red-500/10 p-3 mb-2">
            <p className="text-xs text-red-400 font-medium">{error}</p>
          </div>
          <p className="text-[11px] text-gray-600">
            Check Prometheus connectivity
          </p>
        </div>
      )}

      {data.length > 0 && (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={`grad-${s.label}`}
                  id={`grad-${s.label.replace(/\s+/g, "_")}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" strokeOpacity={0.5} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTick}
              stroke="#374151"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={formatY}
              stroke="#374151"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip
              content={<CustomTooltip formatY={formatY} />}
              cursor={{ stroke: "#4b5563", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Legend content={<CustomLegend />} />
            {series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
                activeDot={{
                  r: 4,
                  fill: s.color,
                  stroke: "#111827",
                  strokeWidth: 2,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
