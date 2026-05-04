"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompareArrows, Search } from "lucide-react";
import { MetricChart } from "./metric-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { queries } from "@/lib/prometheus";
import { useT } from "@/lib/i18n/i18n-context";

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

const COMPARE_METRIC_KEYS = ["compare.cpuUsage", "compare.memoryUsage", "compare.loadAvg", "compare.diskIo", "compare.networkRx", "compare.temperature"];

const COMPARE_METRICS_BASE: CompareMetric[] = [
  {
    title: "CPU Usage",
    unit: "%",
    queryFn: (i: string) => queries.cpuUsage(i),
    formatValue: (v: number) => `${v.toFixed(1)}%`,
    yDomain: [0, 100],
  },
  {
    title: "Memory Usage",
    unit: "%",
    queryFn: (i: string) => queries.memoryUsage(i),
    formatValue: (v: number) => `${v.toFixed(1)}%`,
    yDomain: [0, 100],
  },
  {
    title: "Load Average (1m)",
    unit: "",
    queryFn: (i: string) => queries.loadAvg1(i),
    formatValue: (v: number) => v.toFixed(2),
  },
  {
    title: "Disk I/O (Read)",
    unit: "bytes/s",
    queryFn: (i: string) => queries.diskIORead(i),
    formatValue: (v: number) => formatBytes(v) + "/s",
  },
  {
    title: "Network RX",
    unit: "bytes/s",
    queryFn: (i: string) => queries.networkRx(i),
    formatValue: (v: number) => formatBytes(v) + "/s",
  },
  {
    title: "Temperature",
    unit: "°C",
    queryFn: (i: string) => queries.temperature(i),
    formatValue: (v: number) => `${v.toFixed(1)}°C`,
  },
];
const COMPARE_METRICS = COMPARE_METRICS_BASE;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ServerCompareClient({ servers }: { servers: ServerInfo[] }) {
  const t = useT();
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
            {t("nav.servers")}
          </Link>
          <span>/</span>
          <span>{t("compare.title")}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("compare.title")}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {t("compare.description")}
        </p>
      </div>

      {/* Server selector */}
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300">
            {t("compare.selectServersHeader")}
            <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-400">
              {selected.length}/4
            </span>
          </h3>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t("compare.clearSelection")}
            </button>
          )}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder={t("compare.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700/60 bg-gray-800/60 pl-10 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

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
              {t("compare.noServers")}
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      {selectedServers.length >= 2 && (
        <>
          {/* Time range selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("server.range")}</span>
            <div className="flex rounded-lg border border-gray-800/80 bg-gray-800/40 p-0.5">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  onClick={() => setDuration(d)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    duration.label === d.label
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                      : "text-gray-400 hover:text-gray-200"
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
            {COMPARE_METRICS.map((metric, idx) => (
              <MetricChart
                key={metric.title}
                title={t(COMPARE_METRIC_KEYS[idx]) || metric.title}
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
        <EmptyState
          icon={GitCompareArrows}
          title={t("compare.needMore")}
          description={t("compare.needMoreDesc")}
        />
      )}

      {selected.length === 0 && (
        <EmptyState
          icon={GitCompareArrows}
          title={t("compare.selectServers")}
          description={t("compare.emptyDesc")}
        />
      )}
    </div>
  );
}
