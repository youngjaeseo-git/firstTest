"use client";

import { useState, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Upload,
  Server,
  HardDrive,
  Plus,
  Trash2,
  Play,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface RackOption {
  id: string;
  name: string;
  roomName: string;
  totalUnits: number;
}

interface UnrackedEquipment {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  type: string;
  status: string;
  rackHeight: number;
}

interface PlacementRow {
  equipmentId: string;
  equipmentLabel: string;
  rackId: string;
  rackPosition: number;
  rackHeight: number;
}

interface BulkPlacePanelProps {
  racks: RackOption[];
}

export function BulkPlacePanel({ racks }: BulkPlacePanelProps) {
  const { toast } = useToast();
  const [unracked, setUnracked] = useState<UnrackedEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: { equipmentId: string; error: string }[];
  } | null>(null);

  const fetchUnracked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/equipment?unracked=true&limit=200");
      if (res.ok) {
        const data = await res.json();
        setUnracked(
          (data.items || []).map((e: Record<string, unknown>) => ({
            id: e.id,
            hostname: e.hostname,
            ipAddress: e.ipAddress,
            type: e.type,
            status: e.status,
            rackHeight: (e.rackHeight as number) || 1,
          })),
        );
      }
    } catch {
      toast({ type: "error", title: "미배치 장비 로드 실패" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUnracked();
  }, [fetchUnracked]);

  const addRow = (eq: UnrackedEquipment) => {
    if (rows.some((r) => r.equipmentId === eq.id)) {
      toast({ type: "error", title: "이미 추가된 장비입니다" });
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        equipmentId: eq.id,
        equipmentLabel: eq.hostname || eq.ipAddress || eq.type,
        rackId: racks[0]?.id || "",
        rackPosition: 1,
        rackHeight: eq.rackHeight,
      },
    ]);
  };

  const addAllUnracked = () => {
    const existing = new Set(rows.map((r) => r.equipmentId));
    const newRows = unracked
      .filter((eq) => !existing.has(eq.id))
      .map((eq) => ({
        equipmentId: eq.id,
        equipmentLabel: eq.hostname || eq.ipAddress || eq.type,
        rackId: racks[0]?.id || "",
        rackPosition: 1,
        rackHeight: eq.rackHeight,
      }));
    setRows((prev) => [...prev, ...newRows]);
  };

  const updateRow = (idx: number, field: keyof PlacementRow, value: string | number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const execute = async () => {
    if (rows.length === 0) return;
    setExecuting(true);
    setResult(null);
    try {
      const res = await fetch("/api/equipment/bulk-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: rows.map((r) => ({
            equipmentId: r.equipmentId,
            rackId: r.rackId,
            rackPosition: r.rackPosition,
            rackHeight: r.rackHeight,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast({
          type: data.failed?.length > 0 ? "error" : "success",
          title: `${data.success}개 성공${data.failed?.length > 0 ? `, ${data.failed.length}개 실패` : ""}`,
        });
        if (data.success > 0) {
          fetchUnracked();
          setRows((prev) =>
            prev.filter((r) =>
              data.failed?.some(
                (f: { equipmentId: string }) => f.equipmentId === r.equipmentId,
              ),
            ),
          );
        }
      } else {
        toast({ type: "error", title: data.error || "실패" });
      }
    } catch {
      toast({ type: "error", title: "서버 통신 오류" });
    } finally {
      setExecuting(false);
    }
  };

  const inputCls =
    "w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none";

  const availableUnracked = unracked.filter(
    (eq) => !rows.some((r) => r.equipmentId === eq.id),
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-100">일괄 배치</h3>
            <Badge variant="info">{rows.length}개 대기</Badge>
          </div>
          <div className="flex items-center gap-2">
            {availableUnracked.length > 0 && (
              <Button variant="outline" size="sm" onClick={addAllUnracked}>
                전체 추가 ({availableUnracked.length})
              </Button>
            )}
            <Button
              size="sm"
              onClick={execute}
              disabled={rows.length === 0 || executing}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              {executing ? "실행중..." : "일괄 배치 실행"}
            </Button>
          </div>
        </div>

        {/* Placement Table */}
        {rows.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="px-2 py-2 font-medium">장비</th>
                  <th className="px-2 py-2 font-medium">랙</th>
                  <th className="px-2 py-2 font-medium">U 위치</th>
                  <th className="px-2 py-2 font-medium">높이</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {rows.map((row, idx) => (
                  <tr key={row.equipmentId} className="text-gray-300">
                    <td className="px-2 py-2">
                      <span className="font-medium">{row.equipmentLabel}</span>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className={inputCls}
                        value={row.rackId}
                        onChange={(e) => updateRow(idx, "rackId", e.target.value)}
                      >
                        {racks.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.roomName} / {r.name} ({r.totalUnits}U)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        className={cn(inputCls, "w-20")}
                        value={row.rackPosition}
                        onChange={(e) =>
                          updateRow(idx, "rackPosition", parseInt(e.target.value) || 1)
                        }
                        min={1}
                        max={
                          racks.find((r) => r.id === row.rackId)?.totalUnits ?? 100
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className={cn(inputCls, "w-16")}
                        value={row.rackHeight}
                        onChange={(e) =>
                          updateRow(idx, "rackHeight", parseInt(e.target.value))
                        }
                      >
                        {[1, 2, 3, 4, 6, 8, 10].map((h) => (
                          <option key={h} value={h}>
                            {h}U
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeRow(idx)}
                        className="rounded p-1 text-gray-600 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-4 rounded-lg border border-gray-700 p-3">
            <div className="flex items-center gap-4 text-xs">
              {result.success > 0 && (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {result.success}개 성공
                </span>
              )}
              {result.failed?.length > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {result.failed.length}개 실패
                </span>
              )}
            </div>
            {result.failed?.length > 0 && (
              <div className="mt-2 space-y-1">
                {result.failed.map((f) => (
                  <p key={f.equipmentId} className="text-xs text-red-400">
                    {f.equipmentId}: {f.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Unracked Equipment List */}
      <Card>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-gray-100">미배치 장비</h3>
          <Badge variant="warning">{availableUnracked.length}</Badge>
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-gray-500">로딩중...</p>
        ) : availableUnracked.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            {unracked.length === 0
              ? "모든 장비가 랙에 배치되어 있습니다"
              : "모든 미배치 장비가 배치 목록에 추가되었습니다"}
          </p>
        ) : (
          <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">
            {availableUnracked.map((eq) => (
              <div
                key={eq.id}
                className="flex items-center justify-between rounded border border-gray-800 px-3 py-2 text-xs hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-gray-500" />
                  <span className="font-medium text-gray-200">
                    {eq.hostname || eq.type}
                  </span>
                  {eq.ipAddress && (
                    <span className="font-mono text-gray-500">
                      {eq.ipAddress}
                    </span>
                  )}
                  <StatusBadge status={eq.status} />
                  <span className="text-gray-600">{eq.rackHeight}U</span>
                </div>
                <button
                  onClick={() => addRow(eq)}
                  className="flex items-center gap-1 rounded bg-blue-600/20 px-2 py-1 text-blue-400 hover:bg-blue-600/30"
                >
                  <Plus className="h-3 w-3" />
                  추가
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
