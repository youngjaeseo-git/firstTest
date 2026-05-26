"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Cpu,
  Database,
  Network,
  Zap,
  Crown,
  Activity,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import { queries } from "@/lib/prometheus";
import type { Cluster } from "@/lib/prometheus";
import { ActiveWorkloads } from "@/components/dashboard/active-workloads";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TopCpuServer {
  instance: string;
  cpuPercent: number;
}

interface SparklinePoint {
  t: number;
  v: number;
}

interface StatusCounts {
  active: number;
  maintenance: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bps: number): string {
  if (bps === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return `${(bps / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`;
  return `${watts.toFixed(0)} W`;
}

/** Fetch an instant Prometheus query via the internal API. */
async function fetchInstant(
  query: string,
): Promise<{ metric: Record<string, string>; value?: [number, string] }[]> {
  try {
    const res = await fetch(
      `/api/metrics/instant?query=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.result ?? [];
  } catch {
    return [];
  }
}

/** Fetch a range query (last N minutes, 30s step). */
async function fetchRange(
  query: string,
  durationMin = 30,
): Promise<
  { metric: Record<string, string>; values?: [number, string][] }[]
> {
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

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.35,
      ease: "easeOut" as const,
    },
  }),
};

const POLL_INTERVAL = 30_000; // 30s

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FleetOverview({ statusCounts, cluster = "all", hostnameIpMap = {} }: { statusCounts: StatusCounts; cluster?: Cluster; hostnameIpMap?: Record<string, string> }) {
  const t = useT();

  // Top-5 CPU
  const [topCpu, setTopCpu] = useState<TopCpuServer[]>([]);

  // Sparkline data (last 30min)
  const [cpuSpark, setCpuSpark] = useState<SparklinePoint[]>([]);
  const [memSpark, setMemSpark] = useState<SparklinePoint[]>([]);
  const [netSpark, setNetSpark] = useState<SparklinePoint[]>([]);
  const [powerSpark, setPowerSpark] = useState<SparklinePoint[]>([]);

  // Latest values (from sparkline last point or instant)
  const [latestCpu, setLatestCpu] = useState<number | null>(null);
  const [latestMem, setLatestMem] = useState<number | null>(null);
  const [latestNet, setLatestNet] = useState<number | null>(null);
  const [latestPower, setLatestPower] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    // ---- Top-5 CPU: NE(IP:port) + cAdvisor(hostname), dedup ----
    const [neResults, caResults] = await Promise.all([
      fetchInstant(queries.fleetTopCpu(cluster)),
      fetchInstant(queries.fleetTopCpuCadvisor(cluster)),
    ]);

    const seenIps = new Set<string>();
    const deduped: TopCpuServer[] = [];

    for (const r of neResults) {
      if (!r.value) continue;
      const ip = (r.metric.instance || "").replace(/:\d+$/, "");
      seenIps.add(ip);
      const displayName = hostnameIpMap[ip] || ip;
      deduped.push({ instance: displayName, cpuPercent: parseFloat(r.value[1]) });
    }

    for (const r of caResults) {
      if (!r.value) continue;
      const hostname = r.metric.instance || "";
      const ip = hostnameIpMap[hostname];
      if (ip && seenIps.has(ip)) continue;
      seenIps.add(ip || hostname);
      deduped.push({ instance: hostname, cpuPercent: parseFloat(r.value[1]) });
    }

    const parsed = deduped
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, 5);
    setTopCpu(parsed);

    // ---- Sparklines (range queries, last 30min) ----
    const [cpuRange, memRange, netRange, powerRange] = await Promise.all([
      fetchRange(queries.fleetAvgCpu(cluster)),
      fetchRange(queries.fleetAvgMemory(cluster)),
      fetchRange(queries.fleetTotalNetworkRx(cluster)),
      fetchRange(queries.fleetTotalPower()),
    ]);

    const toSpark = (
      results: { values?: [number, string][] }[],
    ): SparklinePoint[] => {
      const vals = results[0]?.values;
      if (!vals) return [];
      return vals.map(([ts, v]) => ({ t: ts, v: parseFloat(v) || 0 }));
    };

    const cpuPoints = toSpark(cpuRange);
    const memPoints = toSpark(memRange);
    const netPoints = toSpark(netRange);
    const powerPoints = toSpark(powerRange);

    setCpuSpark(cpuPoints);
    setMemSpark(memPoints);
    setNetSpark(netPoints);
    setPowerSpark(powerPoints);

    if (cpuPoints.length > 0) setLatestCpu(cpuPoints[cpuPoints.length - 1].v);
    if (memPoints.length > 0) setLatestMem(memPoints[memPoints.length - 1].v);
    if (netPoints.length > 0) setLatestNet(netPoints[netPoints.length - 1].v);
    if (powerPoints.length > 0)
      setLatestPower(powerPoints[powerPoints.length - 1].v);
  }, [cluster, hostnameIpMap]);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchAll]);

  // ---- Status donut data ----
  const total =
    statusCounts.active + statusCounts.maintenance + statusCounts.failed;
  const donutData = [
    { name: "Active", value: statusCounts.active, color: "#22c55e" },
    { name: "Maintenance", value: statusCounts.maintenance, color: "#f59e0b" },
    { name: "Failed", value: statusCounts.failed, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* ─── Section: Fleet Top 5 + Status Donut ────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top 5 CPU */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2"
        >
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/15 p-1.5">
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {t("dashboard.fleet.topCpu")}
              </h3>
            </div>
            {topCpu.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-600">
                  {t("common.noData")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topCpu.map((server, idx) => {
                  const barColor =
                    server.cpuPercent > 80
                      ? "bg-red-500"
                      : server.cpuPercent > 60
                        ? "bg-amber-500"
                        : "bg-cyan-500";
                  return (
                    <div key={server.instance} className="group">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500 w-5 text-right">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-sm text-gray-300 group-hover:text-gray-100 transition-colors truncate max-w-[280px]">
                            {server.instance}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            server.cpuPercent > 80
                              ? "text-red-400"
                              : server.cpuPercent > 60
                                ? "text-amber-400"
                                : "text-cyan-400",
                          )}
                        >
                          {server.cpuPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                        <motion.div
                          className={cn("h-full rounded-full", barColor)}
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(server.cpuPercent, 100)}%`,
                          }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Server Status Donut */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-green-500/15 p-1.5">
                <Activity className="h-4 w-4 text-green-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {t("dashboard.fleet.serverStatus")}
              </h3>
            </div>
            {total === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <p className="text-sm text-gray-600">{t("common.noData")}</p>
              </div>
            ) : (
              <div className="flex flex-1 items-center gap-4">
                <div className="relative h-[130px] w-[130px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={58}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donutData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.color}
                            opacity={0.85}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-xl font-bold text-gray-100">
                        {total}
                      </span>
                      <p className="text-[10px] text-gray-500">
                        {t("common.total")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <StatusRow
                    label={t("dashboard.fleet.active")}
                    count={statusCounts.active}
                    color="bg-green-500"
                    textColor="text-green-400"
                  />
                  <StatusRow
                    label={t("dashboard.fleet.maintenance")}
                    count={statusCounts.maintenance}
                    color="bg-amber-500"
                    textColor="text-amber-400"
                  />
                  <StatusRow
                    label={t("dashboard.fleet.failed")}
                    count={statusCounts.failed}
                    color="bg-red-500"
                    textColor="text-red-400"
                  />
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ─── Section: Active Workloads ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActiveWorkloads />
        </div>
      </div>

      {/* ─── Section: Fleet Sparklines ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SparklineCard
          index={2}
          icon={<Cpu className="h-4 w-4 text-cyan-400" />}
          iconBg="bg-cyan-500/15"
          title={t("dashboard.fleet.cpuTrend")}
          value={latestCpu !== null ? `${latestCpu.toFixed(1)}%` : "-"}
          data={cpuSpark}
          color="#06b6d4"
          gradientId="cpuGrad"
        />
        <SparklineCard
          index={3}
          icon={<Database className="h-4 w-4 text-green-400" />}
          iconBg="bg-green-500/15"
          title={t("dashboard.fleet.memTrend")}
          value={latestMem !== null ? `${latestMem.toFixed(1)}%` : "-"}
          data={memSpark}
          color="#22c55e"
          gradientId="memGrad"
        />
        <SparklineCard
          index={4}
          icon={<Network className="h-4 w-4 text-sky-400" />}
          iconBg="bg-sky-500/15"
          title={t("dashboard.fleet.netTrend")}
          value={latestNet !== null ? formatBytes(latestNet) : "-"}
          data={netSpark}
          color="#0ea5e9"
          gradientId="netGrad"
        />
        <SparklineCard
          index={5}
          icon={<Zap className="h-4 w-4 text-yellow-400" />}
          iconBg="bg-yellow-500/15"
          title={t("dashboard.fleet.powerTrend")}
          value={latestPower !== null ? formatPower(latestPower) : "-"}
          data={powerSpark}
          color="#eab308"
          gradientId="powerGrad"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusRow({
  label,
  count,
  color,
  textColor,
}: {
  label: string;
  count: number;
  color: string;
  textColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span className="text-xs text-gray-400">{label}</span>
      <span className={cn("ml-auto font-mono text-sm font-bold", textColor)}>
        {count}
      </span>
    </div>
  );
}

function SparklineCard({
  index,
  icon,
  iconBg,
  title,
  value,
  data,
  color,
  gradientId,
}: {
  index: number;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string;
  data: SparklinePoint[];
  color: string;
  gradientId: string;
}) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <Card className="relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("rounded-lg p-1.5", iconBg)}>{icon}</div>
            <p className="text-xs text-gray-400">{title}</p>
          </div>
          <TrendingUp className="h-3 w-3 text-gray-600" />
        </div>
        <p className="mt-2 text-xl font-bold text-gray-100">{value}</p>
        <div className="mt-2 h-[48px]">
          {data.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
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
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-[10px] text-gray-700">-</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
