"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Cpu,
  Crown,
  Activity,
  HardDrive,
  Building2,
  DoorOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import { queries } from "@/lib/prometheus";
import type { Cluster } from "@/lib/prometheus";
import { ActiveWorkloads } from "@/components/dashboard/active-workloads";
import type { PlatformStat } from "@/components/dashboard/dashboard-cluster-view";

interface TopServer {
  instance: string;
  percent: number;
}

interface StatusCounts {
  active: number;
  maintenance: number;
  failed: number;
}

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

const POLL_INTERVAL = 30_000;

const PLATFORM_COLORS: Record<string, string> = {
  "SPR": "#3b82f6",
  "GNR-AP": "#8b5cf6",
  "GNR-SP": "#06b6d4",
  "SRF": "#f59e0b",
  "Ampere": "#22c55e",
  "EMR": "#ec4899",
  "Other": "#6b7280",
};

function dedupTopResults(
  neResults: { metric: Record<string, string>; value?: [number, string] }[],
  caResults: { metric: Record<string, string>; value?: [number, string] }[],
  hostnameIpMap: Record<string, string>,
): TopServer[] {
  const bestByKey = new Map<string, TopServer>();

  function canonicalKey(raw: string): string {
    const host = raw.replace(/:\d+$/, "");
    const mapped = hostnameIpMap[host];
    if (mapped && /^\d+\.\d+\.\d+\.\d+$/.test(mapped)) return mapped;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
    if (mapped) return mapped;
    return host;
  }

  function displayName(raw: string): string {
    const host = raw.replace(/:\d+$/, "");
    const mapped = hostnameIpMap[host];
    if (!mapped) return host;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return mapped;
    return host;
  }

  function upsert(instance: string, percent: number) {
    const key = canonicalKey(instance);
    const existing = bestByKey.get(key);
    if (!existing || percent > existing.percent) {
      bestByKey.set(key, { instance: displayName(instance), percent });
    }
  }

  for (const r of neResults) {
    if (!r.value) continue;
    upsert(r.metric.instance || "", parseFloat(r.value[1]));
  }

  for (const r of caResults) {
    if (!r.value) continue;
    upsert(r.metric.instance || "", parseFloat(r.value[1]));
  }

  return Array.from(bestByKey.values())
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);
}

