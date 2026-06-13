"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Cpu, Thermometer, Clock, Wifi, WifiOff, Zap, Database, Network, MemoryStick, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import { queries } from "@/lib/prometheus";
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

interface SparklinePoint {
  t: number;
  v: number;
}

function formatBytes(bps: number): string {
  if (bps === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return `${(bps / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

async function fetchRange(
  query: string,
  durationMin = 30,
): Promise<{ metric: Record<string, string>; values?: [number, string][] }[]> {
  try {
    const res = await fetch(
      `/api/metrics/range?query=${encodeURIComponent(query)}&duration=${durationMin}&step=60s`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.result ?? [];
  } catch {
    return [];
  }
}

function toSpark(results: { values?: [number, string][] }[]): SparklinePoint[] {
  const vals = results[0]?.values;
  if (!vals) return [];
  return vals.map(([ts, v]) => ({ t: ts, v: parseFloat(v) || 0 }));
}

function MiniSparkline({ data, color }: { data: SparklinePoint[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <div className="mt-2 h-[32px] -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PueGaugeArc({ value }: { value: number | null }) {
  if (value === null) return null;
  const min = 1.0;
  const max = 2.0;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  const arcAngle = 180;
  const endAngle = ratio * arcAngle;

  const r = 28;
  const cx = 36;
  const cy = 32;

  const toXY = (deg: number) => ({
    x: cx - r * Math.cos((deg * Math.PI) / 180),
    y: cy - r * Math.sin((deg * Math.PI) / 180),
  });

  const bgStart = toXY(0);
  const bgEnd = toXY(180);
  const valEnd = toXY(endAngle);
  const largeArc = endAngle > 90 ? 1 : 0;

  const color = value < 1.4 ? "#10b981" : value < 1.6 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex justify-center mt-1 -mb-1">
      <svg width="72" height="36" viewBox="0 0 72 36">
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`}
          fill="none"
          stroke="rgb(55 65 81 / 0.4)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {endAngle > 0 && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}
        <text x={4} y={35} fontSize="7" fill="rgb(107 114 128)" textAnchor="start">1.0</text>
        <text x={68} y={35} fontSize="7" fill="rgb(107 114 128)" textAnchor="end">2.0</text>
      </svg>
    </div>
  );
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
  const [memTemp, setMemTemp] = useState<{ avgMemTemp: number | null; serverCount: number }>({ avgMemTemp: null, serverCount: 0 });
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
      source.close();
      sourceRef.current = null;
      setData((prev) => ({ ...prev, error: "Connection failed" }));
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [cluster]);

  useEffect(() => {
    const fetchMemTemp = () =>
      fetch("/api/metrics/memory-temp")
        .then((r) => r.json())
        .then((j) => setMemTemp({ avgMemTemp: j.avgMemTemp, serverCount: j.serverCount }))
        .catch(() => {});
    fetchMemTemp();
    const timer = setInterval(fetchMemTemp, 60_000);
    return () => clearInterval(timer);
  }, []);

  const [cpuSpark, setCpuSpark] = useState<SparklinePoint[]>([]);
  const [memSpark, setMemSpark] = useState<SparklinePoint[]>([]);
  const [netSpark, setNetSpark] = useState<SparklinePoint[]>([]);
  const [powerSpark, setPowerSpark] = useState<SparklinePoint[]>([]);
  const [pueSpark, setPueSpark] = useState<SparklinePoint[]>([]);
  const [pueValue, setPueValue] = useState<number | null>(null);

  const fetchSparklines = useCallback(async () => {
    const [cpuRange, memRange, netRange, powerRange, pueRange] = await Promise.all([
      fetchRange(queries.fleetAvgCpu(cluster)),
      fetchRange(queries.fleetAvgMemory(cluster)),
      fetchRange(queries.fleetTotalNetworkRx(cluster)),
      fetchRange(queries.fleetTotalPower()),
      fetchRange(queries.fleetPue(), 1440),
    ]);
    setCpuSpark(toSpark(cpuRange));
    setMemSpark(toSpark(memRange));
    setNetSpark(toSpark(netRange));
    setPowerSpark(toSpark(powerRange));
    const puePoints = toSpark(pueRange);
    setPueSpark(puePoints);
    if (puePoints.length > 0) {
      setPueValue(puePoints[puePoints.length - 1].v);
    }
  }, [cluster]);

  useEffect(() => {
    fetchSparklines();
    const timer = setInterval(fetchSparklines, 30_000);
    return () => clearInterval(timer);
  }, [fetchSparklines]);

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
        <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card className="flex-1 border-cyan-500/30 bg-gradient-to-br from-cyan-600/10 via-cyan-600/5 to-transparent hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5">
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
            <MiniSparkline data={cpuSpark} color="#06b6d4" />
          </Card>
        </motion.div>

        {/* Average Memory */}
        <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card className="flex-1 border-green-500/30 bg-gradient-to-br from-green-600/10 via-green-600/5 to-transparent hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/5">
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
            <MiniSparkline data={memSpark} color="#22c55e" />
          </Card>
        </motion.div>

        {/* Temperature */}
        <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card className="flex-1 border-orange-500/30 bg-gradient-to-br from-orange-600/10 via-orange-600/5 to-transparent hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.avgTemperature")}</p>
              <div className="rounded-xl bg-orange-500/15 p-1.5">
                <Thermometer className="h-4 w-4 text-orange-400" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <div>
                <p className="text-2xl font-bold text-gray-100">
                  {data.avgTemp !== null ? `${data.avgTemp.toFixed(1)}` : "-"}
                  <span className="text-lg text-gray-500">°C</span>
                </p>
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  CPU
                </p>
              </div>
              <div className="h-8 w-px bg-gray-700" />
              <div>
                <p className="text-2xl font-bold text-gray-100">
                  {memTemp.avgMemTemp !== null ? `${memTemp.avgMemTemp.toFixed(1)}` : "-"}
                  <span className="text-lg text-gray-500">°C</span>
                </p>
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <MemoryStick className="h-3 w-3" />
                  DIMM
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Total Power */}
        <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card className="flex-1 border-yellow-500/30 bg-gradient-to-br from-yellow-600/10 via-yellow-600/5 to-transparent hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/5">
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
            <MiniSparkline data={powerSpark} color="#eab308" />
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Nodes Up/Down */}
        <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card
            className={cn(
              "flex-1 border bg-gradient-to-br",
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
        <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card className="flex-1 border-indigo-500/30 bg-gradient-to-br from-indigo-600/10 via-indigo-600/5 to-transparent hover:border-indigo-500/50">
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
        <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card className="flex-1 border-sky-500/30 bg-gradient-to-br from-sky-600/10 via-sky-600/5 to-transparent hover:border-sky-500/50">
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
            <MiniSparkline data={netSpark} color="#0ea5e9" />
          </Card>
        </motion.div>

        {/* PUE */}
        <motion.div custom={7} variants={cardVariants} initial="hidden" animate="visible" className="flex">
          <Card className={cn(
            "flex-1 border bg-gradient-to-br",
            pueValue !== null && pueValue < 1.4
              ? "border-emerald-500/30 from-emerald-600/10 via-emerald-600/5 to-transparent hover:border-emerald-500/50"
              : pueValue !== null && pueValue < 1.6
                ? "border-amber-500/30 from-amber-600/10 via-amber-600/5 to-transparent hover:border-amber-500/50"
                : "border-red-500/30 from-red-600/10 via-red-600/5 to-transparent hover:border-red-500/50",
          )}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{t("dashboard.pue")}</p>
              <div className={cn(
                "rounded-xl p-1.5",
                pueValue !== null && pueValue < 1.4
                  ? "bg-emerald-500/15"
                  : pueValue !== null && pueValue < 1.6
                    ? "bg-amber-500/15"
                    : "bg-red-500/15",
              )}>
                <Gauge className={cn(
                  "h-4 w-4",
                  pueValue !== null && pueValue < 1.4
                    ? "text-emerald-400"
                    : pueValue !== null && pueValue < 1.6
                      ? "text-amber-400"
                      : "text-red-400",
                )} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-100">
                {pueValue !== null ? pueValue.toFixed(2) : "-"}
              </p>
              <span className={cn(
                "text-[10px] font-medium",
                pueValue !== null && pueValue < 1.4
                  ? "text-emerald-400"
                  : pueValue !== null && pueValue < 1.6
                    ? "text-amber-400"
                    : "text-red-400",
              )}>
                {pueValue !== null
                  ? pueValue < 1.4
                    ? t("dashboard.pue.good")
                    : pueValue < 1.6
                      ? t("dashboard.pue.average")
                      : t("dashboard.pue.poor")
                  : ""}
              </span>
            </div>
            <PueGaugeArc value={pueValue} />
            <MiniSparkline data={pueSpark} color={pueValue !== null && pueValue < 1.4 ? "#10b981" : pueValue !== null && pueValue < 1.6 ? "#f59e0b" : "#ef4444"} />
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
