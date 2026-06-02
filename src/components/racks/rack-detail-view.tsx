"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import {
  Layers,
  HardDrive,
  Building2,
  Server,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Settings2,
  Plus,
  GripVertical,
  X,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

/* ── Types ── */

interface EquipmentItem {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  status: string;
  rackPosition: number | null;
  rackHeight: number;
  type: string;
  model: string | null;
  manufacturer: string | null;
}

interface RackData {
  id: string;
  name: string;
  rowLabel: string | null;
  totalUnits: number;
  maxPowerWatts: number | null;
  equipment: EquipmentItem[];
}

interface RoomGroup {
  roomId: string;
  roomName: string;
  racks: RackData[];
}

interface RacksClientProps {
  roomGroups: RoomGroup[];
  totalRacks: number;
  totalEquipment: number;
  totalUnits: number;
  usedUnits: number;
  utilization: number;
  roomCount: number;
}

/* ── Status color map for rack elevation ── */

const statusColor: Record<string, string> = {
  ACTIVE: "bg-green-600/30 border-green-600 text-green-300",
  MAINTENANCE: "bg-purple-600/30 border-purple-600 text-purple-300",
  REPAIR: "bg-orange-600/30 border-orange-600 text-orange-300",
  FAILED: "bg-red-600/30 border-red-600 text-red-300",
  PLANNED: "bg-blue-600/30 border-blue-600 text-blue-300",
  INSTALLED: "bg-cyan-600/30 border-cyan-600 text-cyan-300",
  RECEIVING: "bg-sky-600/30 border-sky-600 text-sky-300",
  DECOMMISSIONED: "bg-gray-600/30 border-gray-600 text-gray-400",
  DISPOSED: "bg-gray-700/30 border-gray-700 text-gray-500",
};

/* ── Helper: check if position is available ── */

function canPlace(
  rackEquipment: EquipmentItem[],
  position: number,
  height: number,
  totalUnits: number,
  excludeId?: string,
): boolean {
  if (position < 1 || position + height - 1 > totalUnits) return false;
  for (const eq of rackEquipment) {
    if (eq.id === excludeId || eq.rackPosition === null) continue;
    const eqTop = eq.rackPosition + eq.rackHeight - 1;
    const newTop = position + height - 1;
    if (position <= eqTop && newTop >= eq.rackPosition) return false;
  }
  return true;
}

/* ── Inline Rack Elevation with Drag & Drop ── */

