"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, MetricError } from "@/components/ui/states";
import { SectionHeading } from "@/components/ui/section-heading";
import { FlaskConical, Clock, Server, Calendar, Thermometer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import { queries } from "@/lib/prometheus";
import type { Cluster } from "@/lib/prometheus";

type PodHealth = "running" | "pending" | "warning" | "error" | "succeeded";

interface WorkloadPod {
  name: string;
  node: string;
  ageSeconds: number;
  createdDate: string;
  phase: string;
  waitingReason: string;
  health: PodHealth;
  ownerName: string;
}

interface NodeTemp {
  node: string;
  temp: number;
}

interface WorkloadGroup {
  namespace: string;
  pods: WorkloadPod[];
  nodes: string[];
  worstHealth: PodHealth;
  nodeTemps: NodeTemp[];
  workloadNames: string[];
}

async function fetchInstant(
  query: string,
  source?: "lab3",
): Promise<{ metric: Record<string, string>; value?: [number, string] }[]> {
  try {
    let url = `/api/metrics/instant?query=${encodeURIComponent(query)}`;
    if (source) url += `&source=${source}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.result ?? [];
  } catch {
    return [];
  }
}

function formatAge(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 60)}m`;
}

function extractOwnerName(createdByKind: string, createdByName: string): string {
  if (!createdByName) return "";
  if (createdByKind === "ReplicaSet") {
    return createdByName.replace(/-[a-z0-9]{8,10}$/, "");
  }
  return createdByName;
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

const HEALTH_PRIORITY: Record<PodHealth, number> = {
  error: 4,
  warning: 3,
  pending: 2,
  succeeded: 1,
  running: 0,
};

function podHealthFromPhaseAndReason(phase: string, waitingReason: string): PodHealth {
  if (waitingReason === "CrashLoopBackOff" || waitingReason === "CreateContainerError" || phase === "Failed") {
    return "error";
  }
  if (waitingReason === "ImagePullBackOff" || waitingReason === "ErrImagePull" || waitingReason === "CreateContainerConfigError") {
    return "warning";
  }
  if (phase === "Pending" || waitingReason) {
    return "pending";
  }
  if (phase === "Succeeded") {
    return "succeeded";
  }
  return "running";
}

function worstHealth(pods: WorkloadPod[]): PodHealth {
  let worst: PodHealth = "running";
  pods.forEach((p) => {
    if (HEALTH_PRIORITY[p.health] > HEALTH_PRIORITY[worst]) {
      worst = p.health;
    }
  });
  return worst;
}

const HEALTH_STYLES: Record<PodHealth, { dot: string; text: string; badge: string; label: string }> = {
  running: {
    dot: "bg-green-500",
    text: "text-green-400",
    badge: "bg-green-700/40 text-green-300",
    label: "Running",
  },
  pending: {
    dot: "bg-yellow-500",
    text: "text-yellow-400",
    badge: "bg-yellow-700/40 text-yellow-300",
    label: "Pending",
  },
  warning: {
    dot: "bg-orange-500",
    text: "text-orange-400",
    badge: "bg-orange-700/40 text-orange-300",
    label: "Warning",
  },
  error: {
    dot: "bg-red-500",
    text: "text-red-400",
    badge: "bg-red-700/40 text-red-300",
    label: "Error",
  },
  succeeded: {
    dot: "bg-gray-500",
    text: "text-gray-400",
    badge: "bg-gray-700/40 text-gray-400",
    label: "Completed",
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.15, duration: 0.35, ease: "easeOut" as const },
  },
};

export function ActiveWorkloads({
  cluster = "all",
  hostnameIpMap = {},
}: {
  cluster?: Cluster;
  hostnameIpMap?: Record<string, string>;
}) {
  const t = useT();
  const [groups, setGroups] = useState<WorkloadGroup[]>([]);
  const [totalPods, setTotalPods] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lab3Failed, setLab3Failed] = useState(false);

  const fetchWorkloads = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);

    const needLab1 = cluster !== "lab3";
    const needLab3 = cluster === "all" || cluster === "lab3";

    let fetchFailed = false;
    let lab1PodResults: { metric: Record<string, string>; value?: [number, string] }[] = [];

    if (needLab1) {
      const podsRaw = await fetch(
        `/api/metrics/instant?query=${encodeURIComponent(queries.workloadPods())}`,
      )
        .then((r) => {
          if (!r.ok) throw new Error("workload pods query failed");
          return r.json();
        })
        .catch(() => {
          fetchFailed = true;
          return null;
        });

      if (fetchFailed) {
        setError(true);
        setLoading(false);
        return;
      }
      lab1PodResults = podsRaw?.data?.result ?? [];
    }

    let lab3DidFail = false;
    const [lab3Pods, lab3Created, lab3Phase, lab3Waiting] = needLab3
      ? await Promise.all([
          fetchInstant(queries.workloadPods(), "lab3"),
          fetchInstant(queries.workloadPodCreated(), "lab3"),
          fetchInstant(queries.workloadPodPhase(), "lab3"),
          fetchInstant(queries.workloadPodWaitingReason(), "lab3"),
        ]).then((res) => {
          if (res[0].length === 0 && res[1].length === 0) lab3DidFail = true;
          return res;
        })
      : [[], [], [], []];

    const lab3NodeSet = new Set<string>();
    for (const r of lab3Pods) {
      const node = r.metric.node || "";
      if (node) lab3NodeSet.add(node);
    }

    const podResults = cluster === "lab3" ? lab3Pods : lab1PodResults.concat(
      lab3Pods.filter((r) => {
        const key = `${r.metric.namespace}/${r.metric.pod}`;
        return !lab1PodResults.some((l) => `${l.metric.namespace}/${l.metric.pod}` === key);
      }),
    );

    const lab1Extras = needLab1
      ? await Promise.all([
          fetchInstant(queries.workloadPodCreated()),
          fetchInstant(queries.workloadPodPhase()),
          fetchInstant(queries.workloadPodWaitingReason()),
        ])
      : [[], [], []];

    const [nodeTempData, nodeInfoResults] = await Promise.all([
      fetch("/api/metrics/node-temps").then((r) => r.ok ? r.json() : {}).catch(() => ({})) as Promise<Record<string, number>>,
      fetchInstant(queries.kubeNodeInfo()),
    ]);

    const createdResults = [...lab1Extras[0], ...lab3Created];
    const phaseResults = [...lab1Extras[1], ...lab3Phase];
    const waitingResults = [...lab1Extras[2], ...lab3Waiting];

    const createdMap: Record<string, number> = {};
    for (const r of createdResults) {
      const key = `${r.metric.namespace}/${r.metric.pod}`;
      if (r.value) createdMap[key] = parseFloat(r.value[1]);
    }

    const phaseMap: Record<string, string> = {};
    for (const r of phaseResults) {
      const key = `${r.metric.namespace}/${r.metric.pod}`;
      phaseMap[key] = r.metric.phase || "";
    }

    const waitingMap: Record<string, string> = {};
    for (const r of waitingResults) {
      const key = `${r.metric.namespace}/${r.metric.pod}`;
      waitingMap[key] = r.metric.reason || "";
    }

    const nsMap: Record<string, WorkloadGroup> = {};
    const allNodes = new Set<string>();

    for (const r of podResults) {
      const ns = r.metric.namespace || "default";
      const pod = r.metric.pod || "unknown";
      const node = r.metric.node || "";
      const key = `${ns}/${pod}`;
      const created = createdMap[key];
      const age = created ? now - created : 0;
      const createdDate = created ? formatDate(created) : "";
      const phase = phaseMap[key] || "Unknown";
      const waitingReason = waitingMap[key] || "";
      const health = podHealthFromPhaseAndReason(phase, waitingReason);
      const ownerName = extractOwnerName(r.metric.created_by_kind || "", r.metric.created_by_name || "");

      if (!nsMap[ns]) {
        nsMap[ns] = { namespace: ns, pods: [], nodes: [], worstHealth: "running", nodeTemps: [], workloadNames: [] };
      }
      nsMap[ns].pods.push({ name: pod, node, ageSeconds: age, createdDate, phase, waitingReason, health, ownerName });
      if (node) allNodes.add(node);
    }

    const groupList = Object.values(nsMap);
    groupList.forEach((g) => {
      const uniqueNodes: string[] = [];
      const seen = new Set<string>();
      g.pods.forEach((p) => {
        if (p.node && !seen.has(p.node)) {
          seen.add(p.node);
          uniqueNodes.push(p.node);
        }
      });
      g.nodes = uniqueNodes;
      g.worstHealth = worstHealth(g.pods);
      g.nodeTemps = uniqueNodes
        .map((n) => ({ node: n, temp: nodeTempData[n] ?? -1 }))
        .filter((nt) => nt.temp >= 0);
      const wlSet = new Set<string>();
      g.pods.forEach((p) => { if (p.ownerName) wlSet.add(p.ownerName); });
      g.workloadNames = Array.from(wlSet).sort();
    });

    const filtered = groupList
      .map((g) => {
        const filteredPods = g.pods.filter((p) => {
          if (!p.node) return false;
          if (cluster === "all") return true;
          if (cluster === "lab3") return lab3NodeSet.has(p.node);
          if (cluster === "lab1") {
            if (lab3NodeSet.has(p.node)) return false;
            return true;
          }
          return true;
        });
        if (filteredPods.length === 0) return null;
        const uniqueNodes = Array.from(new Set(filteredPods.map((p) => p.node).filter(Boolean)));
        return {
          ...g,
          pods: filteredPods,
          nodes: uniqueNodes,
          worstHealth: worstHealth(filteredPods),
          nodeTemps: uniqueNodes
            .map((n) => ({ node: n, temp: nodeTempData[n] ?? -1 }))
            .filter((nt) => nt.temp >= 0),
        };
      })
      .filter((g): g is WorkloadGroup => g !== null);

    const sorted = filtered.sort(
      (a, b) => HEALTH_PRIORITY[b.worstHealth] - HEALTH_PRIORITY[a.worstHealth] || b.pods.length - a.pods.length,
    );

    const filteredPodCount = sorted.reduce((s, g) => s + g.pods.length, 0);
    const filteredNodeSet = new Set(sorted.flatMap((g) => g.nodes));

    setGroups(sorted);
    setTotalPods(filteredPodCount);
    setTotalNodes(filteredNodeSet.size);
    setError(false);
    setLab3Failed(needLab3 && lab3DidFail);
    setLoading(false);
  }, [cluster, hostnameIpMap]);

  useEffect(() => {
    fetchWorkloads();
    const timer = setInterval(fetchWorkloads, 30_000);
    return () => clearInterval(timer);
  }, [fetchWorkloads]);

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      <Card>
        <SectionHeading
          icon={FlaskConical}
          accent="violet"
          title={
            <>
              Active Workloads{" "}
              <span className="font-normal normal-case text-gray-500">(Namespace)</span>
            </>
          }
          right={
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                {totalNodes} node{totalNodes !== 1 ? "s" : ""}
              </span>
              <span>{totalPods} pod{totalPods !== 1 ? "s" : ""}</span>
            </div>
          }
        />

        {lab3Failed && !loading && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-yellow-600/40 bg-yellow-900/20 px-3 py-1.5 text-xs text-yellow-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {t("dashboard.lab3FetchError")}
          </div>
        )}

        {loading && groups.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error && groups.length === 0 ? (
          <MetricError hint="Check Prometheus connectivity" />
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const style = HEALTH_STYLES[g.worstHealth];
              const oldestPod = g.pods.reduce((a, b) =>
                a.ageSeconds > b.ageSeconds ? a : b,
              );
              const warningPod = g.pods.find((p) => p.health !== "running" && p.health !== "succeeded");
              return (
                <Link
                  key={g.namespace}
                  href={`/workloads/${encodeURIComponent(g.namespace)}`}
                  className={cn(
                    "group block rounded-lg border px-3 py-2.5 transition-colors cursor-pointer",
                    g.worstHealth === "error"
                      ? "border-red-500/40 bg-red-500/5 hover:border-red-500/60"
                      : g.worstHealth === "warning"
                        ? "border-orange-500/40 bg-orange-500/5 hover:border-orange-500/60"
                        : g.worstHealth === "pending"
                          ? "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50"
                          : "border-gray-800 bg-gray-800/30 hover:border-violet-500/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        style.dot,
                        g.worstHealth === "running" && "animate-pulse",
                      )} />
                      <span className={cn("font-mono text-sm font-medium", style.text)}>
                        {g.namespace}
                      </span>
                      <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                        {g.pods.length} pod{g.pods.length > 1 ? "s" : ""}
                      </span>
                      {g.nodes.length > 0 ? (
                        <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                          {g.nodes.length} node{g.nodes.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="rounded bg-yellow-700/50 px-1.5 py-0.5 text-[10px] text-yellow-400">
                          Pending
                        </span>
                      )}
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", style.badge)}>
                        {style.label}
                      </span>
                    </div>
                  </div>

                  {g.workloadNames.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {g.workloadNames.map((wl) => (
                        <span key={wl} className="rounded bg-violet-900/30 px-1.5 py-0.5 text-[10px] font-mono text-violet-300">
                          {wl}
                        </span>
                      ))}
                    </div>
                  )}

                  {warningPod && warningPod.waitingReason && (
                    <div className="mt-1.5 text-[10px] text-orange-400">
                      {warningPod.waitingReason}: {warningPod.name}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-500">Started</span>
                      {oldestPod.createdDate || "-"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-500">Duration</span>
                      {formatAge(oldestPod.ageSeconds)}
                    </span>
                  </div>

                  {g.nodeTemps.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Thermometer className="h-3 w-3" />
                        <span>Node Temperature</span>
                      </div>
                      {g.nodeTemps.map((nt) => {
                        const pct = Math.min(Math.max((nt.temp / 100) * 100, 0), 100);
                        const color =
                          nt.temp >= 80 ? "bg-red-500" :
                          nt.temp >= 65 ? "bg-orange-500" :
                          nt.temp >= 50 ? "bg-yellow-500" :
                          "bg-green-500";
                        return (
                          <div key={nt.node} className="flex items-center gap-2">
                            <span className="w-[110px] truncate font-mono text-[10px] text-gray-400">{nt.node}</span>
                            <div className="flex-1 h-3 rounded-sm bg-gray-800 overflow-hidden">
                              <div
                                className={cn("h-full rounded-sm transition-all", color)}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={cn(
                              "w-10 text-right font-mono text-[10px] font-medium",
                              nt.temp >= 80 ? "text-red-400" :
                              nt.temp >= 65 ? "text-orange-400" :
                              "text-gray-300",
                            )}>
                              {nt.temp.toFixed(1)}°
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {g.nodeTemps.length === 0 && g.nodes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {g.nodes.map((n) => (
                        <span
                          key={n}
                          className="rounded bg-gray-700/80 px-1.5 py-0.5 font-mono text-[10px] text-gray-300"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
