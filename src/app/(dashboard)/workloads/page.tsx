"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";
import {
  FlaskConical,
  Clock,
  Server,
  Calendar,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queries } from "@/lib/prometheus";

type PodHealth = "running" | "pending" | "warning" | "error" | "succeeded";

interface WorkloadPod {
  name: string;
  node: string;
  phase: string;
  waitingReason: string;
  health: PodHealth;
  ageSeconds: number;
  createdDate: string;
}

interface WorkloadGroup {
  namespace: string;
  pods: WorkloadPod[];
  nodes: string[];
  worstHealth: PodHealth;
}

interface EvalSummary {
  id: string;
  title: string;
  status: string;
  namespace: string | null;
  startDate: string | null;
  endDate: string | null;
  _count: { results: number; tasks: number; notes: number };
}

const HEALTH_PRIORITY: Record<PodHealth, number> = {
  error: 4,
  warning: 3,
  pending: 2,
  succeeded: 1,
  running: 0,
};

const HEALTH_STYLES: Record<PodHealth, { dot: string; text: string; label: string }> = {
  running: { dot: "bg-green-500", text: "text-green-400", label: "Running" },
  pending: { dot: "bg-yellow-500", text: "text-yellow-400", label: "Pending" },
  warning: { dot: "bg-orange-500", text: "text-orange-400", label: "Warning" },
  error: { dot: "bg-red-500", text: "text-red-400", label: "Error" },
  succeeded: { dot: "bg-gray-500", text: "text-gray-400", label: "Completed" },
};