function RackElevationInline({
  rack,
  onEquipmentMoved,
}: {
  rack: RackData;
  onEquipmentMoved?: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [unrackedEquipment, setUnrackedEquipment] = useState<EquipmentItem[]>([]);
  const [loadingUnracked, setLoadingUnracked] = useState(false);
  const [localEquipment, setLocalEquipment] = useState<EquipmentItem[]>(rack.equipment);

  const units = Array.from({ length: rack.totalUnits }, (_, i) => {
    const pos = rack.totalUnits - i;
    const eq = localEquipment.find(
      (e) =>
        e.rackPosition !== null &&
        pos >= e.rackPosition &&
        pos < e.rackPosition + e.rackHeight,
    );
    const isStart = eq?.rackPosition === pos;
    return { position: pos, equipment: eq || null, isStart };
  });

  const sortedEquipment = [...localEquipment]
    .filter((e) => e.rackPosition !== null)
    .sort((a, b) => (b.rackPosition ?? 0) - (a.rackPosition ?? 0));

  const unpositioned = localEquipment.filter((e) => e.rackPosition === null);

  const moveEquipment = useCallback(
    async (equipmentId: string, newPosition: number) => {
      const eq = localEquipment.find((e) => e.id === equipmentId);
      if (!eq) return;

      if (!canPlace(localEquipment, newPosition, eq.rackHeight, rack.totalUnits, eq.id)) {
        toast({ type: "error", title: "해당 위치에 공간이 부족합니다" });
        return;
      }

      setSaving(true);
      setLocalEquipment((prev) =>
        prev.map((e) => (e.id === equipmentId ? { ...e, rackPosition: newPosition } : e)),
      );

      try {
        const res = await fetch(`/api/equipment/${equipmentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rackPosition: newPosition }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast({ type: "error", title: data.error || "이동 실패" });
          setLocalEquipment((prev) =>
            prev.map((e) => (e.id === equipmentId ? { ...e, rackPosition: eq.rackPosition } : e)),
          );
        } else {
          toast({ type: "success", title: `U${newPosition}으로 이동 완료` });
          onEquipmentMoved?.();
        }
      } catch {
        toast({ type: "error", title: "서버 통신 오류" });
        setLocalEquipment((prev) =>
          prev.map((e) => (e.id === equipmentId ? { ...e, rackPosition: eq.rackPosition } : e)),
        );
      } finally {
        setSaving(false);
      }
    },
    [localEquipment, rack.totalUnits, toast, onEquipmentMoved],
  );

  const addEquipmentToRack = useCallback(
    async (equipmentId: string, position: number, height: number) => {
      if (!canPlace(localEquipment, position, height, rack.totalUnits)) {
        toast({ type: "error", title: "해당 위치에 공간이 부족합니다" });
        return;
      }

      setSaving(true);
      try {
        const res = await fetch(`/api/equipment/${equipmentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rackId: rack.id, rackPosition: position }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast({ type: "error", title: data.error || "배치 실패" });
        } else {
          const added = unrackedEquipment.find((e) => e.id === equipmentId);
          if (added) {
            setLocalEquipment((prev) => [...prev, { ...added, rackPosition: position }]);
            setUnrackedEquipment((prev) => prev.filter((e) => e.id !== equipmentId));
          }
          toast({ type: "success", title: `U${position}에 배치 완료` });
          onEquipmentMoved?.();
        }
      } catch {
        toast({ type: "error", title: "서버 통신 오류" });
      } finally {
        setSaving(false);
      }
    },
    [localEquipment, rack.id, rack.totalUnits, toast, unrackedEquipment, onEquipmentMoved],
  );

  const removeFromRack = useCallback(
    async (equipmentId: string) => {
      setSaving(true);
      const eq = localEquipment.find((e) => e.id === equipmentId);
      try {
        const res = await fetch(`/api/equipment/${equipmentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rackId: null, rackPosition: null }),
        });
        if (!res.ok) {
          toast({ type: "error", title: "제거 실패" });
        } else {
          setLocalEquipment((prev) => prev.filter((e) => e.id !== equipmentId));
          toast({ type: "success", title: `${eq?.hostname || "장비"} 배치 해제` });
          onEquipmentMoved?.();
        }
      } catch {
        toast({ type: "error", title: "서버 통신 오류" });
      } finally {
        setSaving(false);
      }
    },
    [localEquipment, toast, onEquipmentMoved],
  );

  const loadUnrackedEquipment = useCallback(async () => {
    setLoadingUnracked(true);
    try {
      const res = await fetch("/api/equipment?unracked=true&limit=200");
      if (res.ok) {
        const data = await res.json();
        const items = (data.equipment || data).map(
          (e: Record<string, unknown>) => ({
            id: e.id as string,
            hostname: e.hostname as string | null,
            ipAddress: e.ipAddress as string | null,
            status: e.status as string,
            rackPosition: null,
            rackHeight: (e.rackHeight as number) || 1,
            type: e.type as string,
            model: e.model as string | null,
            manufacturer: e.manufacturer as string | null,
          }),
        );
        setUnrackedEquipment(items);
      }
    } catch {
      toast({ type: "error", title: "미배치 장비 로드 실패" });
    } finally {
      setLoadingUnracked(false);
    }
  }, [toast]);

  const handleDragStart = (eqId: string) => {
    setDraggingId(eqId);
  };

  const handleDragOver = (e: React.DragEvent, position: number) => {
    e.preventDefault();
    setDropTarget(position);
  };

  const handleDrop = (position: number) => {
    if (draggingId) {
      moveEquipment(draggingId, position);
    }
    setDraggingId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const nudge = (eqId: string, direction: "up" | "down") => {
    const eq = localEquipment.find((e) => e.id === eqId);
    if (!eq || eq.rackPosition === null) return;
    const newPos = direction === "up" ? eq.rackPosition + 1 : eq.rackPosition - 1;
    moveEquipment(eqId, newPos);
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Interactive Rack Elevation */}
        <div className="w-full max-w-sm shrink-0">
          <div className="rounded-lg border-2 border-gray-700 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                <div className="h-2 w-2 rounded-full bg-amber-500" />
              </div>
              <span className="font-mono text-[10px] text-gray-500">
                {rack.name} - {rack.totalUnits}U
                {saving && <span className="ml-2 text-blue-400">저장중...</span>}
              </span>
            </div>
            <div className="space-y-px">
              {units.map(({ position, equipment, isStart }) => (
                <div
                  key={position}
                  className="flex items-stretch gap-1"
                  onDragOver={(e) => handleDragOver(e, position)}
                  onDrop={() => handleDrop(position)}
                >
                  <span className="w-8 text-right text-[10px] leading-6 text-gray-500">
                    U{position}
                  </span>
                  {equipment && isStart ? (
                    <div
                      draggable
                      onDragStart={() => handleDragStart(equipment.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group/eq relative flex flex-1 cursor-grab items-center rounded border-2 px-2 text-xs transition-all active:cursor-grabbing",
                        draggingId === equipment.id
                          ? "opacity-50 ring-2 ring-blue-500"
                          : "hover:brightness-125 hover:shadow-lg",
                        statusColor[equipment.status] ||
                          "bg-gray-800 border-gray-700 text-gray-400",
                      )}
                      style={{
                        height: `${equipment.rackHeight * 24 + (equipment.rackHeight - 1)}px`,
                      }}
                    >
                      <GripVertical className="mr-1 h-3 w-3 shrink-0 text-gray-500" />
                      <span className="truncate font-mono">
                        {equipment.hostname || equipment.type}
                      </span>
                      <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-56 rounded-lg border border-gray-700 bg-gray-900 p-3 text-left text-xs shadow-xl group-hover/eq:block">
                        <p className="font-semibold text-gray-100">
                          {equipment.hostname || "(unnamed)"}
                        </p>
                        <div className="mt-1 space-y-0.5 text-gray-400">
                          <p>
                            <span className="text-gray-500">Position:</span>{" "}
                            <span className="font-mono text-gray-200">
                              U{equipment.rackPosition} ({equipment.rackHeight}U)
                            </span>
                          </p>
                          {equipment.model && (
                            <p>
                              <span className="text-gray-500">Model:</span>{" "}
                              <span className="font-mono text-blue-300">{equipment.model}</span>
                            </p>
                          )}
                          {equipment.ipAddress && (
                            <p>
                              <span className="text-gray-500">IP:</span>{" "}
                              <span className="font-mono text-gray-200">{equipment.ipAddress}</span>
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-[10px] text-gray-500">드래그하여 위치 변경</p>
                      </div>
                    </div>
                  ) : equipment ? (
                    <div className="h-0 flex-1" />
                  ) : (
                    <div
                      className={cn(
                        "flex h-6 flex-1 items-center rounded border px-2 text-[10px] transition-colors",
                        dropTarget === position
                          ? "border-blue-500 bg-blue-500/20 text-blue-400"
                          : "border-gray-800 bg-gray-800/30 text-gray-600",
                      )}
                    >
                      {dropTarget === position ? "여기에 놓기" : "empty"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend + Actions */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex flex-wrap gap-3 text-xs">
              {[
                ["ACTIVE", "bg-green-600"],
                ["MAINTENANCE", "bg-purple-600"],
                ["FAILED", "bg-red-600"],
              ].map(([s, color]) => (
                <div key={s} className="flex items-center gap-1">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", color)} />
                  <span className="text-gray-500">{s}</span>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setShowAddPanel(!showAddPanel);
                if (!showAddPanel && unrackedEquipment.length === 0) {
                  loadUnrackedEquipment();
                }
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              장비 추가
            </Button>
          </div>
        </div>

        {/* Right: Equipment Table + Add Panel */}
        <div className="min-w-0 flex-1">
          <h4 className="mb-3 text-sm font-semibold text-gray-300">
            {t("rack.title")} - {localEquipment.length}{" "}
            {t("capacity.equipment").toLowerCase()}
          </h4>

          {sortedEquipment.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="px-2 py-2 font-medium">U</th>
                    <th className="px-2 py-2 font-medium">Hostname</th>
                    <th className="px-2 py-2 font-medium">IP</th>
                    <th className="px-2 py-2 font-medium">{t("common.status")}</th>
                    <th className="px-2 py-2 font-medium">{t("common.type")}</th>
                    <th className="px-2 py-2 font-medium">{t("infra.model")}</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {sortedEquipment.map((eq) => (
                    <tr
                      key={eq.id}
                      className="text-gray-300 transition-colors hover:bg-gray-800/40"
                    >
                      <td className="px-2 py-2 font-mono text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>
                            U{eq.rackPosition}
                            {eq.rackHeight > 1 && (
                              <span className="text-gray-600">
                                -{(eq.rackPosition ?? 0) + eq.rackHeight - 1}
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => nudge(eq.id, "up")}
                            className="rounded p-0.5 text-gray-600 hover:bg-gray-700 hover:text-gray-300"
                            title="위로 이동"
                            disabled={saving}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => nudge(eq.id, "down")}
                            className="rounded p-0.5 text-gray-600 hover:bg-gray-700 hover:text-gray-300"
                            title="아래로 이동"
                            disabled={saving}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/servers/${eq.id}`}
                          className="font-medium text-gray-100 hover:text-blue-400"
                        >
                          {eq.hostname || "-"}
                        </Link>
                      </td>
                      <td className="px-2 py-2 font-mono text-gray-400">
                        {eq.ipAddress || "-"}
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={eq.status} />
                      </td>
                      <td className="px-2 py-2 text-gray-400">{eq.type}</td>
                      <td className="px-2 py-2">
                        {eq.model ? (
                          <span className="rounded bg-blue-600/10 px-1.5 py-0.5 font-mono text-blue-300">
                            {eq.model}
                          </span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/servers/${eq.id}`}
                            className="text-blue-400 hover:text-blue-300"
                            title={t("common.details")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => removeFromRack(eq.id)}
                            className="rounded p-0.5 text-gray-600 hover:text-red-400"
                            title="랙에서 제거"
                            disabled={saving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t("common.noData")}</p>
          )}

          {/* Unpositioned equipment in this rack */}
          {unpositioned.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-amber-400">
                위치 미지정 ({unpositioned.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {unpositioned.map((eq) => (
                  <div
                    key={eq.id}
                    draggable
                    onDragStart={() => handleDragStart(eq.id)}
                    onDragEnd={handleDragEnd}
                    className="flex cursor-grab items-center gap-1 rounded border border-amber-800/50 bg-amber-900/20 px-2 py-1 text-xs text-amber-300 transition-colors hover:bg-amber-900/40 active:cursor-grabbing"
                  >
                    <GripVertical className="h-3 w-3" />
                    {eq.hostname || eq.type}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                드래그하여 랙 슬롯에 배치하세요
              </p>
            </div>
          )}

          {/* Add Equipment Panel */}
          {showAddPanel && (
            <AddEquipmentPanel
              unrackedEquipment={unrackedEquipment}
              loading={loadingUnracked}
              rack={rack}
              localEquipment={localEquipment}
              onAdd={addEquipmentToRack}
              onClose={() => setShowAddPanel(false)}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Add Equipment Panel ── */

function AddEquipmentPanel({
  unrackedEquipment,
  loading,
  rack,
  localEquipment,
  onAdd,
  onClose,
  saving,
}: {
  unrackedEquipment: EquipmentItem[];
  loading: boolean;
  rack: RackData;
  localEquipment: EquipmentItem[];
  onAdd: (id: string, pos: number, height: number) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetPosition, setTargetPosition] = useState<string>("");

  const selected = unrackedEquipment.find((e) => e.id === selectedId);

  const firstAvailable = (): number => {
    for (let pos = 1; pos <= rack.totalUnits; pos++) {
      if (canPlace(localEquipment, pos, selected?.rackHeight || 1, rack.totalUnits)) return pos;
    }
    return 1;
  };

  const handleAdd = () => {
    if (!selectedId) return;
    const pos = targetPosition ? parseInt(targetPosition) : firstAvailable();
    onAdd(selectedId, pos, selected?.rackHeight || 1);
    setSelectedId(null);
    setTargetPosition("");
  };

  return (
    <div className="mt-4 rounded-lg border border-blue-800/50 bg-blue-900/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h5 className="text-sm font-semibold text-blue-300">미배치 장비 추가</h5>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">로딩중...</p>
      ) : unrackedEquipment.length === 0 ? (
        <p className="text-xs text-gray-500">미배치 장비가 없습니다</p>
      ) : (
        <>
          <div className="mb-3 max-h-48 space-y-1 overflow-y-auto">
            {unrackedEquipment.map((eq) => (
              <button
                key={eq.id}
                onClick={() => setSelectedId(eq.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs transition-colors",
                  selectedId === eq.id
                    ? "bg-blue-600/20 border border-blue-600 text-blue-200"
                    : "border border-transparent text-gray-300 hover:bg-gray-800",
                )}
              >
                <Server className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                <span className="font-medium">{eq.hostname || eq.type}</span>
                {eq.ipAddress && (
                  <span className="font-mono text-gray-500">{eq.ipAddress}</span>
                )}
                <StatusBadge status={eq.status} />
                <span className="ml-auto text-gray-600">{eq.rackHeight}U</span>
              </button>
            ))}
          </div>

          {selectedId && (
            <div className="flex items-center gap-3 border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-400">
                {selected?.hostname || selected?.type}
              </span>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">U위치:</label>
                <input
                  type="number"
                  className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  placeholder={`${firstAvailable()}`}
                  min={1}
                  max={rack.totalUnits}
                />
              </div>
              <Button
                size="sm"
                className="text-xs"
                onClick={handleAdd}
                disabled={saving}
              >
                <Plus className="mr-1 h-3 w-3" />
                배치
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Main Racks Client Component ── */

export function RacksPageClient({
  roomGroups,
  totalRacks,
  totalEquipment,
  totalUnits,
  usedUnits,
  utilization,
  roomCount,
}: RacksClientProps) {
  const t = useT();
  const router = useRouter();
  const [expandedRack, setExpandedRack] = useState<string | null>(null);

  const toggleRack = (rackId: string) => {
    setExpandedRack((prev) => (prev === rackId ? null : rackId));
  };

  const handleEquipmentMoved = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Layers}
        title={t("nav.racks")}
        subtitle={`${t("rack.title")} - ${t("common.total")} ${totalRacks}`}
        accent="purple"
        right={
          <Link href="/racks/manage">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              {t("rackManage.manage")}
            </Button>
          </Link>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Total Racks</p>
            <HardDrive className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-1 text-2xl font-bold">{totalRacks}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Rooms</p>
            <Building2 className="h-4 w-4 text-purple-400" />
          </div>
          <p className="mt-1 text-2xl font-bold">{roomCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{t("capacity.equipment")}</p>
            <Server className="h-4 w-4 text-green-400" />
          </div>
          <p className="mt-1 text-2xl font-bold">{totalEquipment}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">U {t("capacity.utilization")}</p>
          <p className="mt-1 text-2xl font-bold">
            {utilization}
            <span className="text-lg text-gray-500">%</span>
          </p>
          <p className="text-xs text-gray-500">
            {usedUnits} / {totalUnits} U
          </p>
        </Card>
      </div>

      {/* By Room */}
      {roomGroups.length === 0 ? (
        <Card className="p-12 text-center text-gray-500">
          {t("common.noData")}
        </Card>
      ) : (
        roomGroups.map(({ roomId, roomName, racks }) => (
          <div key={roomId}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-200">
              <Building2 className="h-5 w-5 text-blue-400" />
              {roomName}
              <Badge>{racks.length} racks</Badge>
            </h2>
            <div className="space-y-3">
              {racks.map((rack) => {
                const used = rack.equipment.reduce(
                  (s, e) => s + (e.rackHeight || 1),
                  0,
                );
                const pct = rack.totalUnits
                  ? Math.round((used / rack.totalUnits) * 100)
                  : 0;
                const active = rack.equipment.filter(
                  (e) => e.status === "ACTIVE",
                ).length;
                const failed = rack.equipment.filter(
                  (e) => e.status === "FAILED",
                ).length;
                const isExpanded = expandedRack === rack.id;

                return (
                  <div key={rack.id}>
                    <Card
                      className={cn(
                        "transition-colors",
                        isExpanded
                          ? "border-blue-600 bg-blue-600/5"
                          : "hover:border-gray-600",
                      )}
                    >
                      <div
                        className="cursor-pointer p-4"
                        onClick={() => toggleRack(rack.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <HardDrive className="h-5 w-5 text-gray-500" />
                            <div>
                              <p className="font-semibold text-gray-100">
                                {rack.name}
                              </p>
                              {rack.rowLabel && (
                                <p className="text-xs text-gray-500">
                                  Row {rack.rowLabel}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/servers?rack=${rack.id}`}
                              onClick={(e) => e.stopPropagation()}
                              title="Digital Twin"
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1.5 text-xs"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Digital Twin
                              </Button>
                            </Link>
                            <button
                              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5" />
                              ) : (
                                <ChevronDown className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>
                              {used} / {rack.totalUnits}U
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className={cn(
                                "h-full transition-all",
                                pct > 85
                                  ? "bg-red-500"
                                  : pct > 60
                                    ? "bg-amber-500"
                                    : "bg-green-500",
                              )}
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-3 text-xs">
                          <span className="text-gray-400">
                            {rack.equipment.length} devices
                          </span>
                          {active > 0 && (
                            <span className="text-green-400">
                              {active} active
                            </span>
                          )}
                          {failed > 0 && (
                            <span className="text-red-400">
                              {failed} failed
                            </span>
                          )}
                        </div>

                        {rack.maxPowerWatts && (
                          <p className="mt-2 text-xs text-gray-500">
                            Max {(rack.maxPowerWatts / 1000).toFixed(1)} kW
                          </p>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-700 px-4 pb-4">
                          <RackElevationInline
                            rack={rack}
                            onEquipmentMoved={handleEquipmentMoved}
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
