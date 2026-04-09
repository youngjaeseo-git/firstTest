"use client";

import { useEffect, useState } from "react";
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

        // Check for errors
        const errs = results.filter(
          (r) => !r.data || r.status !== "success"
        );
        if (errs.length === results.length) {
          setError("Prometheus 데이터를 가져올 수 없습니다.");
          setData([]);
          setLoading(false);
          return;
        }

        // Merge series by timestamp
        const timeMap = new Map<number, ChartPoint>();
        results.forEach((resp, idx) => {
          const label = series[idx].label;
          if (!resp.data?.result) return;
          const firstMetric = resp.data.result[0];
          if (!firstMetric) return;
          firstMetric.values?.forEach(([ts, val]) => {
            const t = ts * 1000;
            if (!timeMap.has(t)) {
              timeMap.set(t, { time: t });
            }
            timeMap.get(t)![label] = parseFloat(val);
          });
        });

        const points = Array.from(timeMap.values()).sort(
          (a, b) => a.time - b.time
        );
        setData(points);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Prometheus 연결 실패");
          setData([]);
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
  }, [durationMin, step, refreshSec, series]);

  const formatTick = (v: number) =>
    new Date(v).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatY = formatValue || ((v: number) => v.toFixed(1));

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>

      {loading && data.length === 0 && (
        <div
          className="flex items-center justify-center text-sm text-gray-500"
          style={{ height }}
        >
          Loading...
        </div>
      )}

      {error && data.length === 0 && !loading && (
        <div
          className="flex flex-col items-center justify-center text-sm text-gray-500"
          style={{ height }}
        >
          <p className="text-red-400">⚠ {error}</p>
          <p className="mt-1 text-xs">
            Prometheus가 접근 가능한지 확인하세요.
          </p>
        </div>
      )}

      {data.length > 0 && (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTick}
              stroke="#6b7280"
              fontSize={11}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={formatY}
              stroke="#6b7280"
              fontSize={11}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              labelFormatter={(v) => new Date(v as number).toLocaleString("ko-KR")}
              formatter={(value: number) => [formatY(value), ""]}
            />
            {series.length > 1 && (
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            )}
            {series.map((s) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
