"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, FlaskConical, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface PhaseInput {
  name: string;
  description: string;
}

export default function NewEvaluationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evalType, setEvalType] = useState<"FIELD" | "ACCELERATED">("FIELD");
  const [memoryType, setMemoryType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [capacityGb, setCapacityGb] = useState("");
  const [speedMhz, setSpeedMhz] = useState("");
  const [formFactor, setFormFactor] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [phases, setPhases] = useState<PhaseInput[]>([
    { name: "", description: "" },
  ]);

  const addPhase = () => setPhases([...phases, { name: "", description: "" }]);
  const removePhase = (idx: number) => setPhases(phases.filter((_, i) => i !== idx));
  const updatePhase = (idx: number, field: keyof PhaseInput, value: string) => {
    const updated = [...phases];
    updated[idx] = { ...updated[idx], [field]: value };
    setPhases(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("프로젝트 제목을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const validPhases = phases.filter((p) => p.name.trim());
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          evalType,
          memoryType: memoryType || null,
          manufacturer: manufacturer || null,
          partNumber: partNumber || null,
          capacityGb: capacityGb || null,
          speedMhz: speedMhz || null,
          formFactor: formFactor || null,
          startDate: startDate || null,
          endDate: endDate || null,
          phases: validPhases.length > 0 ? validPhases : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to create project");
        setSaving(false);
        return;
      }

      const project = await res.json();
      router.push(`/evaluations/${project.id}`);
    } catch {
      setError("서버 통신 오류");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link href="/evaluations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <PageHeader
          icon={Plus}
          title="New Evaluation Project"
          subtitle="새 메모리 평가 프로젝트 생성"
          accent="green"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-300 mb-4">기본 정보</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                프로젝트 제목 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="DDR5-6400 Field Evaluation - Samsung"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="평가 목적, 범위, 특이사항 등"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                평가 유형 *
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEvalType("FIELD")}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    evalType === "FIELD"
                      ? "border-blue-500 bg-blue-900/30 text-blue-300"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <FlaskConical className="h-4 w-4" />
                  Field (필드 평가)
                </button>
                <button
                  type="button"
                  onClick={() => setEvalType("ACCELERATED")}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    evalType === "ACCELERATED"
                      ? "border-amber-500 bg-amber-900/30 text-amber-300"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  Accelerated (가속 평가)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">시작일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">종료일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Memory Spec */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-300 mb-4">메모리 사양</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">제조사</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Samsung, SK Hynix, Micron..."
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">메모리 유형</label>
              <select
                value={memoryType}
                onChange={(e) => setMemoryType(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="">선택</option>
                <option value="DDR4">DDR4</option>
                <option value="DDR5">DDR5</option>
                <option value="LPDDR4">LPDDR4</option>
                <option value="LPDDR5">LPDDR5</option>
                <option value="HBM2">HBM2</option>
                <option value="HBM3">HBM3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Part Number</label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="M321R8GA0BB0-CQK"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">용량 (GB)</label>
              <input
                type="number"
                value={capacityGb}
                onChange={(e) => setCapacityGb(e.target.value)}
                placeholder="64"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">속도 (MHz)</label>
              <input
                type="number"
                value={speedMhz}
                onChange={(e) => setSpeedMhz(e.target.value)}
                placeholder="6400"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">폼 팩터</label>
              <select
                value={formFactor}
                onChange={(e) => setFormFactor(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="">선택</option>
                <option value="RDIMM">RDIMM</option>
                <option value="UDIMM">UDIMM</option>
                <option value="SODIMM">SO-DIMM</option>
                <option value="LRDIMM">LRDIMM</option>
                <option value="NVDIMM">NVDIMM</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Phases */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">평가 단계 (Phases)</h2>
            <Button type="button" variant="outline" size="sm" onClick={addPhase}>
              <Plus className="mr-1 h-3 w-3" /> Add Phase
            </Button>
          </div>

          <div className="space-y-3">
            {phases.map((phase, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="mt-2 text-xs font-mono text-gray-600 w-6 text-right">
                  {idx + 1}.
                </span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={phase.name}
                    onChange={(e) => updatePhase(idx, "name", e.target.value)}
                    placeholder="Phase name (e.g. Incoming QC)"
                    className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={phase.description}
                    onChange={(e) => updatePhase(idx, "description", e.target.value)}
                    placeholder="Description (optional)"
                    className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                {phases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhase(idx)}
                    className="mt-2 text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] text-gray-600">
            비워두면 단계 없이 생성됩니다. 프로젝트 생성 후에도 추가할 수 있습니다.
          </p>
        </Card>

        {/* Error & Submit */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/evaluations">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>
    </div>
  );
}
