"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/components/ui/toast";
import {
  FlaskConical,
  Clock,
  Server,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Archive,
  Trash2,
  PlayCircle,
  CheckCircle2,
  XCircle,
  PauseCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queries } from "@/lib/prometheus";

/* ─── Types ─── */
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

interface EvalProject {
  id: string;
  title: string;
  status: string;
  namespace: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  _count: { results: number; tasks: number; notes: number };
}

/* ─── Constants ─── */
const HEALTH_PRIORITY: Record<PodHealth, number> = {
  error: 4, warning: 3, pending: 2, succeeded: 1, running: 0,
};

const HEALTH_STYLES: Record<PodHealth, { dot: string; text: string; label: string }> = {
  running: { dot: "bg-green-500", text: "text-green-400", label: "Running" },
  pending: { dot: "bg-yellow-500", text: "text-yellow-400", label: "Pending" },
  warning: { dot: "bg-orange-500", text: "text-orange-400", label: "Warning" },
  error: { dot: "bg-red-500", text: "text-red-400", label: "Error" },
  succeeded: { dot: "bg-gray-500", text: "text-gray-400", label: "Completed" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  IN_PROGRESS: { bg: "bg-blue-500", text: "text-blue-300", border: "border-blue-500/40" },
  PLANNED: { bg: "bg-gray-500", text: "text-gray-300", border: "border-gray-500/40" },
  ON_HOLD: { bg: "bg-amber-500", text: "text-amber-300", border: "border-amber-500/40" },
  COMPLETED: { bg: "bg-green-500", text: "text-green-300", border: "border-green-500/40" },
  CANCELLED: { bg: "bg-red-500", text: "text-red-300", border: "border-red-500/40" },
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BAR_PALETTE = [
  { bg: "bg-blue-500/70", text: "text-blue-100", hex: "#3b82f6" },
  { bg: "bg-emerald-500/70", text: "text-emerald-100", hex: "#10b981" },
  { bg: "bg-violet-500/70", text: "text-violet-100", hex: "#8b5cf6" },
  { bg: "bg-amber-500/70", text: "text-amber-100", hex: "#f59e0b" },
  { bg: "bg-rose-500/70", text: "text-rose-100", hex: "#f43f5e" },
  { bg: "bg-cyan-500/70", text: "text-cyan-100", hex: "#06b6d4" },
  { bg: "bg-pink-500/70", text: "text-pink-100", hex: "#ec4899" },
  { bg: "bg-orange-500/70", text: "text-orange-100", hex: "#f97316" },
  { bg: "bg-teal-500/70", text: "text-teal-100", hex: "#14b8a6" },
  { bg: "bg-indigo-500/70", text: "text-indigo-100", hex: "#6366f1" },
];

/* ─── Helpers ─── */
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
  if (reason === "CrashLoopBackOff" || reason === "CreateContainerError" || phase === "Failed") return "error";
  if (reason === "ImagePullBackOff" || reason === "ErrImagePull" || reason === "CreateContainerConfigError") return "warning";
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

function formatPodDate(ts: number): string {
  const dt = new Date(ts * 1000);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

type TabKey = "active" | "history";

/* ─── Main Page ─── */
export default function WorkloadsPage() {
  const [tab, setTab] = useState<TabKey>("active");
  const [groups, setGroups] = useState<WorkloadGroup[]>([]);
  const [allProjects, setAllProjects] = useState<EvalProject[]>([]);
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
        name: pod, node, phase, waitingReason: reason,
        health: podHealthFromPhase(phase, reason),
        ageSeconds: age,
        createdDate: created ? formatPodDate(created) : "",
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
        (a, b) => HEALTH_PRIORITY[b.worstHealth] - HEALTH_PRIORITY[a.worstHealth] || b.pods.length - a.pods.length,
      ),
    );
    setLoading(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/evaluations");
      if (!res.ok) return;
      const json = await res.json();
      setAllProjects((json.items || []).filter((p: EvalProject) => p.namespace));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchActive();
    fetchProjects();
  }, [fetchActive, fetchProjects]);

  const activeProjects = allProjects.filter(
    (p) => p.status !== "COMPLETED" && p.status !== "CANCELLED",
  );
  const historyCount = allProjects.length;

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
                  <Calendar className="h-3.5 w-3.5" /> History ({historyCount})
                </>
              )}
            </button>
          ))}
        </div>

        {tab === "active" && (
          <ActiveTab groups={groups} loading={loading} />
        )}

        {tab === "history" && (
          <HistoryCalendarTab projects={allProjects} liveGroups={groups} onUpdate={fetchProjects} />
        )}
      </div>
    </PageTransition>
  );
}