async function fetchInstant(
  query: string,
): Promise<{ metric: Record<string, string>; value?: [number, string] }[]> {
  try {
    const res = await fetch(`/api/metrics/instant?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.result ?? [];
  } catch {
    return [];
  }
}

function podHealthFromPhase(phase: string, reason: string): PodHealth {
  if (reason === "CrashLoopBackOff" || reason === "CreateContainerError" || phase === "Failed")
    return "error";
  if (reason === "ImagePullBackOff" || reason === "ErrImagePull" || reason === "CreateContainerConfigError")
    return "warning";
  if (phase === "Pending" || reason) return "pending";
  if (phase === "Succeeded") return "succeeded";
  return "running";
}

function worstHealth(pods: WorkloadPod[]): PodHealth {
  let worst: PodHealth = "running";
  pods.forEach((p) => {
    if (HEALTH_PRIORITY[p.health] > HEALTH_PRIORITY[worst]) worst = p.health;
  });
  return worst;
}

function formatAge(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 60)}m`;
}

function formatDate(ts: number): string {
  const dt = new Date(ts * 1000);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

type TabKey = "active" | "history";

export default function WorkloadsPage() {
  const [tab, setTab] = useState<TabKey>("active");
  const [groups, setGroups] = useState<WorkloadGroup[]>([]);
  const [history, setHistory] = useState<EvalSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActive = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    const [podResults, createdResults, phaseResults, waitingResults] = await Promise.all([
      fetchInstant(queries.workloadPods()),
      fetchInstant(queries.workloadPodCreated()),
      fetchInstant(queries.workloadPodPhase()),
      fetchInstant(queries.workloadPodWaitingReason()),
    ]);

    const createdMap: Record<string, number> = {};
    for (const r of createdResults) {
      createdMap[`${r.metric.namespace}/${r.metric.pod}`] = r.value ? parseFloat(r.value[1]) : 0;
    }
    const phaseMap: Record<string, string> = {};
    for (const r of phaseResults) {
      phaseMap[`${r.metric.namespace}/${r.metric.pod}`] = r.metric.phase || "";
    }
    const waitingMap: Record<string, string> = {};
    for (const r of waitingResults) {
      waitingMap[`${r.metric.namespace}/${r.metric.pod}`] = r.metric.reason || "";
    }

    const nsMap: Record<string, WorkloadGroup> = {};
    for (const r of podResults) {
      const ns = r.metric.namespace || "default";
      const pod = r.metric.pod || "unknown";
      const node = r.metric.node || "";
      const key = `${ns}/${pod}`;
      const created = createdMap[key];
      const age = created ? now - created : 0;
      const phase = phaseMap[key] || "Unknown";
      const reason = waitingMap[key] || "";

      if (!nsMap[ns]) nsMap[ns] = { namespace: ns, pods: [], nodes: [], worstHealth: "running" };
      nsMap[ns].pods.push({
        name: pod,
        node,
        phase,
        waitingReason: reason,
        health: podHealthFromPhase(phase, reason),
        ageSeconds: age,
        createdDate: created ? formatDate(created) : "",
      });
    }

    const groupList = Object.values(nsMap);
    groupList.forEach((g) => {
      const seen = new Set<string>();
      g.nodes = [];
      g.pods.forEach((p) => {
        if (p.node && !seen.has(p.node)) { seen.add(p.node); g.nodes.push(p.node); }
      });
      g.worstHealth = worstHealth(g.pods);
    });

    setGroups(
      groupList.sort(
        (a, b) =>
          HEALTH_PRIORITY[b.worstHealth] - HEALTH_PRIORITY[a.worstHealth] ||
          b.pods.length - a.pods.length,
      ),
    );
    setLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/evaluations?status=COMPLETED");
      if (!res.ok) return;
      const json = await res.json();
      setHistory((json.items || []).filter((p: EvalSummary) => p.namespace));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchActive();
    fetchHistory();
  }, [fetchActive, fetchHistory]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workloads</h1>
          <p className="mt-1 text-sm text-gray-500">
            평가 워크로드 현황 및 이력 관리
          </p>
        </div>

        <div className="flex gap-1 border-b border-gray-800">
          {(["active", "history"] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
                tab === t
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200",
              )}
            >
              {t === "active" ? (
                <>
                  <FlaskConical className="h-3.5 w-3.5" /> Active ({groups.length})
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" /> History ({history.length})
                </>
              )}
            </button>
          ))}
        </div>

        {tab === "active" && (
          loading ? (
            <Card><p className="text-gray-500 text-sm text-center py-8">Loading...</p></Card>
          ) : groups.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <FlaskConical className="h-8 w-8 mb-3 text-gray-600" />
                <p className="text-sm">현재 실행 중인 워크로드가 없습니다.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => {
                const style = HEALTH_STYLES[g.worstHealth];
                return (
                  <Link
                    key={g.namespace}
                    href={`/workloads/${encodeURIComponent(g.namespace)}`}
                    className={cn(
                      "group rounded-xl border p-4 transition-all hover:shadow-lg",
                      g.worstHealth === "error"
                        ? "border-red-500/40 bg-red-500/5 hover:border-red-500/60"
                        : g.worstHealth === "warning"
                          ? "border-orange-500/40 bg-orange-500/5 hover:border-orange-500/60"
                          : g.worstHealth === "pending"
                            ? "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50"
                            : "border-gray-800 bg-gray-900/50 hover:border-violet-500/30",
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
                        <span className={cn("font-mono text-sm font-semibold", style.text)}>
                          {g.namespace}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" />
                        {g.pods.length} pod{g.pods.length > 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        {g.nodes.length} node{g.nodes.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {g.pods[0] && (
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {g.pods[0].createdDate || "-"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatAge(Math.max(...g.pods.map((p) => p.ageSeconds)))}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )
        )}

        {tab === "history" && (
          history.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Archive className="h-8 w-8 mb-3 text-gray-600" />
                <p className="text-sm">완료된 평가 이력이 없습니다.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((p) => (
                <Link
                  key={p.id}
                  href={`/workloads/${encodeURIComponent(p.namespace!)}`}
                  className="group flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 transition-colors hover:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    {p.status === "COMPLETED" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-200">{p.title}</p>
                      <p className="text-xs text-gray-500">
                        {p.namespace}
                        {p.startDate && ` · ${new Date(p.startDate).toLocaleDateString("ko-KR")}`}
                        {p.endDate && ` ~ ${new Date(p.endDate).toLocaleDateString("ko-KR")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{p._count.results} results</span>
                    <span>{p._count.tasks} tasks</span>
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </PageTransition>
  );
}
