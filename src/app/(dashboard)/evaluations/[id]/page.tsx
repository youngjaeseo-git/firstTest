"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/states";
import {
  ChevronLeft, FlaskConical, Zap, Calendar, Plus, Trash2,
  CheckCircle2, Circle, AlertTriangle, PlayCircle, Clock,
  GanttChart,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

/* ─── Types ─── */
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
  evalType: string; status: string;
  memoryType: string | null; manufacturer: string | null; partNumber: string | null;
  capacityGb: number | null; speedMhz: number | null; formFactor: string | null;
  startDate: string | null; endDate: string | null;
  createdBy: string; assigneeId: string | null;
  phases: Phase[]; results: Result[]; tasks: Task[]; notes: Note[];
  _count: { results: number; tasks: number; notes: number };
}

const RESULT_ICON: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  PASS: { icon: CheckCircle2, color: "text-green-400" },
  FAIL: { icon: AlertTriangle, color: "text-red-400" },
  WARNING: { icon: AlertTriangle, color: "text-amber-400" },
  RUNNING: { icon: PlayCircle, color: "text-blue-400" },
  PENDING: { icon: Circle, color: "text-gray-500" },
};

const PHASE_COLORS: Record<string, string> = {
  PENDING: "border-gray-700 bg-gray-800/50",
  IN_PROGRESS: "border-blue-600/40 bg-blue-900/20",
  PASSED: "border-green-600/40 bg-green-900/20",
  FAILED: "border-red-600/40 bg-red-900/20",
  SKIPPED: "border-gray-700 bg-gray-800/30",
};

const TASK_STATUS_NEXT: Record<string, string> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
  BLOCKED: "TODO",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-red-400",
  HIGH: "text-amber-400",
  MEDIUM: "text-blue-400",
  LOW: "text-gray-500",
};

type TabKey = "overview" | "timeline" | "tasks" | "notes";