/* ─── Active Tab ─── */
function ActiveTab({ groups, loading }: { groups: WorkloadGroup[]; loading: boolean }) {
  if (loading) {
    return <Card><p className="text-gray-500 text-sm text-center py-8">Loading...</p></Card>;
  }

  if (groups.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <FlaskConical className="h-8 w-8 mb-3 text-gray-600" />
          <p className="text-sm">현재 실행 중인 워크로드가 없습니다.</p>
        </div>
      </Card>
    );
  }

  return (
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
  );
}

/* ─── History Calendar Tab ─── */
function HistoryCalendarTab({
  projects,
  liveGroups,
  onUpdate,
}: {
  projects: EvalProject[];
  liveGroups: WorkloadGroup[];
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [visibleNs, setVisibleNs] = useState<Set<string> | "all">("all");

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(null);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const projectNamespaces = new Set(projects.map((p) => p.namespace).filter(Boolean));
  const mergedProjects: EvalProject[] = [...projects];
  liveGroups.forEach((g) => {
    if (projectNamespaces.has(g.namespace)) return;
    const oldestPod = g.pods.reduce((a, b) => (a.ageSeconds > b.ageSeconds ? a : b), g.pods[0]);
    const startTs = oldestPod?.createdDate
      ? new Date(oldestPod.createdDate + "T00:00:00")
      : today;
    mergedProjects.push({
      id: `live-${g.namespace}`,
      title: g.namespace,
      status: "IN_PROGRESS",
      namespace: g.namespace,
      startDate: startTs.toISOString(),
      endDate: null,
      createdAt: startTs.toISOString(),
      _count: { results: 0, tasks: 0, notes: 0 },
    });
  });

  const colorMap: Record<string, number> = {};
  let colorIdx = 0;
  mergedProjects.forEach((p) => {
    const key = p.namespace || p.id;
    if (!(key in colorMap)) {
      colorMap[key] = colorIdx % BAR_PALETTE.length;
      colorIdx++;
    }
  });

  interface ProjectSpan {
    project: EvalProject;
    startDate: Date;
    endDate: Date;
    colorIndex: number;
  }
  const allNamespaces: string[] = [];
  const nsSet = new Set<string>();
  mergedProjects.forEach((p) => {
    const ns = p.namespace || p.id;
    if (!nsSet.has(ns)) { nsSet.add(ns); allNamespaces.push(ns); }
  });

  const allProjectSpans: ProjectSpan[] = mergedProjects.map((p) => {
    const start = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
    const end = p.endDate ? new Date(p.endDate) : (
      p.status === "COMPLETED" || p.status === "CANCELLED" ? start : today
    );
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return {
      project: p,
      startDate: start,
      endDate: end,
      colorIndex: colorMap[p.namespace || p.id] ?? 0,
    };
  });

  const projectSpans = visibleNs === "all"
    ? allProjectSpans
    : allProjectSpans.filter((ps) => visibleNs.has(ps.project.namespace || ps.project.id));

  const dateProjectMap: Record<string, EvalProject[]> = {};
  projectSpans.forEach(({ project, startDate, endDate }) => {
    const cursor = new Date(startDate);
    const endMs = endDate.getTime();
    while (cursor.getTime() <= endMs) {
      const key = toDateKey(cursor);
      if (!dateProjectMap[key]) dateProjectMap[key] = [];
      if (!dateProjectMap[key].some((ep) => ep.id === project.id)) {
        dateProjectMap[key].push(project);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  interface DayCell {
    day: number;
    dateKey: string;
    date: Date;
    isToday: boolean;
    isCurrentMonth: boolean;
  }
  const cells: DayCell[] = [];
  for (let i = 0; i < firstDay; i++) {
    const prevMonthDays = getDaysInMonth(year, month - 1);
    const d = prevMonthDays - firstDay + i + 1;
    const dt = new Date(year, month - 1, d);
    cells.push({ day: d, dateKey: toDateKey(dt), date: dt, isToday: false, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const key = toDateKey(dt);
    cells.push({ day: d, dateKey: key, date: dt, isToday: key === toDateKey(today), isCurrentMonth: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      cells.push({ day: d, dateKey: toDateKey(dt), date: dt, isToday: false, isCurrentMonth: false });
    }
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  interface WeekBar {
    project: EvalProject;
    startCol: number;
    span: number;
    colorIndex: number;
    isStart: boolean;
    isEnd: boolean;
  }
  function getBarsForWeek(week: DayCell[]): WeekBar[] {
    const weekStart = week[0].date.getTime();
    const weekEnd = week[6].date.getTime();
    const bars: WeekBar[] = [];

    projectSpans.forEach(({ project, startDate, endDate, colorIndex }) => {
      const pStart = startDate.getTime();
      const pEnd = endDate.getTime();
      if (pEnd < weekStart || pStart > weekEnd) return;

      const startCol = pStart <= weekStart ? 0 : Math.round((pStart - weekStart) / 86400000);
      const endCol = pEnd >= weekEnd ? 6 : Math.round((pEnd - weekStart) / 86400000);
      const span = endCol - startCol + 1;

      bars.push({
        project,
        startCol: Math.max(0, Math.min(6, startCol)),
        span: Math.max(1, Math.min(7 - Math.max(0, startCol), span)),
        colorIndex,
        isStart: pStart >= weekStart && pStart <= weekEnd,
        isEnd: pEnd >= weekStart && pEnd <= weekEnd,
      });
    });

    return bars;
  }

  const selectedProjects = selectedDate ? (dateProjectMap[selectedDate] || []) : [];

  const deleteProject = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/evaluations/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ type: "success", title: "평가가 삭제되었습니다." });
        onUpdate();
      } else {
        toast({ type: "error", title: "삭제에 실패했습니다." });
      }
    } catch {
      toast({ type: "error", title: "삭제에 실패했습니다." });
    } finally {
      setDeleting(null);
    }
  };

  const monthLabel = new Date(year, month).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      {/* Namespace Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setVisibleNs(visibleNs === "all" ? new Set<string>() : "all")}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
            visibleNs === "all"
              ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
              : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600",
          )}
        >
          <span className={cn(
            "h-3 w-3 rounded-sm border flex items-center justify-center",
            visibleNs === "all" ? "border-blue-400 bg-blue-500" : "border-gray-600",
          )}>
            {visibleNs === "all" && <span className="text-[8px] text-white font-bold">✓</span>}
          </span>
          ALL
        </button>
        {allNamespaces.map((ns) => {
          const ci = colorMap[ns] ?? 0;
          const palette = BAR_PALETTE[ci];
          const isChecked = visibleNs === "all" || (typeof visibleNs !== "string" && visibleNs.has(ns));
          const isLive = mergedProjects.some((p) => (p.namespace || p.id) === ns && p.id.startsWith("live-"));

          const toggle = () => {
            if (visibleNs === "all") {
              const newSet = new Set(allNamespaces);
              newSet.delete(ns);
              setVisibleNs(newSet);
            } else {
              const newSet = new Set(visibleNs);
              if (newSet.has(ns)) {
                newSet.delete(ns);
                setVisibleNs(newSet);
              } else {
                newSet.add(ns);
                if (newSet.size === allNamespaces.length) setVisibleNs("all");
                else setVisibleNs(newSet);
              }
            }
          };

          return (
            <button
              key={ns}
              onClick={toggle}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                isChecked
                  ? "border-opacity-50 bg-opacity-15 text-opacity-100"
                  : "border-gray-700 bg-gray-800/50 text-gray-600 opacity-50",
              )}
              style={{
                borderColor: isChecked ? palette.hex + "80" : undefined,
                backgroundColor: isChecked ? palette.hex + "20" : undefined,
              }}
            >
              <span
                className="h-3 w-3 rounded-sm border flex items-center justify-center"
                style={{
                  borderColor: isChecked ? palette.hex : "#4b5563",
                  backgroundColor: isChecked ? palette.hex : "transparent",
                }}
              >
                {isChecked && <span className="text-[8px] text-white font-bold">✓</span>}
              </span>
              <span className="font-mono text-[11px]" style={{ color: isChecked ? palette.hex : undefined }}>
                {ns}
              </span>
              {isLive && <span className="text-[9px] text-blue-400">(LIVE)</span>}
            </button>
          );
        })}
      </div>

      {/* Calendar */}
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-gray-800 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-200">{monthLabel}</h3>
            <button
              onClick={goToday}
              className="rounded-md bg-gray-800 px-2.5 py-1 text-[11px] text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
            >
              Today
            </button>
          </div>
          <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-gray-800 transition-colors">
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1.5 text-center text-[10px] font-medium text-gray-500 uppercase">
              {w}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, weekIdx) => {
          const bars = getBarsForWeek(week);
          const maxBars = Math.min(bars.length, 4);

          return (
            <div key={weekIdx}>
              {/* Day numbers */}
              <div className="grid grid-cols-7">
                {week.map((cell, dayIdx) => {
                  const isSelected = selectedDate === cell.dateKey;
                  return (
                    <button
                      key={dayIdx}
                      onClick={() => setSelectedDate(isSelected ? null : cell.dateKey)}
                      className={cn(
                        "relative h-7 border-x border-t border-gray-800/40 flex items-start justify-center pt-1",
                        cell.isCurrentMonth ? "bg-gray-900/30" : "bg-gray-900/10",
                        isSelected && "bg-blue-900/20 border-blue-500/40",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium leading-none",
                          !cell.isCurrentMonth && "text-gray-700",
                          cell.isCurrentMonth && !cell.isToday && "text-gray-400",
                          cell.isToday && "rounded-full bg-blue-500 text-white w-5 h-5 flex items-center justify-center text-[10px]",
                        )}
                      >
                        {cell.day}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Event bars */}
              <div className="relative grid grid-cols-7 border-x border-b border-gray-800/40" style={{ minHeight: `${Math.max(maxBars * 20 + 4, 24)}px` }}>
                {week.map((cell, dayIdx) => {
                  const isSelected = selectedDate === cell.dateKey;
                  return (
                    <div
                      key={dayIdx}
                      className={cn(
                        "border-r border-gray-800/40 last:border-r-0",
                        cell.isCurrentMonth ? "bg-gray-900/30" : "bg-gray-900/10",
                        isSelected && "bg-blue-900/20",
                      )}
                    />
                  );
                })}
                {bars.slice(0, 4).map((bar, barIdx) => {
                  const palette = BAR_PALETTE[bar.colorIndex];
                  const leftPct = (bar.startCol / 7) * 100;
                  const widthPct = (bar.span / 7) * 100;
                  return (
                    <div
                      key={`${bar.project.id}-${weekIdx}`}
                      className={cn(
                        "absolute h-[16px] flex items-center px-1.5 text-[9px] font-medium cursor-pointer transition-opacity hover:opacity-100",
                        palette.bg,
                        palette.text,
                        bar.isStart && "rounded-l-md ml-0.5",
                        bar.isEnd && "rounded-r-md mr-0.5",
                        !bar.isStart && !bar.isEnd && "opacity-80",
                      )}
                      style={{
                        top: `${barIdx * 20 + 2}px`,
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - ${(bar.isStart ? 2 : 0) + (bar.isEnd ? 2 : 0)}px)`,
                      }}
                      title={`${bar.project.namespace || bar.project.title} (${bar.project.status})`}
                      onClick={() => setSelectedDate(week[bar.startCol].dateKey)}
                    >
                      {bar.isStart && (
                        <span className="truncate">{bar.project.namespace || bar.project.title}</span>
                      )}
                    </div>
                  );
                })}
                {bars.length > 4 && (
                  <div className="absolute bottom-0 right-1 text-[9px] text-gray-500">
                    +{bars.length - 4}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Selected date detail */}
      {selectedDate && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
            <span className="ml-2 font-normal text-gray-500">
              {selectedProjects.length}건
            </span>
          </h3>

          {selectedProjects.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">이 날짜에 평가가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {selectedProjects.map((p) => {
                const isLive = p.id.startsWith("live-");
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.PLANNED;
                const canDelete = !isLive && (p.status === "COMPLETED" || p.status === "CANCELLED");
                const startStr = p.startDate
                  ? new Date(p.startDate).toLocaleDateString("ko-KR")
                  : new Date(p.createdAt).toLocaleDateString("ko-KR");
                const endStr = p.endDate
                  ? new Date(p.endDate).toLocaleDateString("ko-KR")
                  : (canDelete ? "-" : "진행중");

                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-3",
                      sc.border,
                      "bg-gray-900/50",
                    )}
                  >
                    <Link
                      href={`/workloads/${encodeURIComponent(p.namespace!)}`}
                      className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80"
                    >
                      <StatusIcon status={p.status} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{p.title}</p>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                          <span className="font-mono">{p.namespace}</span>
                          <span className="text-gray-700">·</span>
                          <span>{startStr} ~ {endStr}</span>
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {!isLive && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span>{p._count.results} results</span>
                          <span>{p._count.tasks} tasks</span>
                        </div>
                      )}
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", sc.bg, "bg-opacity-20", sc.text)}>
                        {isLive ? "LIVE" : p.status.replace("_", " ")}
                      </span>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`"${p.title}" 평가를 삭제하시겠습니까?\n관련 결과, 태스크, 메모가 모두 삭제됩니다.`)) {
                              deleteProject(p.id);
                            }
                          }}
                          disabled={deleting === p.id}
                          className="rounded p-1 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Project list below calendar */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          전체 워크로드 목록 ({mergedProjects.length})
        </h3>
        {mergedProjects.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">등록된 평가가 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {mergedProjects.map((p) => {
              const isLive = p.id.startsWith("live-");
              const sc = STATUS_COLORS[p.status] || STATUS_COLORS.PLANNED;
              const canDelete = !isLive && (p.status === "COMPLETED" || p.status === "CANCELLED");
              const startStr = p.startDate
                ? new Date(p.startDate).toLocaleDateString("ko-KR")
                : new Date(p.createdAt).toLocaleDateString("ko-KR");
              const endStr = p.endDate ? new Date(p.endDate).toLocaleDateString("ko-KR") : null;

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-800/60 bg-gray-900/40 px-3 py-2 group"
                >
                  <StatusIcon status={p.status} />
                  <Link
                    href={`/workloads/${encodeURIComponent(p.namespace!)}`}
                    className="flex-1 min-w-0 hover:opacity-80"
                  >
                    <span className="text-sm text-gray-200">{p.title}</span>
                    <span className="ml-2 font-mono text-[10px] text-gray-500">{p.namespace}</span>
                  </Link>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {startStr}{endStr && ` ~ ${endStr}`}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0", sc.bg, "bg-opacity-20", sc.text)}>
                    {isLive ? "LIVE" : p.status.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-gray-600 shrink-0 w-16 text-right">
                    {isLive ? "" : `${p._count.results}r ${p._count.tasks}t`}
                  </span>
                  {canDelete ? (
                    <button
                      onClick={() => {
                        if (confirm(`"${p.title}" 평가를 삭제하시겠습니까?`)) {
                          deleteProject(p.id);
                        }
                      }}
                      disabled={deleting === p.id}
                      className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="삭제"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : (
                    <div className="w-3" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "IN_PROGRESS") return <PlayCircle className="h-4 w-4 text-blue-400 shrink-0" />;
  if (status === "COMPLETED") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "CANCELLED") return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  if (status === "ON_HOLD") return <PauseCircle className="h-4 w-4 text-amber-400 shrink-0" />;
  return <Calendar className="h-4 w-4 text-gray-500 shrink-0" />;
}
