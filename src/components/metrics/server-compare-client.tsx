"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MetricChart } from "./metric-chart";
import { queries } from "@/lib/prometheus";

interface ServerInfo {
  id: string;
  hostname: string;
  ipAddress: string | null;
  instance: string | null;
  room: string | null;
  rack: string | null;
  status: string;
}

const DURATIONS = [
  { label: "15m", value: 15, step: "15s" },
  { label: "1h", value: 60, step: "30s" },
  { label: "6h", value: 360, step: "2m" },
  { label: "24h", value: 1440, step: "5m" },
  { label: "7d", value: 10080, step: "30m" },
];

const PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#a855f7", // purple
];

interface CompareMetric {
  title: string;
  unit: string;
  queryFn: (instance: string) => string;
  formatValue: (v: number) => string;
  yDomain?: [number | "auto", number | "auto"];
}

const COMPARE_METRICS: CompareMetric[] = [
  {
    title: "CPU Usage",
    unit: "%",
    queryFn: (i) => queries.cpuUsage(i),
    formatValue: (v) => `${v.toFixed(1)}%`,
    yDomain: [0, 100],
  },
  {
    title: "Memory Usage",
    unit: "%",
    queryFn: (i) => queries.memoryUsage(i),
    formatValue: (v) => `${v.toFixed(1)}%`,
    yDomain: [0, 100],
  },
  {
    title: "Load Average (1m)",
    unit: "",
    queryFn: (i) => queries.loadAvg1(i),
    formatValue: (v) => v.toFixed(2),
  },
  {
    title: "Disk I/O (Read)",
    unit: "bytes/s",
    queryFn: (i) => queries.diskIORead(i),
    formatValue: (v) => formatBytes(v) + "/s",
  },
  {
    title: "Network RX",
    unit: "bytes/s",
    queryFn: (i) => queries.networkRx(i),
    formatValue: (v) => formatBytes(v) + "/s",
  },
  {
    title: "Temperature",
    unit: "°C",
    queryFn: (i) => queries.temperature(i),
    formatValue: (v) => `${v.toFixed(1)}°C`,
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ServerCompareClient({ servers }: { servers: ServerInfo[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [search, setSearch] = useState("");

  const availableServers = useMemo(
    () => servers.filter((s) => s.instance),
    [servers],
  );

  const filtered = useMemo(() => {
    if (!search) return availableServers;
    const q = search.toLowerCase();
    return availableServers.filter(
      (s) =>
        s.hostname.toLowerCase().includes(q) ||
        s.ipAddress?.includes(q) ||
        s.room?.toLowerCase().includes(q) ||
        s.rack?.toLowerCase().includes(q),
    );
  }, [availableServers, search]);

  const selectedServers = useMemo(
    () => availableServers.filter((s) => selected.includes(s.id)),
    [availableServers, selected],
  );

  const toggleServer = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const buildSeries = (metric: CompareMetric) =>
    selectedServers.map((srv, i) => ({
      label: srv.hostname,
      query: metric.queryFn(srv.instance!),
      color: PALETTE[i % PALETTE.length],
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/servers" className="hover:text-white">
            Servers
          </Link>
          <span>/</span>
          <span>비교</span>
        </div>
        <h1 className="text-2xl font-bold">서버 메트릭 비교</h1>
        <p className="text-gray-400 text-sm mt-1">
          2~4대 서버를 선택해 주요 메트릭을 나란히 비교합니다
        </p>
      </div>

      {/* Server selector */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">
            서버 선택
            <span className="ml-2 text-xs text-gray-500">
              {selected.length}/4 선택됨
            </span>
          </h3>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              선택 초기화
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="호스트명, IP, 룸, 랙으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-3 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />

        <div className="max-h-48 overflow-y-auto space-y-1">
          {filtered.map((srv) => {
            const isSelected = selected.includes(srv.id);
            const colorIdx = selected.indexOf(srv.id);
            return (
              <button
                key={srv.id}
                onClick={() => toggleServer(srv.id)}
                disabled={!isSelected && selected.length >= 4}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                  isSelected
                    ? "bg-blue-600/20 border border-blue-500/40"
                    : "bg-gray-800/50 border border-transparent hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {isSelected && (
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PALETTE[colorIdx] }}
                  />
                )}
                {!isSelected && (
                  <div className="w-3 h-3 rounded-full border border-gray-600 flex-shrink-0" />
                )}
                <span className="font-medium text-gray-200">{srv.hostname}</span>
                <span className="text-xs text-gray-500 font-mono">{srv.ipAddress}</span>
                {srv.room && (
                  <span className="text-xs text-gray-600 ml-auto">
                    {srv.room} / {srv.rack}
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Prometheus instance가 연결된 서버가 없습니다
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      {selectedServers.length >= 2 && (
        <>
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
            <div className="ml-auto flex gap-2">
              {selectedServers.map((srv, i) => (
                <span key={srv.id} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PALETTE[i] }}
                  />
                  {srv.hostname}
                </span>
              ))}
            </div>
          </div>

          {/* Metric charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {COMPARE_METRICS.map((metric) => (
              <MetricChart
                key={metric.title}
                title={metric.title}
                unit={metric.unit}
                series={buildSeries(metric)}
                durationMin={duration.value}
                step={duration.step}
                yDomain={metric.yDomain}
                formatValue={metric.formatValue}
                height={280}
              />
            ))}
          </div>
        </>
      )}

      {selectedServers.length < 2 && selected.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-500">
            비교하려면 최소 2대의 서버를 선택하세요
          </p>
        </div>
      )}

      {selected.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
            />
          </svg>
          <p className="text-gray-400 font-medium">서버를 선택해 비교를 시작하세요</p>
          <p className="text-gray-600 text-sm mt-1">
            위에서 2~4대의 서버를 클릭하면 메트릭 차트가 표시됩니다
          </p>
        </div>
      )}
    </div>
  );
}
