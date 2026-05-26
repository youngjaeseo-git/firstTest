"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { FlaskConical, Clock, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { queries } from "@/lib/prometheus";

interface WorkloadGroup {
  namespace: string;
  pods: { name: string; node: string; ageSeconds: number }[];
  nodes: string[];
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
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function shortenHostname(node: string): string {
  const m = node.match(/(\d{3})$/);
  if (m) return m[1];
  const m2 = node.match(/ae(\d+)/);
  if (m2) return m2[1].padStart(3, "0");
  return node.length > 12 ? node.slice(-6) : node;
}

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
    const [podResults, createdResults] = await Promise.all([
      fetchInstant(queries.workloadPods()),
      fetchInstant(queries.workloadPodCreated()),
    ]);

    const createdMap: Record<string, number> = {};
    for (const r of createdResults) {
      const key = `${r.metric.namespace}/${r.metric.pod}`;
      if (r.value) createdMap[key] = parseFloat(r.value[1]);
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

      if (!nsMap[ns]) {
        nsMap[ns] = { namespace: ns, pods: [], nodes: [] };
      }
      nsMap[ns].pods.push({ name: pod, node, ageSeconds: age });
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
    });

    const sorted = groupList.sort(
      (a, b) => b.pods.length - a.pods.length,
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
              Active Workloads
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {totalNodes} nodes
            </span>
            <span>{totalPods} pods</span>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-600">No active workloads</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const oldestAge = Math.max(
                ...g.pods.map((p) => p.ageSeconds),
                0,
              );
              return (
                <div
                  key={g.namespace}
                  className="group rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2.5 transition-colors hover:border-violet-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                      <span className="font-mono text-sm font-medium text-violet-300">
                        {g.namespace}
                      </span>
                      <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                        {g.pods.length} pod{g.pods.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatAge(oldestAge)}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">Nodes:</span>
                    <div className="flex flex-wrap gap-1">
                      {g.nodes.map((n) => (
                        <span
                          key={n}
                          className={cn(
                            "rounded bg-gray-700/80 px-1.5 py-0.5 font-mono text-[10px]",
                            "text-gray-300",
                          )}
                          title={n}
                        >
                          {shortenHostname(n)}
                        </span>
                      ))}
                      {g.nodes.length === 0 && (
                        <span className="text-[10px] text-gray-600">
                          pending
                        </span>
                      )}
                    </div>
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
