"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/states";
import {
  ChevronLeft,
  FlaskConical,
  Server,
  Clock,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  PlayCircle,
  Cpu,
  HardDrive,
  Activity,
  StickyNote,
  ListTodo,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queries, type Cluster } from "@/lib/prometheus";

/* ─── Types ─── */
type PodHealth = "running" | "pending" | "warning" | "error" | "succeeded";

interface PodInfo {
  name: string;
  node: string;
  phase: string;
  waitingReason: string;
  health: PodHealth;
  ageSeconds: number;
  createdDate: string;
  cpuPercent: number | null;
  memBytes: number | null;
}

interface Equipment { id: string; hostname: string | null; ipAddress: string | null }
interface Phase {
  id: string; name: string; sortOrder: number; status: string;
  description: string | null; startDate: string | null; endDate: string | null;
  results: Result[]; tasks: Task[];
}
interface Result {
  id: string; phaseId: string | null; equipmentId: string | null;
  workloadName: string; workloadConfig: string | null;
  cycleDuration: string | null; totalCycles: number | null; completedCycles: number | null;
  result: string; value: string | null; unit: string | null; notes: string | null;
  startedAt: string | null; completedAt: string | null; testedBy: string; createdAt: string;
  equipment: Equipment | null;
}
interface Task {
  id: string; phaseId: string | null; title: string; description: string | null;
  status: string; priority: string; assigneeId: string | null;
  dueDate: string | null; completedAt: string | null; createdBy: string; createdAt: string;
}
interface Note { id: string; content: string; createdBy: string; createdAt: string }
interface Project {
  id: string; title: string; description: string | null;
  evalType: string; status: string; namespace: string | null;
  startDate: string | null; endDate: string | null;
  createdBy: string;
  phases: Phase[]; results: Result[]; tasks: Task[]; notes: Note[];
  _count: { results: number; tasks: number; notes: number };
}

interface WorkloadData {
  namespace: string;
  active: Project[];
  history: Project[];
}

const HEALTH_PRIORITY: Record<PodHealth, number> = {
  error: 4, warning: 3, pending: 2, succeeded: 1, running: 0,
};

