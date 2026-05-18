"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Cpu, Thermometer, Clock, Wifi, WifiOff, Zap, Database, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import type { Cluster } from "@/lib/prometheus";

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

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: "easeOut" as const },
  }),
};

export function PrometheusMetrics({ cluster, onClusterChange }: { cluster: Cluster; onClusterChange: (c: Cluster) => void }) {
  const t = useT();
  const sourceRef = useRef<EventSource | null>(null);
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
  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    if (typeof EventSource === "undefined") {
      fetch(`/api/metrics/dashboard?cluster=${cluster}`)
        .then((res) => res.json())
        .then((json) => setData({ ...json, error: null }))
        .catch(() =>
          setData((prev) => ({ ...prev, error: "Connection failed" })),
        );
      return;
    }

    const source = new EventSource(`/api/metrics/dashboard/stream?cluster=${cluster}`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        setData({ ...json, error: json.error ?? null });
      } catch {
        // Ignore malformed payloads
      }
    };

    source.onerror = () => {
      setData((prev) => ({ ...prev, error: "Connection failed" }));
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [cluster]);

  if (data.error && data.avgCpu === null) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-3 text-sm text-amber-400">
          <div className="rounded-xl bg-amber-500/15 p-2">
            <WifiOff className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{t("dashboard.prometheus.unavailable")}</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              {t("dashboard.prometheus.cannotFetch")}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const uptimeDays =
    data.avgUptime !== null ? Math.floor(data.avgUptime / 86400) : null;

  const TABS: { key: Cluster; label: string }[] = [
    { key: "all", label: "All" },
    { key: "lab1", label: "Lab-1" },
    { key: "lab3", label: "Lab-3" },
  ];

  return (
    <div className="space-y-4">
      {/* Cluster Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-800/50 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onClusterChange(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              cluster === tab.key
                ? "bg-gray-700 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Average CPU */}
        <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-600/10 via-cyan-600/5 to-transparent hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.avgCpu")}</p>
              <div className="rounded-xl bg-cyan-500/15 p-1.5">
                <Cpu className="h-4 w-4 text-cyan-400" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-100">
              {data.avgCpu !== null ? `${data.avgCpu.toFixed(1)}` : "-"}
              <span className="text-lg text-gray-500">%</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  (data.avgCpu || 0) > 80
                    ? "bg-red-500"
                    : (data.avgCpu || 0) > 60
                      ? "bg-amber-500"
                      : "bg-cyan-500",
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(data.avgCpu || 0, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </Card>
        </motion.div>

        {/* Average Memory */}
        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-green-500/30 bg-gradient-to-br from-green-600/10 via-green-600/5 to-transparent hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.avgMemory")}</p>
              <div className="rounded-xl bg-green-500/15 p-1.5">
                <Database className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-100">
              {data.avgMemory !== null ? `${data.avgMemory.toFixed(1)}` : "-"}
              <span className="text-lg text-gray-500">%</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-800">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  (data.avgMemory || 0) > 85
                    ? "bg-red-500"
                    : (data.avgMemory || 0) > 70
                      ? "bg-amber-500"
                      : "bg-green-500",
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(data.avgMemory || 0, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </Card>
        </motion.div>

        {/* Temperature */}
        <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-orange-500/30 bg-gradient-to-br from-orange-600/10 via-orange-600/5 to-transparent hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.avgTemperature")}</p>
              <div className="rounded-xl bg-orange-500/15 p-1.5">
                <Thermometer className="h-4 w-4 text-orange-400" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-100">
              {data.avgTemp !== null ? `${data.avgTemp.toFixed(1)}` : "-"}
              <span className="text-lg text-gray-500">°C</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">{t("dashboard.avgTemperature.sub")}</p>
          </Card>
        </motion.div>

        {/* Total Power */}
        <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 via-yellow-600/5 to-transparent hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.totalPower")}</p>
              <div className="rounded-xl bg-yellow-500/15 p-1.5">
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
            <p className="mt-1 text-xs text-gray-500">{t("dashboard.totalPower.sub")}</p>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Nodes Up/Down */}
        <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible">
          <Card
            className={cn(
              "border bg-gradient-to-br",
              data.nodesDown > 0
                ? "border-red-500/30 from-red-600/10 via-red-600/5 to-transparent hover:border-red-500/50"
                : "border-green-500/30 from-green-600/10 via-green-600/5 to-transparent hover:border-green-500/50",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.nodes")}</p>
              <div
                className={cn(
                  "rounded-xl p-1.5",
                  data.nodesDown > 0 ? "bg-red-500/15" : "bg-green-500/15",
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
              <span className="text-lg text-gray-500"> {t("dashboard.nodes.up")}</span>
            </p>
            {data.nodesDown > 0 && (
              <p className="mt-1 text-xs text-red-400 font-medium">
                {data.nodesDown} {t("dashboard.nodes.down")}
              </p>
            )}
            {data.nodesDown === 0 && (
              <p className="mt-1 text-xs text-gray-500">{t("dashboard.nodes.healthy")}</p>
            )}
          </Card>
        </motion.div>

        {/* Average Uptime */}
        <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-600/10 via-indigo-600/5 to-transparent hover:border-indigo-500/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.avgUptime")}</p>
              <div className="rounded-xl bg-indigo-500/15 p-1.5">
                <Clock className="h-4 w-4 text-indigo-400" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-100">
              {uptimeDays !== null ? uptimeDays : "-"}
              <span className="text-lg text-gray-500"> {t("dashboard.avgUptime.days")}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">{t("dashboard.avgUptime.sub")}</p>
          </Card>
        </motion.div>

        {/* Network RX */}
        <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-sky-500/30 bg-gradient-to-br from-sky-600/10 via-sky-600/5 to-transparent hover:border-sky-500/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.networkIn")}</p>
              <div className="rounded-xl bg-sky-500/15 p-1.5">
                <Network className="h-4 w-4 text-sky-400" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-100">
              {data.totalNetworkRxBps !== null
                ? formatBytes(data.totalNetworkRxBps)
                : "-"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {t("dashboard.networkIn.tx")}: {data.totalNetworkTxBps !== null ? formatBytes(data.totalNetworkTxBps) : "-"}
            </p>
          </Card>
        </motion.div>

        {/* GPU Placeholder */}
        <motion.div custom={7} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-600/5 via-purple-600/3 to-transparent flex flex-col justify-center items-center text-center">
            <div className="rounded-xl bg-purple-500/10 p-2 mb-2">
              <p className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">GPU</p>
            </div>
            <p className="text-xs text-gray-600 font-medium">dcgm-exporter</p>
            <p className="text-[10px] text-gray-700 mt-0.5">Install to enable</p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
