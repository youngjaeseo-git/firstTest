"use client";

import { useState } from "react";
import { MetricChart } from "./metric-chart";
import { queries } from "@/lib/prometheus";

const DURATIONS = [
  { label: "15m", value: 15, step: "15s" },
  { label: "1h", value: 60, step: "30s" },
  { label: "6h", value: 360, step: "2m" },
  { label: "24h", value: 1440, step: "5m" },
  { label: "7d", value: 10080, step: "30m" },
];

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatBytesPerSec = (bytes: number) => `${formatBytes(bytes)}/s`;

const formatPercent = (v: number) => `${v.toFixed(1)}%`;
const formatCelsius = (v: number) => `${v.toFixed(1)}°C`;
const formatWatts = (v: number) => `${v.toFixed(0)} W`;

export function ServerDetailClient({ instance }: { instance: string }) {
  const [duration, setDuration] = useState(DURATIONS[1]);

  return (
    <div className="space-y-4">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Range:</span>
        <div className="flex gap-1">
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              onClick={() => setDuration(d)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                duration.label === d.label
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-500">
          instance: <span className="font-mono">{instance}</span>
        </span>
      </div>

      {/* CPU & Memory row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="CPU Usage"
          unit="%"
          series={[
            {
              label: "CPU",
              query: queries.cpuUsage(instance),
              color: "#3b82f6",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
        <MetricChart
          title="Memory Usage"
          unit="%"
          series={[
            {
              label: "Memory",
              query: queries.memoryUsage(instance),
              color: "#10b981",
            },
            {
              label: "Swap",
              query: queries.swapUsage(instance),
              color: "#f59e0b",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
      </div>

      {/* Disk & Network row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Disk I/O"
          unit="Bytes/s"
          series={[
            {
              label: "Read",
              query: queries.diskIORead(instance),
              color: "#8b5cf6",
            },
            {
              label: "Write",
              query: queries.diskIOWrite(instance),
              color: "#ec4899",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatBytesPerSec}
        />
        <MetricChart
          title="Network Traffic"
          unit="Bytes/s"
          series={[
            {
              label: "RX",
              query: queries.networkRx(instance),
              color: "#06b6d4",
            },
            {
              label: "TX",
              query: queries.networkTx(instance),
              color: "#84cc16",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatBytesPerSec}
        />
      </div>

      {/* Disk usage & Temperature row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Disk Usage"
          unit="%"
          series={[
            {
              label: "Disk",
              query: queries.diskUsage(instance),
              color: "#f97316",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
        <MetricChart
          title="Temperature"
          unit="°C"
          series={[
            {
              label: "Temp",
              query: queries.temperature(instance),
              color: "#ef4444",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatCelsius}
        />
      </div>

      {/* Power & Fan row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Power Consumption"
          unit="Watts"
          series={[
            {
              label: "Power",
              query: queries.powerWatts(instance),
              color: "#fbbf24",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatWatts}
        />
        <MetricChart
          title="Fan Speed"
          unit="RPM"
          series={[
            {
              label: "Fan",
              query: queries.fanSpeed(instance),
              color: "#a78bfa",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(0)}`}
        />
      </div>
    </div>
  );
}