const HEALTH_STYLES: Record<PodHealth, { dot: string; text: string; bg: string; label: string }> = {
  running: { dot: "bg-green-500", text: "text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "Running" },
  pending: { dot: "bg-yellow-500", text: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", label: "Pending" },
  warning: { dot: "bg-orange-500", text: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", label: "Warning" },
  error: { dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "Error" },
  succeeded: { dot: "bg-gray-500", text: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/30", label: "Completed" },
};

const TASK_STATUS_NEXT: Record<string, string> = {
  TODO: "IN_PROGRESS", IN_PROGRESS: "DONE", DONE: "TODO", BLOCKED: "TODO",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-red-400", HIGH: "text-amber-400", MEDIUM: "text-blue-400", LOW: "text-gray-500",
};

const RESULT_ICON: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  PASS: { icon: CheckCircle2, color: "text-green-400" },
  FAIL: { icon: AlertTriangle, color: "text-red-400" },
  WARNING: { icon: AlertTriangle, color: "text-amber-400" },
  RUNNING: { icon: PlayCircle, color: "text-blue-400" },
  PENDING: { icon: Circle, color: "text-gray-500" },
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-gray-700 text-gray-300",
  IN_PROGRESS: "bg-blue-900/50 text-blue-300",
  ON_HOLD: "bg-amber-900/50 text-amber-300",
  COMPLETED: "bg-green-900/50 text-green-300",
  CANCELLED: "bg-red-900/50 text-red-400",
};

type MR = { metric: Record<string, string>; value?: [number, string] };
const EMPTY: MR[] = [];

async function fetchInstant(
  query: string,
  source?: "lab3",
): Promise<MR[]> {
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

function podHealthFromPhase(phase: string, reason: string): PodHealth {
  if (reason === "CrashLoopBackOff" || reason === "CreateContainerError" || phase === "Failed") return "error";
  if (reason === "ImagePullBackOff" || reason === "ErrImagePull" || reason === "CreateContainerConfigError") return "warning";
  if (phase === "Pending" || reason) return "pending";
  if (phase === "Succeeded") return "succeeded";
  return "running";
}

function formatAge(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 60)}m`;
}

function formatDateTs(ts: number): string {
  const dt = new Date(ts * 1000);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatMemory(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GiB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MiB`;
  return `${(bytes / 1024).toFixed(0)} KiB`;
}

type TabKey = "pods" | "evaluation" | "tasks" | "notes" | "history";

export default function WorkloadDetailPage() {
  const params = useParams();
  const ns = decodeURIComponent(params.namespace as string);
  const { toast } = useToast();

  const [tab, setTab] = useState<TabKey>("pods");
  const [cluster, setCluster] = useState<Cluster>("all");
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [data, setData] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPods = useCallback(async () => {
    const now = Math.floor(Date.now() / 1000);
    const nsFilter = `namespace="${ns}"`;
    const needLab1 = cluster !== "lab3";
    const needLab3 = cluster === "all" || cluster === "lab3";

    const [lab1Pod, lab1Created, lab1Phase, lab1Waiting, lab1Cpu, lab1Mem] = needLab1
      ? await Promise.all([
          fetchInstant(`kube_pod_info{${nsFilter}}`),
          fetchInstant(`kube_pod_created{${nsFilter}}`),
          fetchInstant(`kube_pod_status_phase{${nsFilter}}==1`),
          fetchInstant(`kube_pod_container_status_waiting_reason{${nsFilter}}==1`),
          fetchInstant(`sum by(pod, namespace)(rate(container_cpu_usage_seconds_total{${nsFilter},container!=""}[5m])) * 100`),
          fetchInstant(`sum by(pod, namespace)(container_memory_working_set_bytes{${nsFilter},container!=""})`),
        ])
      : [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];

    const [lab3Pod, lab3Created, lab3Phase, lab3Waiting, lab3Cpu, lab3Mem] = needLab3
      ? await Promise.all([
          fetchInstant(`kube_pod_info{${nsFilter}}`, "lab3"),
          fetchInstant(`kube_pod_created{${nsFilter}}`, "lab3"),
          fetchInstant(`kube_pod_status_phase{${nsFilter}}==1`, "lab3"),
          fetchInstant(`kube_pod_container_status_waiting_reason{${nsFilter}}==1`, "lab3"),
          fetchInstant(`sum by(pod, namespace)(rate(container_cpu_usage_seconds_total{${nsFilter},container!=""}[5m])) * 100`, "lab3"),
          fetchInstant(`sum by(pod, namespace)(container_memory_working_set_bytes{${nsFilter},container!=""})`,"lab3"),
        ])
      : [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];

    const lab1PodKeys = new Set(lab1Pod.map(r => r.metric.pod || ""));
    const podRes = lab1Pod.concat(lab3Pod.filter(r => !lab1PodKeys.has(r.metric.pod || "")));
    const createdRes = lab1Created.concat(lab3Created);
    const phaseRes = lab1Phase.concat(lab3Phase);
    const waitingRes = lab1Waiting.concat(lab3Waiting);
    const cpuRes = lab1Cpu.concat(lab3Cpu);
    const memRes = lab1Mem.concat(lab3Mem);

    const createdMap: Record<string, number> = {};
    for (const r of createdRes) {
      createdMap[r.metric.pod || ""] = r.value ? parseFloat(r.value[1]) : 0;
    }
    const phaseMap: Record<string, string> = {};
    for (const r of phaseRes) {
      phaseMap[r.metric.pod || ""] = r.metric.phase || "";
    }
    const waitingMap: Record<string, string> = {};
    for (const r of waitingRes) {
      waitingMap[r.metric.pod || ""] = r.metric.reason || "";
    }
    const cpuMap: Record<string, number> = {};
    for (const r of cpuRes) {
      if (r.value) cpuMap[r.metric.pod || ""] = parseFloat(r.value[1]);
    }
    const memMap: Record<string, number> = {};
    for (const r of memRes) {
      if (r.value) memMap[r.metric.pod || ""] = parseFloat(r.value[1]);
    }

    const allNodes = new Set<string>();
    const podList: PodInfo[] = [];
    for (const r of podRes) {
      const pod = r.metric.pod || "unknown";
      const node = r.metric.node || "";
      if (node) allNodes.add(node);
      const created = createdMap[pod];
      const phase = phaseMap[pod] || "Unknown";
      const reason = waitingMap[pod] || "";

      podList.push({
        name: pod,
        node,
        phase,
        waitingReason: reason,
        health: podHealthFromPhase(phase, reason),
        ageSeconds: created ? now - created : 0,
        createdDate: created ? formatDateTs(created) : "",
        cpuPercent: cpuMap[pod] ?? null,
        memBytes: memMap[pod] ?? null,
      });
    }

    podList.sort((a, b) => HEALTH_PRIORITY[b.health] - HEALTH_PRIORITY[a.health] || a.name.localeCompare(b.name));
    setPods(podList);
    const nodeList: string[] = [];
    allNodes.forEach((n) => nodeList.push(n));
    setNodes(nodeList.sort());
  }, [ns, cluster]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/workloads/${encodeURIComponent(ns)}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [ns]);

  useEffect(() => {
    fetchPods();
    fetchData();
    const timer = setInterval(fetchPods, 30_000);
    return () => clearInterval(timer);
  }, [fetchPods, fetchData]);

  const activeProject = data?.active?.[0] || null;
  const historyProjects = data?.history || [];

  const healthCounts: Record<PodHealth, number> = { running: 0, pending: 0, warning: 0, error: 0, succeeded: 0 };
  pods.forEach((p) => { healthCounts[p.health]++; });

  const tabCounts = {
    pods: pods.length,
    evaluation: activeProject ? activeProject._count.results : 0,
    tasks: activeProject ? activeProject.tasks.length : 0,
    notes: activeProject ? activeProject.notes.length : 0,
    history: historyProjects.length,
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/workloads"
            className="mb-2 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
          >
            <ChevronLeft className="h-3 w-3" /> Workloads
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <FlaskConical className="h-5 w-5 text-violet-400" />
                <h1 className="text-2xl font-bold font-mono">{ns}</h1>
                {activeProject && (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", PROJECT_STATUS_COLORS[activeProject.status] || PROJECT_STATUS_COLORS.PLANNED)}>
                    {activeProject.status.replace("_", " ")}
                  </span>
                )}
              </div>
              {activeProject?.description && (
                <p className="text-sm text-gray-500">{activeProject.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-1 rounded-lg bg-gray-800/60 p-1">
                {(["all", "lab1", "lab3"] as Cluster[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCluster(c)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      cluster === c
                        ? "bg-violet-600 text-white"
                        : "text-gray-400 hover:text-gray-200",
                    )}
                  >
                    {c === "all" ? "All" : c === "lab1" ? "Lab-1" : "Lab-3"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <FlaskConical className="h-3 w-3" />
                  {pods.length} pod{pods.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  {nodes.length} node{nodes.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Health summary */}
          <div className="mt-3 flex flex-wrap gap-2">
            {(["running", "pending", "warning", "error", "succeeded"] as PodHealth[]).map((h) => {
              if (healthCounts[h] === 0) return null;
              const s = HEALTH_STYLES[h];
              return (
                <span key={h} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", s.bg)}>
                  <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                  <span className={s.text}>{s.label}</span>
                  <span className="font-mono font-bold">{healthCounts[h]}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800 overflow-x-auto">
          {([
            { key: "pods" as TabKey, icon: Activity, label: "Pods" },
            { key: "evaluation" as TabKey, icon: FlaskConical, label: "Evaluation" },
            { key: "tasks" as TabKey, icon: ListTodo, label: "Tasks" },
            { key: "notes" as TabKey, icon: StickyNote, label: "Notes" },
            { key: "history" as TabKey, icon: Archive, label: "History" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t.key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {tabCounts[t.key] > 0 && (
                <span className="text-[10px] text-gray-500">({tabCounts[t.key]})</span>
              )}
            </button>
          ))}
        </div>

        {tab === "pods" && <PodsTab pods={pods} nodes={nodes} />}
        {tab === "evaluation" && (
          <EvaluationTab
            project={activeProject}
            namespace={ns}
            onUpdate={fetchData}
          />
        )}
        {tab === "tasks" && (
          <TasksTab
            project={activeProject}
            namespace={ns}
            onUpdate={fetchData}
          />
        )}
        {tab === "notes" && (
          <NotesTab
            project={activeProject}
            namespace={ns}
            onUpdate={fetchData}
          />
        )}
        {tab === "history" && <HistoryTab projects={historyProjects} />}
      </div>
    </PageTransition>
  );
}

/* ─── Pods Tab ─── */
function PodsTab({ pods, nodes }: { pods: PodInfo[]; nodes: string[] }) {
  return (
    <div className="space-y-4">
      {/* Node list */}
      {nodes.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-gray-400" /> Nodes ({nodes.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {nodes.map((n) => (
              <span
                key={n}
                className="rounded-lg bg-gray-800/60 border border-gray-700/50 px-3 py-1.5 font-mono text-xs text-gray-300"
              >
                {n}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Pod list */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" /> Pods ({pods.length})
        </h3>
        {pods.length === 0 ? (
          <EmptyState className="py-8" icon={false} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500 uppercase">
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Pod</th>
                  <th className="pb-2 pr-3">Node</th>
                  <th className="pb-2 pr-3">CPU</th>
                  <th className="pb-2 pr-3">Memory</th>
                  <th className="pb-2 pr-3">Started</th>
                  <th className="pb-2 pr-3">Age</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((p) => {
                  const hs = HEALTH_STYLES[p.health];
                  return (
                    <tr key={p.name} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", hs.dot, p.health === "error" && "animate-pulse")} />
                          <span className={cn("text-[10px] font-medium", hs.text)}>{hs.label}</span>
                        </span>
                        {p.waitingReason && (
                          <span className="block mt-0.5 text-[10px] text-orange-400">{p.waitingReason}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-gray-200 max-w-[300px] truncate">{p.name}</td>
                      <td className="py-2.5 pr-3 font-mono text-gray-400">
                        {p.node || <span className="text-yellow-500">Pending</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        {p.cpuPercent !== null ? (
                          <span className={cn("font-mono", p.cpuPercent > 80 ? "text-red-400" : p.cpuPercent > 50 ? "text-amber-400" : "text-cyan-400")}>
                            {p.cpuPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {p.memBytes !== null ? (
                          <span className="font-mono text-gray-300">{formatMemory(p.memBytes)}</span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500">{p.createdDate || "-"}</td>
                      <td className="py-2.5 pr-3 text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-600" />
                        {formatAge(p.ageSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Evaluation Tab ─── */
function EvaluationTab({
  project,
  namespace,
  onUpdate,
}: {
  project: Project | null;
  namespace: string;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [addingResult, setAddingResult] = useState(false);

  const createProject = async () => {
    const res = await fetch(`/api/workloads/${encodeURIComponent(namespace)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || `${namespace} Evaluation` }),
    });
    if (res.ok) {
      toast({ type: "success", title: "평가 프로젝트가 생성되었습니다." });
      setCreating(false);
      setTitle("");
      onUpdate();
    }
  };

  if (!project) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12">
          <FlaskConical className="h-8 w-8 mb-3 text-gray-600" />
          <p className="text-sm text-gray-400 mb-4">
            이 워크로드에 연결된 평가 프로젝트가 없습니다.
          </p>
          {creating ? (
            <div className="flex gap-2 w-full max-w-md">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${namespace} Evaluation`}
                className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                autoFocus
              />
              <Button size="sm" onClick={createProject}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          ) : (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> 평가 프로젝트 생성
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Project Info */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-200">{project.title}</h3>
            <ProjectStatusSelect projectId={project.id} current={project.status} onUpdate={onUpdate} />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {project.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(project.startDate).toLocaleDateString("ko-KR")}
                {project.endDate && ` ~ ${new Date(project.endDate).toLocaleDateString("ko-KR")}`}
              </span>
            )}
            <Link href={`/evaluations/${project.id}`} className="text-blue-400 hover:text-blue-300">
              Detail View
            </Link>
          </div>
        </div>
      </Card>

      {/* Phases */}
      {project.phases.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Phases ({project.phases.length})
          </h3>
          <div className="space-y-2">
            {project.phases.map((phase, i) => {
              const passCount = phase.results.filter((r) => r.result === "PASS").length;
              const failCount = phase.results.filter((r) => r.result === "FAIL").length;
              return (
                <div
                  key={phase.id}
                  className={cn(
                    "rounded-lg border p-3",
                    phase.status === "IN_PROGRESS" ? "border-blue-600/40 bg-blue-900/20" :
                    phase.status === "PASSED" ? "border-green-600/40 bg-green-900/20" :
                    phase.status === "FAILED" ? "border-red-600/40 bg-red-900/20" :
                    "border-gray-700 bg-gray-800/50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-200">{phase.name}</span>
                      {phase.results.length > 0 && (
                        <span className="text-[10px] text-gray-500">
                          {phase.results.length} results
                          {passCount > 0 && <span className="text-green-400 ml-1">{passCount} pass</span>}
                          {failCount > 0 && <span className="text-red-400 ml-1">{failCount} fail</span>}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded",
                      phase.status === "PASSED" ? "bg-green-900/40 text-green-400" :
                      phase.status === "FAILED" ? "bg-red-900/40 text-red-400" :
                      phase.status === "IN_PROGRESS" ? "bg-blue-900/40 text-blue-400" :
                      "bg-gray-800 text-gray-500",
                    )}>
                      {phase.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Results */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Test Results ({project.results.length})
          </h3>
          <Button variant="outline" size="sm" onClick={() => setAddingResult(!addingResult)}>
            <Plus className="mr-1 h-3 w-3" /> Add Result
          </Button>
        </div>

        {addingResult && (
          <AddResultForm
            projectId={project.id}
            phases={project.phases}
            onDone={() => { setAddingResult(false); onUpdate(); }}
            onCancel={() => setAddingResult(false)}
          />
        )}

        {project.results.length === 0 ? (
          <EmptyState icon={false} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500 uppercase">
                  <th className="pb-2 pr-2">Result</th>
                  <th className="pb-2 pr-2">Server</th>
                  <th className="pb-2 pr-2">Workload</th>
                  <th className="pb-2 pr-2">Cycles</th>
                  <th className="pb-2 pr-2">Value</th>
                  <th className="pb-2 pr-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {project.results.map((r) => {
                  const ri = RESULT_ICON[r.result] || RESULT_ICON.PENDING;
                  const Icon = ri.icon;
                  return (
                    <tr key={r.id} className="border-b border-gray-800/50">
                      <td className="py-2 pr-2">
                        <span className={cn("flex items-center gap-1", ri.color)}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-medium">{r.result}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-2 font-mono text-gray-300">
                        {r.equipment?.hostname || r.equipment?.ipAddress || "-"}
                      </td>
                      <td className="py-2 pr-2 text-gray-200">{r.workloadName}</td>
                      <td className="py-2 pr-2 text-gray-400">
                        {r.totalCycles ? `${r.completedCycles || 0}/${r.totalCycles}` : "-"}
                      </td>
                      <td className="py-2 pr-2 font-mono text-gray-200">
                        {r.value ? `${r.value} ${r.unit || ""}` : "-"}
                      </td>
                      <td className="py-2 pr-2 text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Add Result Form ─── */
function AddResultForm({
  projectId, phases, onDone, onCancel,
}: { projectId: string; phases: Phase[]; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    phaseId: "", workloadName: "", workloadConfig: "",
    cycleDuration: "", totalCycles: "", completedCycles: "",
    result: "RUNNING", value: "", unit: "", notes: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.workloadName.trim()) return;
    await fetch(`/api/evaluations/${projectId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, phaseId: form.phaseId || null }),
    });
    onDone();
  };

  return (
    <Card className="mb-4 border-blue-600/30 bg-blue-900/10">
      <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <div>
          <label className="text-xs text-gray-500">Phase</label>
          <select value={form.phaseId} onChange={(e) => set("phaseId", e.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200">
            <option value="">None</option>
            {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Workload Name *</label>
          <input value={form.workloadName} onChange={(e) => set("workloadName", e.target.value)}
            placeholder="stressapptest, STREAM..."
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Config</label>
          <input value={form.workloadConfig} onChange={(e) => set("workloadConfig", e.target.value)}
            placeholder="--memory 64G --threads 32"
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Result</label>
          <select value={form.result} onChange={(e) => set("result", e.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200">
            {["RUNNING", "PENDING", "PASS", "FAIL", "WARNING"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Cycles (completed/total)</label>
          <div className="flex gap-1">
            <input value={form.completedCycles} onChange={(e) => set("completedCycles", e.target.value)}
              placeholder="0" type="number"
              className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
            <span className="self-center text-gray-500">/</span>
            <input value={form.totalCycles} onChange={(e) => set("totalCycles", e.target.value)}
              placeholder="10" type="number"
              className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Value</label>
          <div className="flex gap-1">
            <input value={form.value} onChange={(e) => set("value", e.target.value)}
              placeholder="45.2"
              className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
            <input value={form.unit} onChange={(e) => set("unit", e.target.value)}
              placeholder="GB/s"
              className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs text-gray-500">Notes</label>
        <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
          className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
      </div>
      <div className="mt-3 flex gap-2 justify-end">
        <Button size="sm" onClick={submit} disabled={!form.workloadName.trim()}>Save Result</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

/* ─── Project Status Select ─── */
function ProjectStatusSelect({ projectId, current, onUpdate }: { projectId: string; current: string; onUpdate: () => void }) {
  const statuses = ["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];
  const update = async (status: string) => {
    await fetch(`/api/evaluations/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...(status === "COMPLETED" ? { endDate: new Date().toISOString() } : {}),
      }),
    });
    onUpdate();
  };

  return (
    <select
      value={current}
      onChange={(e) => update(e.target.value)}
      className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium border-0 cursor-pointer", PROJECT_STATUS_COLORS[current] || PROJECT_STATUS_COLORS.PLANNED)}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>{s.replace("_", " ")}</option>
      ))}
    </select>
  );
}

/* ─── Tasks Tab ─── */
function TasksTab({
  project,
  namespace,
  onUpdate,
}: {
  project: Project | null;
  namespace: string;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newDesc, setNewDesc] = useState("");

  if (!project) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <ListTodo className="h-8 w-8 mb-3 text-gray-600" />
          <p className="text-sm mb-2">태스크를 관리하려면 먼저 평가 프로젝트를 생성하세요.</p>
          <p className="text-xs text-gray-600">Evaluation 탭에서 프로젝트를 생성할 수 있습니다.</p>
        </div>
      </Card>
    );
  }

  const tasks = project.tasks;

  const toggleTask = async (task: Task) => {
    const nextStatus = TASK_STATUS_NEXT[task.status] || "TODO";
    await fetch(`/api/evaluations/${project.id}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, status: nextStatus }),
    });
    onUpdate();
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    await fetch(`/api/evaluations/${project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        priority: newPriority,
        description: newDesc.trim() || null,
      }),
    });
    setNewTitle("");
    setNewDesc("");
    setAdding(false);
    onUpdate();
    toast({ type: "success", title: "태스크가 추가되었습니다." });
  };

  const deleteTask = async (taskId: string) => {
    await fetch(`/api/evaluations/${project.id}/tasks?taskId=${taskId}`, { method: "DELETE" });
    onUpdate();
  };

  const statusGroups = [
    { status: "TODO", label: "To Do", icon: Circle, iconColor: "text-gray-600" },
    { status: "IN_PROGRESS", label: "In Progress", icon: PlayCircle, iconColor: "text-blue-400" },
    { status: "BLOCKED", label: "Blocked", icon: AlertTriangle, iconColor: "text-red-400" },
    { status: "DONE", label: "Done", icon: CheckCircle2, iconColor: "text-green-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-200">Tasks ({tasks.length})</h3>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3 w-3" /> Add Task
        </Button>
      </div>

      {adding && (
        <Card className="border-blue-600/30 bg-blue-900/10">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title..."
                className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                autoFocus
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-300"
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={addTask} disabled={!newTitle.trim()}>Add</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {tasks.length === 0 && !adding ? (
        <Card><EmptyState icon={false} /></Card>
      ) : (
        statusGroups.map((sg) => {
          const groupTasks = tasks.filter((t) => t.status === sg.status);
          if (groupTasks.length === 0) return null;
          const StatusIcon = sg.icon;
          return (
            <div key={sg.status}>
              <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <StatusIcon className={cn("h-3 w-3", sg.iconColor)} />
                {sg.label} ({groupTasks.length})
              </h4>
              <div className="space-y-1">
                {groupTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-800/60 bg-gray-900/50 px-3 py-2 group"
                  >
                    <button onClick={() => toggleTask(t)} className="shrink-0">
                      {t.status === "DONE" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : t.status === "IN_PROGRESS" ? (
                        <PlayCircle className="h-4 w-4 text-blue-400" />
                      ) : t.status === "BLOCKED" ? (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm", t.status === "DONE" ? "text-gray-500 line-through" : "text-gray-200")}>
                        {t.title}
                      </span>
                      {t.description && (
                        <p className="text-[10px] text-gray-600 truncate">{t.description}</p>
                      )}
                    </div>
                    <span className={cn("text-[10px] font-medium", PRIORITY_COLORS[t.priority] || "")}>
                      {t.priority}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {new Date(t.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Notes Tab ─── */
function NotesTab({
  project,
  namespace,
  onUpdate,
}: {
  project: Project | null;
  namespace: string;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [content, setContent] = useState("");

  if (!project) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <StickyNote className="h-8 w-8 mb-3 text-gray-600" />
          <p className="text-sm mb-2">메모를 작성하려면 먼저 평가 프로젝트를 생성하세요.</p>
          <p className="text-xs text-gray-600">Evaluation 탭에서 프로젝트를 생성할 수 있습니다.</p>
        </div>
      </Card>
    );
  }

  const notes = project.notes;

  const addNote = async () => {
    if (!content.trim()) return;
    await fetch(`/api/evaluations/${project.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    setContent("");
    onUpdate();
    toast({ type: "success", title: "메모가 추가되었습니다." });
  };

  const deleteNote = async (noteId: string) => {
    await fetch(`/api/evaluations/${project.id}/notes?noteId=${noteId}`, { method: "DELETE" });
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메모, 진행 상황, 이슈 등을 기록하세요..."
            rows={3}
            className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 resize-none"
          />
          <Button onClick={addNote} disabled={!content.trim()} className="self-end">
            Post
          </Button>
        </div>
      </Card>

      {notes.length === 0 ? (
        <Card><EmptyState icon={false} /></Card>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <Card key={n.id} className="bg-gray-900/50">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.content}</p>
                  <p className="mt-2 text-[10px] text-gray-600">
                    {new Date(n.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="text-gray-700 hover:text-red-400 ml-2 shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── History Tab ─── */
function HistoryTab({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <Card>
        <EmptyState className="py-12" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {p.status === "COMPLETED" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400" />
              )}
              <h3 className="text-sm font-medium text-gray-200">{p.title}</h3>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", PROJECT_STATUS_COLORS[p.status] || "")}>
                {p.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {p.startDate && (
                <span>
                  {new Date(p.startDate).toLocaleDateString("ko-KR")}
                  {p.endDate && ` ~ ${new Date(p.endDate).toLocaleDateString("ko-KR")}`}
                </span>
              )}
              <Link href={`/evaluations/${p.id}`} className="text-blue-400 hover:text-blue-300">
                Detail
              </Link>
            </div>
          </div>

          {/* Summary */}
          <div className="flex gap-4 text-xs text-gray-400 mb-3">
            <span>{p._count.results} test results</span>
            <span>{p.tasks.length} tasks</span>
            <span>{p.notes.length} notes</span>
          </div>

          {/* Results summary */}
          {p.results.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {["PASS", "FAIL", "WARNING"].map((result) => {
                const count = p.results.filter((r) => r.result === result).length;
                if (count === 0) return null;
                const ri = RESULT_ICON[result] || RESULT_ICON.PENDING;
                const Icon = ri.icon;
                return (
                  <span key={result} className={cn("flex items-center gap-1 text-xs", ri.color)}>
                    <Icon className="h-3 w-3" /> {result} {count}
                  </span>
                );
              })}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