export default function EvalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/evaluations/${id}`);
      if (!res.ok) { router.push("/evaluations"); return; }
      setProject(await res.json());
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  if (loading || !project) {
    return <Card><p className="text-gray-500 text-sm">Loading...</p></Card>;
  }

  const memSpec = [
    project.manufacturer, project.memoryType,
    project.capacityGb ? `${project.capacityGb}GB` : null,
    project.speedMhz ? `${project.speedMhz}MHz` : null,
    project.formFactor, project.partNumber,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/evaluations" className="mb-3 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
          <ChevronLeft className="h-3 w-3" /> Evaluations
        </Link>
        <div className="flex items-center gap-2 mb-2">
          {project.evalType === "ACCELERATED"
            ? <Zap className="h-4 w-4 text-amber-400" />
            : <FlaskConical className="h-4 w-4 text-blue-400" />}
          <span className="text-xs text-gray-500 uppercase">{project.evalType}</span>
          <StatusSelect projectId={project.id} current={project.status} onUpdate={fetchProject} />
        </div>
        <PageHeader
          icon={FlaskConical}
          title={project.title}
          subtitle={
            <>
              {memSpec && <span>{memSpec}</span>}
              {memSpec && project.description && <span> &mdash; </span>}
              {project.description && <span>{project.description}</span>}
            </>
          }
          accent="green"
          right={
            project.startDate ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(project.startDate).toLocaleDateString("ko-KR")}
                  {project.endDate && ` ~ ${new Date(project.endDate).toLocaleDateString("ko-KR")}`}
                </span>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {(["overview", "timeline", "tasks", "notes"] as TabKey[]).map((t) => {
          const labels: Record<TabKey, string> = {
            overview: "Overview & Results",
            timeline: "Timeline",
            tasks: `Tasks (${project.tasks.length})`,
            notes: `Notes (${project.notes.length})`,
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === t
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "timeline" && <GanttChart className="h-3.5 w-3.5" />}
              {labels[t]}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <OverviewTab project={project} onUpdate={fetchProject} />
      )}
      {tab === "timeline" && (
        <TimelineTab project={project} />
      )}
      {tab === "tasks" && (
        <TasksTab projectId={project.id} tasks={project.tasks} phases={project.phases} onUpdate={fetchProject} />
      )}
      {tab === "notes" && (
        <NotesTab projectId={project.id} notes={project.notes} onUpdate={fetchProject} />
      )}
    </div>
  );
}

/* ─── Status Select ─── */
function StatusSelect({ projectId, current, onUpdate }: { projectId: string; current: string; onUpdate: () => void }) {
  const statuses = ["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];
  const colors: Record<string, string> = {
    PLANNED: "bg-gray-700 text-gray-300",
    IN_PROGRESS: "bg-blue-900/50 text-blue-300",
    ON_HOLD: "bg-amber-900/50 text-amber-300",
    COMPLETED: "bg-green-900/50 text-green-300",
    CANCELLED: "bg-red-900/50 text-red-400",
  };

  const update = async (status: string) => {
    await fetch(`/api/evaluations/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onUpdate();
  };

  return (
    <select
      value={current}
      onChange={(e) => update(e.target.value)}
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border-0 cursor-pointer ${colors[current] || colors.PLANNED}`}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>{s.replace("_", " ")}</option>
      ))}
    </select>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const { toast } = useToast();
  const [addingResult, setAddingResult] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);

  const updatePhaseStatus = async (phaseId: string, status: string) => {
    await fetch(`/api/evaluations/${project.id}/phases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, status }),
    });
    onUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Timeline */}
      {project.phases.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-200">Phases</h3>
          </div>
          <div className="space-y-2">
            {project.phases.map((phase, i) => {
              const phaseStatuses = ["PENDING", "IN_PROGRESS", "PASSED", "FAILED", "SKIPPED"];
              return (
                <div key={phase.id} className={`rounded-lg border p-3 ${PHASE_COLORS[phase.status] || PHASE_COLORS.PENDING}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                      <span className="text-sm font-medium text-gray-200">{phase.name}</span>
                      {phase.description && <span className="text-xs text-gray-500">— {phase.description}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {phase.startDate && (
                        <span className="text-[10px] text-gray-500">
                          {new Date(phase.startDate).toLocaleDateString("ko-KR")}
                          {phase.endDate && ` ~ ${new Date(phase.endDate).toLocaleDateString("ko-KR")}`}
                        </span>
                      )}
                      <select
                        value={phase.status}
                        onChange={(e) => updatePhaseStatus(phase.id, e.target.value)}
                        className="rounded bg-gray-800 border-gray-700 text-xs px-2 py-0.5 text-gray-300"
                      >
                        {phaseStatuses.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddingPhase(true)}
            className="mt-3"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Phase
          </Button>
          {addingPhase && (
            <AddPhaseForm
              projectId={project.id}
              onDone={() => { setAddingPhase(false); onUpdate(); }}
              onCancel={() => setAddingPhase(false)}
            />
          )}
        </Card>
      )}

      {project.phases.length === 0 && (
        <Card>
          <p className="text-gray-500 text-sm mb-2">아직 평가 단계가 없습니다.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddingPhase(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Add Phase
          </Button>
          {addingPhase && (
            <AddPhaseForm
              projectId={project.id}
              onDone={() => { setAddingPhase(false); onUpdate(); }}
              onCancel={() => setAddingPhase(false)}
            />
          )}
        </Card>
      )}

      {/* Results table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-200">Test Results ({project.results.length})</h3>
          <Button variant="outline" size="sm" onClick={() => setAddingResult(true)}>
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
                  <th className="pb-2 pr-2">Duration</th>
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
                        <span className={`flex items-center gap-1 ${ri.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-medium">{r.result}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-2 font-mono text-gray-300">
                        {r.equipment ? (
                          <Link href={`/servers/${r.equipment.id}`} className="text-blue-400 hover:underline">
                            {r.equipment.hostname || r.equipment.ipAddress}
                          </Link>
                        ) : "-"}
                      </td>
                      <td className="py-2 pr-2">
                        <span className="text-gray-200">{r.workloadName}</span>
                        {r.workloadConfig && <span className="ml-1 text-gray-600">{r.workloadConfig}</span>}
                      </td>
                      <td className="py-2 pr-2 text-gray-400">
                        {r.totalCycles
                          ? `${r.completedCycles || 0}/${r.totalCycles}`
                          : "-"}
                      </td>
                      <td className="py-2 pr-2 font-mono text-gray-200">
                        {r.value ? `${r.value} ${r.unit || ""}` : "-"}
                      </td>
                      <td className="py-2 pr-2 text-gray-500">{r.cycleDuration || "-"}</td>
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

/* ─── Add Phase Form ─── */
function AddPhaseForm({ projectId, onDone, onCancel }: { projectId: string; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    await fetch(`/api/evaluations/${projectId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    onDone();
  };

  return (
    <div className="mt-2 flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Phase name (e.g. Compatibility Test)"
        className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      <Button size="sm" onClick={submit} disabled={!name.trim()}>Add</Button>
      <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

/* ─── Add Result Form ─── */
function AddResultForm({
  projectId, phases, onDone, onCancel,
}: { projectId: string; phases: Phase[]; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    phaseId: "", equipmentId: "", workloadName: "", workloadConfig: "",
    cycleDuration: "", totalCycles: "", completedCycles: "",
    result: "RUNNING", value: "", unit: "", notes: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.workloadName.trim()) return;
    await fetch(`/api/evaluations/${projectId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        phaseId: form.phaseId || null,
        equipmentId: form.equipmentId || null,
      }),
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
          <label className="text-xs text-gray-500">Cycle Duration</label>
          <input value={form.cycleDuration} onChange={(e) => set("cycleDuration", e.target.value)}
            placeholder="24h, 72h"
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
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
        <div>
          <label className="text-xs text-gray-500">Equipment ID</label>
          <input value={form.equipmentId} onChange={(e) => set("equipmentId", e.target.value)}
            placeholder="Equipment ID (optional)"
            className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200" />
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

/* ─── Timeline Tab ─── */
function TimelineTab({ project }: { project: Project }) {
  const phases = project.phases;
  const results = project.results;

  const allDates: number[] = [];
  if (project.startDate) allDates.push(new Date(project.startDate).getTime());
  if (project.endDate) allDates.push(new Date(project.endDate).getTime());
  phases.forEach((p) => {
    if (p.startDate) allDates.push(new Date(p.startDate).getTime());
    if (p.endDate) allDates.push(new Date(p.endDate).getTime());
  });
  results.forEach((r) => {
    if (r.startedAt) allDates.push(new Date(r.startedAt).getTime());
    if (r.completedAt) allDates.push(new Date(r.completedAt).getTime());
    if (r.createdAt) allDates.push(new Date(r.createdAt).getTime());
  });

  if (allDates.length < 2) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <GanttChart className="h-8 w-8 mb-3 text-gray-600" />
          <p className="text-sm">타임라인을 표시하려면 프로젝트 또는 단계에 시작/종료 날짜를 설정하세요.</p>
          <p className="text-xs mt-1 text-gray-600">최소 2개의 날짜가 필요합니다.</p>
        </div>
      </Card>
    );
  }

  const minTime = Math.min(...allDates);
  const maxTime = Math.max(...allDates);
  const pad = Math.max((maxTime - minTime) * 0.05, 86400000);
  const rangeStart = minTime - pad;
  const rangeEnd = maxTime + pad;
  const totalRange = rangeEnd - rangeStart;

  const toPercent = (ts: number) => ((ts - rangeStart) / totalRange) * 100;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

  const ticks = generateTicks(rangeStart, rangeEnd);

  const phaseColors: Record<string, string> = {
    PENDING: "bg-gray-600",
    IN_PROGRESS: "bg-blue-500",
    PASSED: "bg-green-500",
    FAILED: "bg-red-500",
    SKIPPED: "bg-gray-500",
  };

  const resultColors: Record<string, string> = {
    PASS: "bg-green-400",
    FAIL: "bg-red-400",
    WARNING: "bg-amber-400",
    RUNNING: "bg-blue-400",
    PENDING: "bg-gray-400",
  };

  return (
    <div className="space-y-4">
      {/* Project range */}
      {project.startDate && project.endDate && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase">Project Period</span>
            <span className="text-xs text-gray-500 ml-auto">
              {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
            </span>
          </div>
          <TimelineBar
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            ticks={ticks}
            toPercent={toPercent}
          >
            <div
              className="absolute h-full bg-gray-700/50 rounded border border-gray-600/30"
              style={{
                left: `${toPercent(new Date(project.startDate).getTime())}%`,
                width: `${toPercent(new Date(project.endDate).getTime()) - toPercent(new Date(project.startDate).getTime())}%`,
              }}
            />
            <TodayMarker toPercent={toPercent} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          </TimelineBar>
        </Card>
      )}

      {/* Phases Gantt */}
      {phases.length > 0 && (
        <Card>
          <h3 className="text-xs font-semibold text-gray-300 uppercase mb-4 flex items-center gap-2">
            <GanttChart className="h-3.5 w-3.5" /> Phase Timeline
          </h3>
          <div className="space-y-3">
            {phases.map((phase) => {
              const pStart = phase.startDate ? new Date(phase.startDate).getTime() : null;
              const pEnd = phase.endDate ? new Date(phase.endDate).getTime() : null;
              const hasRange = pStart !== null && pEnd !== null;

              return (
                <div key={phase.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300 font-medium">{phase.name}</span>
                    <div className="flex items-center gap-2">
                      {phase.startDate && (
                        <span className="text-[10px] text-gray-500">
                          {formatDate(phase.startDate)}
                          {phase.endDate && ` ~ ${formatDate(phase.endDate)}`}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        phase.status === "PASSED" ? "bg-green-900/40 text-green-400" :
                        phase.status === "FAILED" ? "bg-red-900/40 text-red-400" :
                        phase.status === "IN_PROGRESS" ? "bg-blue-900/40 text-blue-400" :
                        "bg-gray-800 text-gray-500"
                      }`}>
                        {phase.status}
                      </span>
                    </div>
                  </div>
                  <TimelineBar
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    ticks={ticks}
                    toPercent={toPercent}
                    compact
                  >
                    {hasRange ? (
                      <div
                        className={`absolute h-full rounded-sm ${phaseColors[phase.status] || phaseColors.PENDING} opacity-80`}
                        style={{
                          left: `${toPercent(pStart!)}%`,
                          width: `${Math.max(toPercent(pEnd!) - toPercent(pStart!), 0.5)}%`,
                        }}
                        title={`${phase.name}: ${phase.startDate ? formatDate(phase.startDate) : ""} ~ ${phase.endDate ? formatDate(phase.endDate) : ""}`}
                      />
                    ) : pStart !== null ? (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${phaseColors[phase.status] || phaseColors.PENDING} border border-gray-900`}
                        style={{ left: `${toPercent(pStart)}%` }}
                        title={`${phase.name}: ${formatDate(phase.startDate!)}`}
                      />
                    ) : null}
                    <TodayMarker toPercent={toPercent} rangeStart={rangeStart} rangeEnd={rangeEnd} />
                  </TimelineBar>

                  {/* Results within this phase */}
                  {phase.results.length > 0 && (
                    <div className="ml-4 mt-1">
                      <TimelineBar
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        ticks={ticks}
                        toPercent={toPercent}
                        compact
                        thin
                      >
                        {phase.results.map((r) => {
                          const rTime = r.startedAt
                            ? new Date(r.startedAt).getTime()
                            : new Date(r.createdAt).getTime();
                          const rEnd = r.completedAt ? new Date(r.completedAt).getTime() : null;
                          if (rEnd && rEnd !== rTime) {
                            return (
                              <div
                                key={r.id}
                                className={`absolute h-full rounded-sm ${resultColors[r.result] || resultColors.PENDING} opacity-60`}
                                style={{
                                  left: `${toPercent(rTime)}%`,
                                  width: `${Math.max(toPercent(rEnd) - toPercent(rTime), 0.3)}%`,
                                }}
                                title={`${r.workloadName} (${r.result})`}
                              />
                            );
                          }
                          return (
                            <div
                              key={r.id}
                              className={`absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ${resultColors[r.result] || resultColors.PENDING} border border-gray-900`}
                              style={{ left: `${toPercent(rTime)}%` }}
                              title={`${r.workloadName} (${r.result})`}
                            />
                          );
                        })}
                      </TimelineBar>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Unphased results */}
      {results.filter((r) => !r.phaseId).length > 0 && (
        <Card>
          <h3 className="text-xs font-semibold text-gray-300 uppercase mb-4">Results (No Phase)</h3>
          <TimelineBar
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            ticks={ticks}
            toPercent={toPercent}
          >
            {results.filter((r) => !r.phaseId).map((r) => {
              const rTime = r.startedAt
                ? new Date(r.startedAt).getTime()
                : new Date(r.createdAt).getTime();
              return (
                <div
                  key={r.id}
                  className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ${resultColors[r.result] || resultColors.PENDING} border border-gray-900 cursor-default`}
                  style={{ left: `${toPercent(rTime)}%` }}
                  title={`${r.workloadName} (${r.result}) - ${new Date(rTime).toLocaleDateString("ko-KR")}`}
                />
              );
            })}
            <TodayMarker toPercent={toPercent} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          </TimelineBar>
        </Card>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        <span className="text-[10px] text-gray-600 uppercase mr-2">Phases:</span>
        {Object.entries(phaseColors).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className={`inline-block h-2 w-4 rounded-sm ${c}`} /> {k}
          </span>
        ))}
        <span className="text-[10px] text-gray-600 uppercase ml-4 mr-2">Results:</span>
        {Object.entries(resultColors).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className={`inline-block h-2 w-2 rounded-full ${c}`} /> {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function generateTicks(rangeStart: number, rangeEnd: number): number[] {
  const totalMs = rangeEnd - rangeStart;
  const totalDays = totalMs / 86400000;
  let stepDays: number;
  if (totalDays <= 14) stepDays = 1;
  else if (totalDays <= 60) stepDays = 7;
  else if (totalDays <= 180) stepDays = 14;
  else stepDays = 30;

  const ticks: number[] = [];
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  if (stepDays >= 7) {
    start.setDate(start.getDate() - start.getDay() + 1);
  }
  let current = start.getTime();
  while (current <= rangeEnd) {
    if (current >= rangeStart) ticks.push(current);
    current += stepDays * 86400000;
  }
  return ticks;
}

function TimelineBar({
  rangeStart,
  rangeEnd,
  ticks,
  toPercent,
  compact,
  thin,
  children,
}: {
  rangeStart: number;
  rangeEnd: number;
  ticks: number[];
  toPercent: (ts: number) => number;
  compact?: boolean;
  thin?: boolean;
  children?: React.ReactNode;
}) {
  const barHeight = thin ? "h-2" : compact ? "h-4" : "h-6";
  const totalDays = (rangeEnd - rangeStart) / 86400000;
  const showLabels = !thin && !compact;

  return (
    <div>
      <div className={`relative ${barHeight} rounded bg-gray-800/60 overflow-hidden`}>
        {ticks.map((t, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-gray-700/40"
            style={{ left: `${toPercent(t)}%` }}
          />
        ))}
        {children}
      </div>
      {showLabels && (
        <div className="relative h-4 mt-0.5">
          {ticks.filter((_, i) => {
            if (totalDays <= 14) return true;
            if (totalDays <= 60) return i % 2 === 0;
            return i % 2 === 0;
          }).map((t, i) => (
            <span
              key={i}
              className="absolute text-[9px] text-gray-600 -translate-x-1/2"
              style={{ left: `${toPercent(t)}%` }}
            >
              {new Date(t).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TodayMarker({ toPercent, rangeStart, rangeEnd }: {
  toPercent: (ts: number) => number;
  rangeStart: number;
  rangeEnd: number;
}) {
  const now = Date.now();
  if (now < rangeStart || now > rangeEnd) return null;
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-10"
      style={{ left: `${toPercent(now)}%` }}
      title={`Today: ${new Date().toLocaleDateString("ko-KR")}`}
    >
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-500" />
    </div>
  );
}

/* ─── Tasks Tab ─── */
function TasksTab({ projectId, tasks, phases, onUpdate }: {
  projectId: string; tasks: Task[]; phases: Phase[]; onUpdate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");

  const toggleTask = async (task: Task) => {
    const nextStatus = TASK_STATUS_NEXT[task.status] || "TODO";
    await fetch(`/api/evaluations/${projectId}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, status: nextStatus }),
    });
    onUpdate();
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    await fetch(`/api/evaluations/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), priority: newPriority }),
    });
    setNewTitle("");
    setAdding(false);
    onUpdate();
  };

  const deleteTask = async (taskId: string) => {
    await fetch(`/api/evaluations/${projectId}/tasks?taskId=${taskId}`, { method: "DELETE" });
    onUpdate();
  };

  const statusGroups = [
    { status: "TODO", label: "To Do" },
    { status: "IN_PROGRESS", label: "In Progress" },
    { status: "BLOCKED", label: "Blocked" },
    { status: "DONE", label: "Done" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-200">Tasks</h3>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3 w-3" /> Add Task
        </Button>
      </div>

      {adding && (
        <Card className="border-blue-600/30 bg-blue-900/10">
          <div className="flex gap-2">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200"
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              autoFocus />
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <Button size="sm" onClick={addTask}>Add</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {tasks.length === 0 && !adding ? (
        <Card><EmptyState icon={false} /></Card>
      ) : (
        statusGroups.map((sg) => {
          const groupTasks = tasks.filter((t) => t.status === sg.status);
          if (groupTasks.length === 0) return null;
          return (
            <div key={sg.status}>
              <h4 className="text-xs font-medium text-gray-500 mb-2">{sg.label} ({groupTasks.length})</h4>
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
                    <span className={`flex-1 text-sm ${t.status === "DONE" ? "text-gray-500 line-through" : "text-gray-200"}`}>
                      {t.title}
                    </span>
                    <span className={`text-[10px] font-medium ${PRIORITY_COLORS[t.priority] || ""}`}>
                      {t.priority}
                    </span>
                    {t.dueDate && (
                      <span className="text-[10px] text-gray-600">
                        {new Date(t.dueDate).toLocaleDateString("ko-KR")}
                      </span>
                    )}
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
function NotesTab({ projectId, notes, onUpdate }: {
  projectId: string; notes: Note[]; onUpdate: () => void;
}) {
  const [content, setContent] = useState("");

  const addNote = async () => {
    if (!content.trim()) return;
    await fetch(`/api/evaluations/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    setContent("");
    onUpdate();
  };

  const deleteNote = async (noteId: string) => {
    await fetch(`/api/evaluations/${projectId}/notes?noteId=${noteId}`, { method: "DELETE" });
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
            rows={2}
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
                <div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.content}</p>
                  <p className="mt-2 text-[10px] text-gray-600">
                    {new Date(n.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <button
                  onClick={() => deleteNote(n.id)}
                  className="text-gray-700 hover:text-red-400"
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
