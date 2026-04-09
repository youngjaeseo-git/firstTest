"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { List, Building2 } from "lucide-react";

interface ServerPageClientProps {
  rooms: Array<{
    id: string;
    name: string;
    racks: Array<{
      id: string;
      name: string;
      rowLabel: string | null;
      sortOrder: number;
      totalUnits: number;
      positionX: number | null;
      positionY: number | null;
      equipment: Array<{
        id: string;
        hostname: string | null;
        ipAddress: string | null;
        status: string;
        rackPosition: number | null;
        rackHeight: number;
        type: string;
      }>;
    }>;
  }>;
  servers: Array<{
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    status: string;
    type: string;
    roomName: string;
    rackName: string;
    rackPosition: number | null;
    totalMemoryGB: number | null;
  }>;
}

export function ServerPageClient({ rooms, servers }: ServerPageClientProps) {
  const [view, setView] = useState<"list" | "twin">("list");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedRack, setSelectedRack] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="text-sm text-gray-400">총 {servers.length}대 서버</p>
        </div>
        <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-1">
          <button
            onClick={() => { setView("list"); setSelectedRoom(null); setSelectedRack(null); }}
            className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", view === "list" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200")}
          >
            <List className="h-4 w-4" /> List
          </button>
          <button
            onClick={() => { setView("twin"); setSelectedRoom(null); setSelectedRack(null); }}
            className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", view === "twin" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200")}
          >
            <Building2 className="h-4 w-4" /> Twin
          </button>
        </div>
      </div>

      {view === "list" ? (
        /* LIST VIEW */
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-gray-400">
                  <th className="px-4 py-3 font-medium">Hostname</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Rack / U</th>
                  <th className="px-4 py-3 font-medium">Memory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {servers.map((s) => (
                  <tr key={s.id} className="text-gray-300 hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <Link href={`/servers/${s.id}`} className="font-medium text-gray-100 hover:text-blue-400">
                        {s.hostname || "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{s.ipAddress || "-"}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">{s.roomName}</td>
                    <td className="px-4 py-3">{s.rackName} / U{s.rackPosition}</td>
                    <td className="px-4 py-3">{s.totalMemoryGB ? `${s.totalMemoryGB} GB` : "-"}</td>
                  </tr>
                ))}
                {servers.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">서버가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : selectedRack ? (
        /* TWIN VIEW - Level 3: Rack Elevation */
        <RackElevation
          rack={rooms.flatMap((r) => r.racks).find((r) => r.id === selectedRack)!}
          onBack={() => setSelectedRack(null)}
        />
      ) : selectedRoom ? (
        /* TWIN VIEW - Level 2: Room Floor Plan */
        <RoomFloorPlan
          room={rooms.find((r) => r.id === selectedRoom)!}
          onSelectRack={setSelectedRack}
          onBack={() => setSelectedRoom(null)}
        />
      ) : (
        /* TWIN VIEW - Level 1: Room Selector */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rooms.map((room) => {
            const totalEq = room.racks.reduce((s, r) => s + r.equipment.length, 0);
            return (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-left transition-colors hover:border-blue-600 hover:bg-gray-800"
              >
                <h3 className="text-xl font-bold text-gray-100">{room.name}</h3>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Racks</p>
                    <p className="text-2xl font-bold text-blue-400">{room.racks.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Servers</p>
                    <p className="text-2xl font-bold text-green-400">{totalEq}</p>
                  </div>
                </div>
              </button>
            );
          })}
          {rooms.length === 0 && (
            <p className="text-gray-500">Room 데이터가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* Level 2: Room Floor Plan */
function RoomFloorPlan({
  room,
  onSelectRack,
  onBack,
}: {
  room: ServerPageClientProps["rooms"][0];
  onSelectRack: (id: string) => void;
  onBack: () => void;
}) {
  const groups = room.racks.reduce(
    (acc, rack) => {
      const label = rack.rowLabel || "Default";
      (acc[label] = acc[label] || []).push(rack);
      return acc;
    },
    {} as Record<string, typeof room.racks>,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <h2 className="text-xl font-bold">{room.name}</h2>
      </div>
      {Object.entries(groups).map(([label, racks]) => (
        <div key={label}>
          <p className="mb-2 text-sm font-medium text-gray-400">Row {label}</p>
          <div className="flex flex-wrap gap-3">
            {racks.map((rack) => {
              const used = rack.equipment.length;
              const active = rack.equipment.filter((e) => e.status === "ACTIVE").length;
              return (
                <button
                  key={rack.id}
                  onClick={() => onSelectRack(rack.id)}
                  className="w-28 rounded-lg border border-gray-700 bg-gray-800 p-3 text-center transition-colors hover:border-blue-500 hover:bg-gray-700"
                >
                  <p className="text-sm font-bold text-gray-100">{rack.name}</p>
                  <div className="mt-2 h-20 rounded border border-gray-700 bg-gray-900 p-1">
                    {/* Mini rack visualization */}
                    <div className="flex h-full flex-col-reverse gap-px">
                      {Array.from({ length: Math.min(rack.totalUnits, 20) }, (_, i) => {
                        const eq = rack.equipment.find(
                          (e) => e.rackPosition === i + 1,
                        );
                        return (
                          <div
                            key={i}
                            className={cn(
                              "h-full min-h-[2px] rounded-sm",
                              eq
                                ? eq.status === "ACTIVE"
                                  ? "bg-green-500"
                                  : eq.status === "FAILED"
                                    ? "bg-red-500"
                                    : "bg-amber-500"
                                : "bg-gray-800",
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {used}/{rack.totalUnits}U · {active} active
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Level 3: Rack Elevation View */
function RackElevation({
  rack,
  onBack,
}: {
  rack: ServerPageClientProps["rooms"][0]["racks"][0];
  onBack: () => void;
}) {
  const units = Array.from({ length: rack.totalUnits }, (_, i) => {
    const pos = rack.totalUnits - i; // top to bottom
    const eq = rack.equipment.find(
      (e) => e.rackPosition !== null && pos >= e.rackPosition && pos < e.rackPosition + e.rackHeight,
    );
    const isStart = eq?.rackPosition === pos;
    return { position: pos, equipment: eq || null, isStart };
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-600/30 border-green-600 text-green-300",
    MAINTENANCE: "bg-purple-600/30 border-purple-600 text-purple-300",
    REPAIR: "bg-orange-600/30 border-orange-600 text-orange-300",
    FAILED: "bg-red-600/30 border-red-600 text-red-300",
    PLANNED: "bg-blue-600/30 border-blue-600 text-blue-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <h2 className="text-xl font-bold">Rack {rack.name}</h2>
        <span className="text-sm text-gray-400">
          ({rack.equipment.length} devices / {rack.totalUnits}U)
        </span>
      </div>

      <div className="flex gap-6">
        {/* Rack SVG */}
        <div className="w-80 rounded-lg border border-gray-700 bg-gray-900 p-2">
          <div className="space-y-px">
            {units.map(({ position, equipment, isStart }) => (
              <div key={position} className="flex items-stretch gap-1">
                <span className="w-8 text-right text-[10px] leading-6 text-gray-500">
                  U{position}
                </span>
                {equipment && isStart ? (
                  <Link
                    href={`/servers/${equipment.id}`}
                    className={cn(
                      "flex flex-1 items-center rounded border px-2 text-xs transition-colors hover:brightness-125",
                      statusColor[equipment.status] || "bg-gray-800 border-gray-700 text-gray-400",
                    )}
                    style={{ height: `${equipment.rackHeight * 24 + (equipment.rackHeight - 1)}px` }}
                  >
                    <span className="truncate">
                      {equipment.hostname || equipment.type}
                    </span>
                  </Link>
                ) : equipment ? (
                  <div className="h-0 flex-1" /> // part of multi-U equipment
                ) : (
                  <div className="flex h-6 flex-1 items-center rounded border border-gray-800 bg-gray-800/30 px-2 text-[10px] text-gray-600">
                    empty
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 text-sm">
          <p className="font-medium text-gray-300">Legend</p>
          {[
            ["ACTIVE", "운영중", "bg-green-600"],
            ["MAINTENANCE", "유지보수", "bg-purple-600"],
            ["REPAIR", "수리중", "bg-orange-600"],
            ["FAILED", "장애", "bg-red-600"],
          ].map(([status, label, color]) => (
            <div key={status} className="flex items-center gap-2">
              <span className={cn("h-3 w-3 rounded", color)} />
              <span className="text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
