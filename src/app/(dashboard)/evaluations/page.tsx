"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FlaskConical, Zap, Calendar, CheckCircle2, Clock, Pause, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface Phase {
  id: string;
  name: string;
  status: string;
}

interface EvalProject {
  id: string;
  title: string;
  description: string | null;
  evalType: string;
  status: string;
  memoryType: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  capacityGb: number | null;
  speedMhz: number | null;
  formFactor: string | null;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  phases: Phase[];
  _count: { results: number; tasks: number; notes: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PLANNED: { label: "Planned", color: "bg-gray-800 text-gray-300", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-900/40 text-blue-300", icon: FlaskConical },
  ON_HOLD: { label: "On Hold", color: "bg-amber-900/40 text-amber-300", icon: Pause },
  COMPLETED: { label: "Completed", color: "bg-green-900/40 text-green-300", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "bg-red-900/40 text-red-400", icon: XCircle },
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof FlaskConical }> = {
  FIELD: { label: "Field", icon: FlaskConical },
  ACCELERATED: { label: "Accelerated", icon: Zap },
};

export default function EvaluationsPage() {
  const [projects, setProjects] = useState<EvalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      const res = await fetch(`/api/evaluations?${params}`);
      const json = await res.json();
      setProjects(json.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const statusFilters = ["", "PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FlaskConical}
        title="Memory Evaluations"
        subtitle="메모리 제품 평가 프로젝트 관리"
        accent="green"
        right={
          <Link href="/evaluations/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900/80 p-1">
        {statusFilters.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {s ? STATUS_CONFIG[s]?.label || s : "All"}
          </button>
        ))}
      </div>

      {/* Project cards */}
      {loading ? (
        <Card><p className="text-gray-500 text-sm">Loading...</p></Card>
      ) : projects.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FlaskConical className="h-12 w-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">
              {filter ? "해당 상태의 프로젝트가 없습니다." : "아직 평가 프로젝트가 없습니다."}
            </p>
            <Link href="/evaluations/new" className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-3 w-3" /> Create first project
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.PLANNED;
            const typeCfg = TYPE_CONFIG[p.evalType] || TYPE_CONFIG.FIELD;
            const StatusIcon = statusCfg.icon;
            const TypeIcon = typeCfg.icon;
            const passedPhases = p.phases.filter((ph) => ph.status === "PASSED" || ph.status === "SKIPPED").length;

            return (
              <Link key={p.id} href={`/evaluations/${p.id}`}>
                <Card className="h-full hover:border-blue-600/50 transition-colors cursor-pointer">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-[10px] font-medium text-gray-500 uppercase">
                        {typeCfg.label}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-gray-100 mb-1 line-clamp-2">{p.title}</h3>

                  {/* Memory spec */}
                  <p className="text-xs text-gray-400 mb-3">
                    {[
                      p.manufacturer,
                      p.memoryType,
                      p.capacityGb ? `${p.capacityGb}GB` : null,
                      p.speedMhz ? `${p.speedMhz}MHz` : null,
                      p.formFactor,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Spec not set"}
                  </p>

                  {/* Progress bar */}
                  {p.phases.length > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                        <span>Phases</span>
                        <span>{passedPhases}/{p.phases.length}</span>
                      </div>
                      <div className="flex gap-1">
                        {p.phases.map((ph) => (
                          <div
                            key={ph.id}
                            className={`h-1.5 flex-1 rounded-full ${
                              ph.status === "PASSED"
                                ? "bg-green-500"
                                : ph.status === "FAILED"
                                  ? "bg-red-500"
                                  : ph.status === "IN_PROGRESS"
                                    ? "bg-blue-500"
                                    : ph.status === "SKIPPED"
                                      ? "bg-gray-600"
                                      : "bg-gray-800"
                            }`}
                            title={`${ph.name}: ${ph.status}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    {p.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.startDate).toLocaleDateString("ko-KR")}
                        {p.endDate && ` ~ ${new Date(p.endDate).toLocaleDateString("ko-KR")}`}
                      </span>
                    )}
                    <span>{p._count.results} results</span>
                    <span>{p._count.tasks} tasks</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
