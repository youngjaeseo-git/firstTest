"use client";

import { useState } from "react";
import { MetricChart } from "./metric-chart";
import { CpuCoreHeatmap } from "./cpu-core-heatmap";
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
const formatMs = (v: number) => `${v.toFixed(1)} ms`;
const formatIOPS = (v: number) => `${v.toFixed(0)} IOPS`;

export function ServerDetailClient({ instance }: { instance: string }) {
  const [duration, setDuration] = useState(DURATIONS[1]);

  return (
    <div className="space-y-6">
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

      {/* ── Section 1: CPU ── */}
      <SectionHeader title="CPU" />
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
          title="Load Average"
          unit=""
          series={[
            { label: "1m", query: queries.loadAvg1(instance), color: "#f59e0b" },
            { label: "5m", query: queries.loadAvg5(instance), color: "#ef4444" },
            { label: "15m", query: queries.loadAvg15(instance), color: "#8b5cf6" },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => v.toFixed(2)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="CPU Mode Breakdown"
          unit="%"
          series={[
            { label: "user", query: queries.cpuModeUser(instance), color: "#3b82f6" },
            { label: "system", query: queries.cpuModeSystem(instance), color: "#ef4444" },
            { label: "iowait", query: queries.cpuModeIowait(instance), color: "#f59e0b" },
            { label: "steal", query: queries.cpuModeSteal(instance), color: "#6b7280" },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
        <MetricChart
          title="Processes"
          unit=""
          series={[
            { label: "Running", query: queries.procsRunning(instance), color: "#10b981" },
            { label: "Blocked", query: queries.procsBlocked(instance), color: "#ef4444" },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(0)}`}
        />
      </div>

      {/* CPU Core Heatmap - full width */}
      <CpuCoreHeatmap instance={instance} />

      {/* ── Section 2: Memory ── */}
      <SectionHeader title="Memory" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
        <MetricChart
          title="Memory (Absolute)"
          unit="bytes"
          series={[
            {
              label: "Used",
              query: queries.memoryUsedBytes(instance),
              color: "#10b981",
            },
            {
              label: "Cache+Buffer",
              query: queries.memoryCached(instance),
              color: "#6366f1",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatBytes}
        />
      </div>

      {/* ── Section 3: Disk ── */}
      <SectionHeader title="Disk / Storage" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Disk I/O Throughput"
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
          title="Disk IOPS"
          unit="ops/s"
          series={[
            {
              label: "Read IOPS",
              query: queries.diskReadIOPS(instance),
              color: "#8b5cf6",
            },
            {
              label: "Write IOPS",
              query: queries.diskWriteIOPS(instance),
              color: "#ec4899",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatIOPS}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Disk I/O Latency"
          unit="ms"
          series={[
            {
              label: "Read",
              query: queries.diskReadLatency(instance),
              color: "#8b5cf6",
            },
            {
              label: "Write",
              query: queries.diskWriteLatency(instance),
              color: "#ec4899",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatMs}
        />
        <MetricChart
          title="Disk Usage"
          unit="%"
          series={[
            {
              label: "Usage",
              query: queries.diskUsage(instance),
              color: "#f97316",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          yDomain={[0, 100]}
          formatValue={formatPercent}
        />
      </div>

      {/* ── Section 4: Network ── */}
      <SectionHeader title="Network" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Network Bandwidth"
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
        <MetricChart
          title="Network Errors & Drops"
          unit="pkt/s"
          series={[
            {
              label: "RX Errors",
              query: queries.networkRxErrors(instance),
              color: "#ef4444",
            },
            {
              label: "TX Errors",
              query: queries.networkTxErrors(instance),
              color: "#f97316",
            },
            {
              label: "RX Drops",
              query: queries.networkRxDrops(instance),
              color: "#dc2626",
            },
            {
              label: "TX Drops",
              query: queries.networkTxDrops(instance),
              color: "#ea580c",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(2)} pkt/s`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="TCP Connections"
          unit=""
          series={[
            {
              label: "Established",
              query: queries.tcpEstablished(instance),
              color: "#06b6d4",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(0)}`}
        />
        <MetricChart
          title="TCP Retransmits"
          unit="segs/s"
          series={[
            {
              label: "Retransmit",
              query: queries.tcpRetransmits(instance),
              color: "#f59e0b",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={(v) => `${v.toFixed(2)}/s`}
        />
      </div>

      {/* ── Section 5: Hardware / Thermal ── */}
      <SectionHeader title="Hardware / Thermal" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricChart
          title="Temperature (hwmon)"
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
        <MetricChart
          title="IPMI Temperatures"
          unit="°C"
          series={[
            {
              label: "Inlet",
              query: queries.inletTemp(instance),
              color: "#06b6d4",
            },
            {
              label: "Exhaust",
              query: queries.exhaustTemp(instance),
              color: "#f97316",
            },
            {
              label: "CPU Socket",
              query: queries.cpuSocketTemp(instance),
              color: "#ef4444",
            },
          ]}
          durationMin={duration.value}
          step={duration.step}
          formatValue={formatCelsius}
        />
      </div>
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
          formatValue={(v) => `${v.toFixed(0)} RPM`}
        />
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        {title}
      </h3>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}
