"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import { useToast } from "@/components/ui/toast";
import {
  Settings2,
  Plus,
  Pencil,
  Trash2,
  Building2,
  HardDrive,
  X,
  Check,
  ArrowLeft,
  GripVertical,
} from "lucide-react";

/* ── Types ── */

interface RackItem {
  id: string;
  name: string;
  rowLabel: string | null;
  sortOrder: number;
  totalUnits: number;
  maxPowerWatts: number | null;
  positionX: number | null;
  positionY: number | null;
  equipmentCount: number;
}

interface RoomItem {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  racks: RackItem[];
}

interface Props {
  rooms: RoomItem[];
}

/* ── Form field component ── */

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const inputSmCls =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/* ── Main component ── */

export function RackManageClient({ rooms: initialRooms }: Props) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // Room add form
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", description: "", sortOrder: 0 });

  // Rack add form — which room is adding
  const [addingRackForRoom, setAddingRackForRoom] = useState<string | null>(null);
  const [newRack, setNewRack] = useState({
    name: "",
    rowLabel: "",
    sortOrder: 0,
    totalUnits: 42,
    maxPowerWatts: "",
    positionX: "",
    positionY: "",
  });

  // Editing rack
  const [editingRack, setEditingRack] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    rowLabel: "",
    sortOrder: 0,
    totalUnits: 42,
    maxPowerWatts: "",
    positionX: "",
    positionY: "",
  });

  // Editing room
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editRoomData, setEditRoomData] = useState({ name: "", description: "", sortOrder: 0 });

  async function apiCall(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ type: "error", title: data.error || `Error ${res.status}` });
        return null;
      }
      return await res.json();
    } catch {
      toast({ type: "error", title: t("common.serverError") });
      return null;
    } finally {
      setBusy(false);
    }
  }

  // ── Room CRUD ──

  async function createRoom() {
    if (!newRoom.name.trim()) return;
    const result = await apiCall("/api/rooms", "POST", {
      name: newRoom.name.trim(),
      description: newRoom.description.trim() || null,
      sortOrder: newRoom.sortOrder,
    });
    if (result) {
      toast({ type: "success", title: `Room "${result.name}" 생성됨` });
      setShowAddRoom(false);
      setNewRoom({ name: "", description: "", sortOrder: 0 });
      router.refresh();
    }
  }

  async function updateRoom(id: string) {
    const result = await apiCall(`/api/rooms/${id}`, "PATCH", {
      name: editRoomData.name.trim(),
      description: editRoomData.description.trim() || null,
      sortOrder: editRoomData.sortOrder,
    });
    if (result) {
      toast({ type: "success", title: `Room "${result.name}" 수정됨` });
      setEditingRoom(null);
      router.refresh();
    }
  }

  async function deleteRoom(id: string, name: string) {
    if (!confirm(`"${name}" Room을 삭제하시겠습니까? 하위 랙이 없어야 합니다.`)) return;
    const result = await apiCall(`/api/rooms/${id}`, "DELETE");
    if (result) {
      toast({ type: "success", title: `Room "${name}" 삭제됨` });
      router.refresh();
    }
  }

  // ── Rack CRUD ──

  async function createRack(roomId: string) {
    if (!newRack.name.trim()) return;
    const body: Record<string, unknown> = {
      name: newRack.name.trim(),
      roomId,
      sortOrder: newRack.sortOrder,
      totalUnits: newRack.totalUnits,
    };
    if (newRack.rowLabel.trim()) body.rowLabel = newRack.rowLabel.trim();
    if (newRack.maxPowerWatts) body.maxPowerWatts = parseInt(newRack.maxPowerWatts);
    if (newRack.positionX !== "") body.positionX = parseInt(newRack.positionX);
    if (newRack.positionY !== "") body.positionY = parseInt(newRack.positionY);

    const result = await apiCall("/api/racks", "POST", body);
    if (result) {
      toast({ type: "success", title: `Rack "${result.name}" 생성됨` });
      setAddingRackForRoom(null);
      setNewRack({ name: "", rowLabel: "", sortOrder: 0, totalUnits: 42, maxPowerWatts: "", positionX: "", positionY: "" });
      router.refresh();
    }
  }

  async function updateRack(id: string) {
    const body: Record<string, unknown> = {
      name: editData.name.trim(),
      sortOrder: editData.sortOrder,
      totalUnits: editData.totalUnits,
    };
    body.rowLabel = editData.rowLabel.trim() || null;
    body.maxPowerWatts = editData.maxPowerWatts ? parseInt(editData.maxPowerWatts) : null;
    body.positionX = editData.positionX !== "" ? parseInt(editData.positionX) : null;
    body.positionY = editData.positionY !== "" ? parseInt(editData.positionY) : null;

    const result = await apiCall(`/api/racks/${id}`, "PATCH", body);
    if (result) {
      toast({ type: "success", title: `Rack "${result.name}" 수정됨` });
      setEditingRack(null);
      router.refresh();
    }
  }

  async function deleteRack(id: string, name: string) {
    if (!confirm(`"${name}" Rack을 삭제하시겠습니까? 장비가 없어야 합니다.`)) return;
    const result = await apiCall(`/api/racks/${id}`, "DELETE");
    if (result) {
      toast({ type: "success", title: `Rack "${name}" 삭제됨` });
      router.refresh();
    }
  }

  function startEditRack(rack: RackItem) {
    setEditingRack(rack.id);
    setEditData({
      name: rack.name,
      rowLabel: rack.rowLabel || "",
      sortOrder: rack.sortOrder,
      totalUnits: rack.totalUnits,
      maxPowerWatts: rack.maxPowerWatts?.toString() || "",
      positionX: rack.positionX?.toString() ?? "",
      positionY: rack.positionY?.toString() ?? "",
    });
  }

  function startEditRoom(room: RoomItem) {
    setEditingRoom(room.id);
    setEditRoomData({
      name: room.name,
      description: room.description || "",
      sortOrder: room.sortOrder,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title={t("rackManage.title")}
        subtitle={t("rackManage.subtitle")}
        accent="purple"
        right={
          <Link href="/racks">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("rackManage.backToRacks")}
            </Button>
          </Link>
        }
      />

      {/* Add Room */}
      {showAddRoom ? (
        <Card className="border-blue-500/30 bg-blue-500/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-300">
            <Building2 className="h-4 w-4" /> {t("rackManage.addRoom")}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("rackManage.roomName")}>
              <input
                className={inputCls}
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="e.g. Server Room A"
              />
            </Field>
            <Field label={t("rackManage.description")}>
              <input
                className={inputCls}
                value={newRoom.description}
                onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                placeholder="e.g. GPU 서버룸"
              />
            </Field>
            <Field label={t("rackManage.sortOrder")}>
              <input
                type="number"
                className={inputCls}
                value={newRoom.sortOrder}
                onChange={(e) => setNewRoom({ ...newRoom, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={createRoom} disabled={busy || !newRoom.name.trim()}>
              <Check className="mr-1 h-3 w-3" /> {t("common.save")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddRoom(false)}>
              <X className="mr-1 h-3 w-3" /> {t("common.cancel")}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAddRoom(true)}>
          <Plus className="mr-1 h-4 w-4" /> {t("rackManage.addRoom")}
        </Button>
      )}

      {/* Rooms + Racks */}
      {initialRooms.length === 0 ? (
        <Card className="p-12 text-center text-gray-500">{t("common.noData")}</Card>
      ) : (
        initialRooms.map((room) => (
          <Card key={room.id} className="p-0">
            {/* Room header */}
            <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4 py-3">
              {editingRoom === room.id ? (
                <div className="flex flex-1 items-center gap-3">
                  <div>
                    <span className="text-[10px] text-gray-500">이름</span>
                    <input
                      className={cn(inputSmCls, "max-w-[200px]")}
                      value={editRoomData.name}
                      onChange={(e) => setEditRoomData({ ...editRoomData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">설명</span>
                    <input
                      className={cn(inputSmCls, "max-w-[200px]")}
                      value={editRoomData.description}
                      onChange={(e) => setEditRoomData({ ...editRoomData, description: e.target.value })}
                      placeholder={t("rackManage.description")}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">순서 (작을수록 먼저)</span>
                    <input
                      type="number"
                      className={cn(inputSmCls, "w-20")}
                      value={editRoomData.sortOrder}
                      onChange={(e) => setEditRoomData({ ...editRoomData, sortOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <button
                    onClick={() => updateRoom(room.id)}
                    disabled={busy}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setEditingRoom(null)}
                    className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-gray-100">{room.name}</h3>
                    {room.description && (
                      <span className="text-xs text-gray-500">— {room.description}</span>
                    )}
                    <span className="rounded-full bg-gray-700/50 px-1.5 py-0.5 text-[10px] text-gray-500" title="표시 순서">
                      #{room.sortOrder}
                    </span>
                    <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                      {room.racks.length} racks
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditRoom(room)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                      title={t("common.edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRoom(room.id, room.name)}
                      className="rounded p-1.5 text-gray-500 hover:bg-red-900/30 hover:text-red-400"
                      title={t("common.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Racks table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
                    <th className="px-4 py-2 font-medium">{t("rackManage.rackName")}</th>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium" title="평면도 가로 좌표 (왼쪽=0)">X</th>
                    <th className="px-3 py-2 font-medium" title="평면도 세로 좌표 (위=0)">Y</th>
                    <th className="px-3 py-2 font-medium">Units</th>
                    <th className="px-3 py-2 font-medium">Power (W)</th>
                    <th className="px-3 py-2 font-medium" title="목록 표시 순서 (작을수록 먼저)">{t("rackManage.sortOrder")}</th>
                    <th className="px-3 py-2 font-medium" title="이 랙에 배치된 장비 수">{t("rackManage.devices")}</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {room.racks.map((rack) =>
                    editingRack === rack.id ? (
                      <tr key={rack.id} className="bg-blue-600/5">
                        <td className="px-4 py-2">
                          <input
                            className={cn(inputSmCls, "w-28")}
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={cn(inputSmCls, "w-16")}
                            value={editData.rowLabel}
                            onChange={(e) => setEditData({ ...editData, rowLabel: e.target.value })}
                            placeholder="A"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className={cn(inputSmCls, "w-16")}
                            value={editData.positionX}
                            onChange={(e) => setEditData({ ...editData, positionX: e.target.value })}
                            placeholder="-"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className={cn(inputSmCls, "w-16")}
                            value={editData.positionY}
                            onChange={(e) => setEditData({ ...editData, positionY: e.target.value })}
                            placeholder="-"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className={cn(inputSmCls, "w-16")}
                            value={editData.totalUnits}
                            onChange={(e) => setEditData({ ...editData, totalUnits: parseInt(e.target.value) || 42 })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className={cn(inputSmCls, "w-20")}
                            value={editData.maxPowerWatts}
                            onChange={(e) => setEditData({ ...editData, maxPowerWatts: e.target.value })}
                            placeholder="-"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className={cn(inputSmCls, "w-14")}
                            value={editData.sortOrder}
                            onChange={(e) => setEditData({ ...editData, sortOrder: parseInt(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{rack.equipmentCount}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateRack(rack.id)}
                              disabled={busy}
                              className="rounded bg-blue-600 p-1 text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditingRack(null)}
                              className="rounded bg-gray-700 p-1 text-gray-300 hover:bg-gray-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={rack.id}
                        className="text-gray-300 transition-colors hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="h-3 w-3 text-gray-600" />
                            <span className="font-medium text-gray-100">{rack.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {rack.rowLabel ? (
                            <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-xs font-medium text-blue-400">
                              {rack.rowLabel}
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {rack.positionX ?? <span className="text-gray-600">-</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {rack.positionY ?? <span className="text-gray-600">-</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">{rack.totalUnits}U</td>
                        <td className="px-3 py-2 text-xs text-gray-400">
                          {rack.maxPowerWatts ? `${rack.maxPowerWatts}W` : "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{rack.sortOrder}</td>
                        <td className="px-3 py-2">
                          {rack.equipmentCount > 0 ? (
                            <span className="rounded-full bg-green-600/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                              {rack.equipmentCount}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditRack(rack)}
                              className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-blue-400"
                              title={t("common.edit")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteRack(rack.id, rack.name)}
                              className="rounded p-1 text-gray-500 hover:bg-red-900/30 hover:text-red-400"
                              title={t("common.delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}

                  {/* Add rack form row */}
                  {addingRackForRoom === room.id && (
                    <tr className="bg-green-600/5">
                      <td className="px-4 py-2">
                        <input
                          className={cn(inputSmCls, "w-28")}
                          value={newRack.name}
                          onChange={(e) => setNewRack({ ...newRack, name: e.target.value })}
                          placeholder="e.g. A01"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={cn(inputSmCls, "w-16")}
                          value={newRack.rowLabel}
                          onChange={(e) => setNewRack({ ...newRack, rowLabel: e.target.value })}
                          placeholder="A"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className={cn(inputSmCls, "w-16")}
                          value={newRack.positionX}
                          onChange={(e) => setNewRack({ ...newRack, positionX: e.target.value })}
                          placeholder="-"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className={cn(inputSmCls, "w-16")}
                          value={newRack.positionY}
                          onChange={(e) => setNewRack({ ...newRack, positionY: e.target.value })}
                          placeholder="-"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className={cn(inputSmCls, "w-16")}
                          value={newRack.totalUnits}
                          onChange={(e) => setNewRack({ ...newRack, totalUnits: parseInt(e.target.value) || 42 })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className={cn(inputSmCls, "w-20")}
                          value={newRack.maxPowerWatts}
                          onChange={(e) => setNewRack({ ...newRack, maxPowerWatts: e.target.value })}
                          placeholder="-"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className={cn(inputSmCls, "w-14")}
                          value={newRack.sortOrder}
                          onChange={(e) => setNewRack({ ...newRack, sortOrder: parseInt(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            onClick={() => createRack(room.id)}
                            disabled={busy || !newRack.name.trim()}
                            className="rounded bg-green-600 p-1 text-white hover:bg-green-500 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setAddingRackForRoom(null)}
                            className="rounded bg-gray-700 p-1 text-gray-300 hover:bg-gray-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add rack button */}
            <div className="border-t border-gray-800 px-4 py-2">
              {addingRackForRoom !== room.id && (
                <button
                  onClick={() => {
                    setAddingRackForRoom(room.id);
                    setNewRack({ name: "", rowLabel: "", sortOrder: room.racks.length, totalUnits: 42, maxPowerWatts: "", positionX: "", positionY: "" });
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-green-400"
                >
                  <Plus className="h-3 w-3" /> {t("rackManage.addRack")}
                </button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
