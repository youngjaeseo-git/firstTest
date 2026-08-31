"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { X, MapPin } from "lucide-react";

interface RackOption {
  id: string;
  name: string;
  roomName: string;
  totalUnits: number;
}

interface QuickPlaceModalProps {
  equipmentId: string;
  equipmentLabel: string;
  onClose: () => void;
  onPlaced?: () => void;
}

/**
 * Lightweight single-equipment placement dialog.
 * Fetches the rack list, lets the user pick rack + U position, and writes via
 * the bulk-place API (single placement) which enforces server-side conflict
 * checks. Reusable from search results, infrastructure list, etc.
 */
export function QuickPlaceModal({
  equipmentId,
  equipmentLabel,
  onClose,
  onPlaced,
}: QuickPlaceModalProps) {
  const { toast } = useToast();
  const [racks, setRacks] = useState<RackOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [rackId, setRackId] = useState("");
  const [position, setPosition] = useState("1");
  const [height, setHeight] = useState("1");
  const [saving, setSaving] = useState(false);

  const loadRacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/racks");
      if (res.ok) {
        const data = await res.json();
        const list: RackOption[] = (data.items || data || []).map(
          (r: Record<string, unknown>) => ({
            id: r.id as string,
            name: r.name as string,
            roomName:
              ((r.room as Record<string, unknown> | null)?.name as string) ||
              "-",
            totalUnits: (r.totalUnits as number) || 42,
          }),
        );
        setRacks(list);
        if (list.length > 0) setRackId(list[0].id);
      }
    } catch {
      toast({ type: "error", title: "랙 목록 로드 실패" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRacks();
  }, [loadRacks]);

  const selectedRack = racks.find((r) => r.id === rackId);

  const handlePlace = async () => {
    if (!rackId) {
      toast({ type: "error", title: "랙을 선택하세요" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/equipment/bulk-place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placements: [
            {
              equipmentId,
              rackId,
              rackPosition: parseInt(position) || 1,
              rackHeight: parseInt(height) || 1,
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success > 0) {
        toast({ type: "success", title: `${equipmentLabel} 배치 완료` });
        onPlaced?.();
        onClose();
      } else {
        const err = data.failed?.[0]?.error || data.error || "배치 실패";
        toast({ type: "error", title: err });
      }
    } catch {
      toast({ type: "error", title: "서버 통신 오류" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-100">랙 배치</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-400">
          <span className="font-medium text-gray-200">{equipmentLabel}</span> 을(를)
          배치합니다.
        </p>

        {loading ? (
          <p className="text-sm text-gray-500">랙 목록 로딩중...</p>
        ) : racks.length === 0 ? (
          <p className="text-sm text-gray-500">
            등록된 랙이 없습니다. 먼저 랙을 생성하세요.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">랙</label>
              <select
                className={inputCls}
                value={rackId}
                onChange={(e) => setRackId(e.target.value)}
              >
                {racks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomName} / {r.name} ({r.totalUnits}U)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">
                  U 위치 (1 = 맨 아래)
                </label>
                <input
                  type="number"
                  className={inputCls}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  min={1}
                  max={selectedRack?.totalUnits || 42}
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs text-gray-500">높이</label>
                <select
                  className={inputCls}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                >
                  {[1, 2, 3, 4, 6, 8, 10].map((h) => (
                    <option key={h} value={h}>
                      {h}U
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={handlePlace}
            disabled={saving || loading || racks.length === 0}
            className={cn(saving && "opacity-50")}
          >
            배치
          </Button>
        </div>
      </div>
    </div>
  );
}
