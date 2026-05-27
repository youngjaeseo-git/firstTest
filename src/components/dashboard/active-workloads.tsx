"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { FlaskConical, Clock, Server, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { queries } from "@/lib/prometheus";

type PodHealth = "running" | "pending" | "warning" | "error" | "succeeded";

interface WorkloadPod {
  name: string;
  node: string;
  ageSeconds: number;
  createdDate: string;
  phase: string;
  waitingReason: string;
  health: PodHealth;
}

interface WorkloadGroup {
  namespace: string;
  pods: WorkloadPod[];
  nodes: string[];
  worstHealth: PodHealth;
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

function formatAge(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 60)}m`;
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

export function ActiveWorkloads() {
  const [groups, setGroups] = useState<WorkloadGroup[]>([]);
  const [totalPods, setTotalPods] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);

  const fetchWorkloads = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    const [podResults, createdResults, phaseResults, waitingResults] = await Promise.all([
      fetchInstant(queries.workloadPods()),
      fetchInstant(queries.workloadPodCreated()),
      fetchInstant(queries.workloadPodPhase()),
      fetchInstant(queries.workloadPodWaitingReason()),
    ]);

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

      if (!nsMap[ns]) {
        nsMap[ns] = { namespace: ns, pods: [], nodes: [], worstHealth: "running" };
      }
      nsMap[ns].pods.push({ name: pod, node, ageSeconds: age, createdDate, phase, waitingReason, health });
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
    });

    const sorted = groupList.sort(
      (a, b) => HEALTH_PRIORITY[b.worstHealth] - HEALTH_PRIORITY[a.worstHealth] || b.pods.length - a.pods.length,
    );

    setGroups(sorted);
    setTotalPods(podResults.length);
    setTotalNodes(allNodes.size);
  }, []);

  useEffect(() => {
    fetchWorkloads();
    const timer = setInterval(fetchWorkloads, 30_000);
    return () => clearInterval(timer);
  }, [fetchWorkloads]);

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-violet-500/15 p-1.5">
              <FlaskConical className="h-4 w-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              Active Workloads <span className="font-normal normal-case text-gray-500">(Namespace)</span>
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {totalNodes} node{totalNodes !== 1 ? "s" : ""}
            </span>
            <span>{totalPods} pod{totalPods !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-600">No active workloads</p>
          </div>
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

                  {g.nodes.length > 0 && (
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