export function FleetOverview({
  statusCounts,
  cluster = "all",
  hostnameIpMap = {},
  platformStats = [],
  totalRacks = 0,
  totalRooms = 0,
}: {
  statusCounts: StatusCounts;
  cluster?: Cluster;
  hostnameIpMap?: Record<string, string>;
  platformStats?: PlatformStat[];
  totalRacks?: number;
  totalRooms?: number;
}) {
  const t = useT();

  const [topCpu, setTopCpu] = useState<TopServer[]>([]);
  const [topMem, setTopMem] = useState<TopServer[]>([]);

  const fetchAll = useCallback(async () => {
    const [neCpu, caCpu, neMem, caMem] = await Promise.all([
      fetchInstant(queries.fleetTopCpu(cluster)),
      fetchInstant(queries.fleetTopCpuCadvisor(cluster)),
      fetchInstant(queries.fleetTopMemory(cluster)),
      fetchInstant(queries.fleetTopMemoryCadvisor(cluster)),
    ]);

    setTopCpu(dedupTopResults(neCpu, caCpu, hostnameIpMap));
    setTopMem(dedupTopResults(neMem, caMem, hostnameIpMap));
  }, [cluster, hostnameIpMap]);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const total = statusCounts.active + statusCounts.maintenance + statusCounts.failed;
  const donutData = [
    { name: "Active", value: statusCounts.active, color: "#22c55e" },
    { name: "Maintenance", value: statusCounts.maintenance, color: "#f59e0b" },
    { name: "Failed", value: statusCounts.failed, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* ─── Section: Fleet Top 5 CPU + Memory ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopListCard
          index={0}
          icon={<Crown className="h-4 w-4 text-amber-400" />}
          iconBg="bg-amber-500/15"
          title={t("dashboard.fleet.topCpu")}
          items={topCpu}
          noDataText={t("common.noData")}
          barColors={{ high: "bg-red-500", mid: "bg-amber-500", low: "bg-cyan-500" }}
          textColors={{ high: "text-red-400", mid: "text-amber-400", low: "text-cyan-400" }}
        />
        <TopListCard
          index={1}
          icon={<HardDrive className="h-4 w-4 text-green-400" />}
          iconBg="bg-green-500/15"
          title="Fleet Top 5 — Memory"
          items={topMem}
          noDataText={t("common.noData")}
          barColors={{ high: "bg-red-500", mid: "bg-amber-500", low: "bg-green-500" }}
          textColors={{ high: "text-red-400", mid: "text-amber-400", low: "text-green-400" }}
        />
      </div>

      {/* ─── Section: Server Status (All + Platform) ───────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Infrastructure Summary (Server Status + Rack/Room) */}
        <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
          <Card className="flex flex-col h-full">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-green-500/15 p-1.5">
                <Activity className="h-4 w-4 text-green-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {t("dashboard.fleet.infraSummary") || "인프라 요약"}
              </h3>
            </div>
            {total === 0 ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <p className="text-sm text-gray-600">{t("common.noData")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-[110px] w-[110px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={34}
                          outerRadius={50}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {donutData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} opacity={0.85} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-lg font-bold text-gray-100">{total}</span>
                        <p className="text-[9px] text-gray-500">{t("common.total")}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <StatusRow label={t("dashboard.fleet.active")} count={statusCounts.active} color="bg-green-500" textColor="text-green-400" />
                    <StatusRow label={t("dashboard.fleet.maintenance")} count={statusCounts.maintenance} color="bg-amber-500" textColor="text-amber-400" />
                    <StatusRow label={t("dashboard.fleet.failed")} count={statusCounts.failed} color="bg-red-500" textColor="text-red-400" />
                  </div>
                </div>
                <div className="border-t border-gray-800 pt-3 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-gray-800/30 px-3 py-2">
                    <DoorOpen className="h-4 w-4 text-purple-400" />
                    <div>
                      <p className="text-lg font-bold text-gray-100">{totalRooms}</p>
                      <p className="text-[10px] text-gray-500">Rooms</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-gray-800/30 px-3 py-2">
                    <Building2 className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-lg font-bold text-gray-100">{totalRacks}</p>
                      <p className="text-[10px] text-gray-500">Racks</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Platform Breakdown */}
        <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible" className="lg:col-span-2">
          <Card className="h-full">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-lg bg-violet-500/15 p-1.5">
                <Cpu className="h-4 w-4 text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Platform Status
              </h3>
            </div>
            {platformStats.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-600">{t("common.noData")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {platformStats.map((p) => {
                  const pct = p.total > 0 ? Math.round((p.active / p.total) * 100) : 0;
                  const color = PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.Other;
                  return (
                    <div
                      key={p.platform}
                      className="rounded-lg border border-gray-800 bg-gray-800/30 p-3 transition-colors hover:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color }}>
                          {p.platform}
                        </span>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-lg font-bold text-gray-100">{p.active}</span>
                        <span className="text-xs text-gray-500">/ {p.total}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {p.total - p.active > 0 ? `${p.total - p.active} offline` : "all active"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ─── Section: Active Workloads ─────────────────────────────── */}
      <ActiveWorkloads cluster={cluster} hostnameIpMap={hostnameIpMap} />
    </div>
  );
}

function TopListCard({
  index,
  icon,
  iconBg,
  title,
  items,
  noDataText,
  barColors,
  textColors,
}: {
  index: number;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  items: TopServer[];
  noDataText: string;
  barColors: { high: string; mid: string; low: string };
  textColors: { high: string; mid: string; low: string };
}) {
  return (
    <motion.div custom={index} variants={cardVariants} initial="hidden" animate="visible">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <div className={cn("rounded-lg p-1.5", iconBg)}>{icon}</div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            {title}
          </h3>
        </div>
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-600">{noDataText}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((server, idx) => {
              const barColor = server.percent > 80 ? barColors.high : server.percent > 60 ? barColors.mid : barColors.low;
              const textColor = server.percent > 80 ? textColors.high : server.percent > 60 ? textColors.mid : textColors.low;
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
                    <span className={cn("text-sm font-bold tabular-nums", textColor)}>
                      {server.percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                    <motion.div
                      className={cn("h-full rounded-full", barColor)}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(server.percent, 100)}%` }}
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
  );
}

function StatusRow({ label, count, color, textColor }: { label: string; count: number; color: string; textColor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span className="text-xs text-gray-400">{label}</span>
      <span className={cn("ml-auto font-mono text-sm font-bold", textColor)}>{count}</span>
    </div>
  );
}

