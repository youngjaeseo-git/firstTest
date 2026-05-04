"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { List, Building2, Search, GitCompareArrows } from "lucide-react";
import { useT } from "@/lib/i18n/i18n-context";

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
        model?: string | null;
        manufacturer?: string | null;
      }>;
    }>;
  }>;
  servers: Array<{
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    bmcIpAddress: string | null;
    status: string;
    type: string;
    model: string | null;
    manufacturer: string | null;
    cpuManufacturer: string | null;
    cpuModel: string | null;
    roomName: string | null;
    rackName: string | null;
    rackPosition: number | null;
    totalMemoryGB: number | null;
  }>;
}

export function ServerPageClient({ rooms, servers }: ServerPageClientProps) {
  const t = useT();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialRackId = searchParams.get("rack") || null;

  const initialRoomId = initialRackId
    ? rooms.find((r) => r.racks.some((rk) => rk.id === initialRackId))?.id ?? null
    : null;

  const [view, setView] = useState<"list" | "twin">(initialRackId ? "twin" : "list");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(initialRoomId);
  const [selectedRack, setSelectedRack] = useState<string | null>(initialRackId);
  const [query, setQuery] = useState(initialQuery);

  const filteredServers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) =>
      [
        s.hostname,
        s.ipAddress,
        s.bmcIpAddress,
        s.model,
        s.manufacturer,
        s.cpuManufacturer,
        s.cpuModel,
        s.roomName,
        s.rackName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [servers, query]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("servers.title")}</h1>
          <p className="text-sm text-gray-400">
            {filteredServers.length}
            {query && ` / ${servers.length}`} {t("servers.count")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/servers/compare">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4" />
              {t("servers.compare")}
            </Button>
          </Link>
          <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-1">
          <button
            onClick={() => { setView("list"); setSelectedRoom(null); setSelectedRack(null); }}
            className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", view === "list" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200")}
          >
            <List className="h-4 w-4" /> {t("servers.list")}
          </button>
          <button
            onClick={() => { setView("twin"); setSelectedRoom(null); setSelectedRack(null); }}
            className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", view === "twin" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200")}
          >
            <Building2 className="h-4 w-4" /> {t("servers.twin")}
          </button>
          </div>
        </div>
      </div>

      {view === "list" ? (
        /* LIST VIEW */
        <>
          {/* Filter bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("servers.filterPlaceholder")}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 pl-10 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-gray-400">
                    <th className="px-4 py-3 font-medium">Hostname</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                    <th className="px-4 py-3 font-medium">BMC IP</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">CPU</th>
                    <th className="px-4 py-3 font-medium">System Model</th>
                    <th className="px-4 py-3 font-medium">Room</th>
                    <th className="px-4 py-3 font-medium">Rack / U</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredServers.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer text-gray-300 hover:bg-gray-800/50"
                      onClick={() => {
                        window.location.href = `/servers/${s.id}`;
                      }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/servers/${s.id}`}
                          className="font-medium text-gray-100 hover:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.hostname || "-"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {s.ipAddress || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {s.bmcIpAddress || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3">
                        {s.cpuManufacturer ? (
                          <div className="flex flex-col">
                            <span className="text-gray-200">
                              {s.cpuManufacturer}
                            </span>
                            {s.cpuModel && (
                              <span className="text-xs text-gray-500">
                                {s.cpuModel}
                              </span>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.model ? (
                          <span className="rounded bg-blue-600/10 px-2 py-0.5 font-mono text-xs text-blue-300">
                            {s.model}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">{s.roomName || "-"}</td>
                      <td className="px-4 py-3">
                        {s.rackName || t("servers.unassigned")}{s.rackPosition != null ? ` / U${s.rackPosition}` : ""}
                      </td>
                    </tr>
                  ))}
                  {filteredServers.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        {query ? t("servers.noMatch") : t("servers.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : selectedRack ? (
        /* TWIN VIEW - Level 3: Rack Elevation */
        <RackElevation
          rack={rooms.flatMap((r) => r.racks).find((r) => r.id === selectedRack)!}
          roomName={rooms.find((r) => r.id === selectedRoom)?.name || "Room"}
          onBackToRooms={() => { setSelectedRoom(null); setSelectedRack(null); }}
          onBackToRoom={() => setSelectedRack(null)}
          t={t}
        />
      ) : selectedRoom ? (
        /* TWIN VIEW - Level 2: Room Floor Plan */
        <RoomFloorPlan
          room={rooms.find((r) => r.id === selectedRoom)!}
          onSelectRack={setSelectedRack}
          onBackToRooms={() => setSelectedRoom(null)}
          t={t}
        />
      ) : (
        /* TWIN VIEW - Level 1: Room Selector */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rooms.map((room, idx) => {
            const totalEq = room.racks.reduce(
              (s, r) => s + r.equipment.length,
              0,
            );
            const activeEq = room.racks.reduce(
              (s, r) =>
                s + r.equipment.filter((e) => e.status === "ACTIVE").length,
              0,
            );
            const totalUnits = room.racks.reduce(
              (s, r) => s + r.totalUnits,
              0,
            );
            const usedUnits = room.racks.reduce(
              (s, r) =>
                s + r.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0),
              0,
            );
            const util =
              totalUnits > 0
                ? Math.round((usedUnits / totalUnits) * 100)
                : 0;
            const gradient =
              idx % 2 === 0
                ? "from-blue-600/20 via-blue-600/5 to-transparent border-blue-500/40"
                : "from-purple-600/20 via-purple-600/5 to-transparent border-purple-500/40";
            return (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-gradient-to-br p-6 text-left transition-all hover:scale-[1.01] hover:shadow-lg",
                  gradient,
                )}
              >
                <Building2 className="absolute -right-4 -top-4 h-32 w-32 text-white/5" />

                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "rounded-lg p-2",
                        idx % 2 === 0
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-purple-500/20 text-purple-300",
                      )}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">
                      {room.name}
                    </h3>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Racks</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {room.racks.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Servers</p>
                      <p className="text-2xl font-bold text-green-400">
                        {totalEq}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Active</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        {activeEq}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>U Utilization</span>
                      <span>
                        {usedUnits} / {totalUnits}U ({util}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={cn(
                          "h-full transition-all",
                          util > 85
                            ? "bg-red-500"
                            : util > 60
                              ? "bg-amber-500"
                              : "bg-green-500",
                        )}
                        style={{ width: `${Math.min(util, 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-500 group-hover:text-blue-300">
                    {t("twin.clickToFloorPlan")}
                  </p>
                </div>
              </button>
            );
          })}
          {rooms.length === 0 && (
            <p className="text-gray-500">{t("twin.noRoomData")}</p>
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
  onBackToRooms,
  t,
}: {
  room: ServerPageClientProps["rooms"][0];
  onSelectRack: (id: string) => void;
  onBackToRooms: () => void;
  t: (key: string) => string;
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
      <div>
        <Breadcrumb
          items={[
            { label: t("servers.title"), onClick: onBackToRooms },
            { label: room.name },
          ]}
          className="mb-1"
        />
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
                    <div className="flex h-full flex-col-reverse gap-px">
                      {Array.from({ length: Math.min(rack.totalUnits, 20) }, (_, i) => {
                        const eq = rack.equipment.find(
                          (e) => e.rackPosition === i + 1,
                        );
                        return (
                          <div
                            key={i}
                            title={
                              eq
                                ? `U${i + 1}: ${eq.hostname || eq.type} (${eq.status})`
                                : `U${i + 1}: empty`
                            }
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
  roomName,
  onBackToRooms,
  onBackToRoom,
  t,
}: {
  rack: ServerPageClientProps["rooms"][0]["racks"][0];
  roomName: string;
  onBackToRooms: () => void;
  onBackToRoom: () => void;
  t: (key: string) => string;
}) {
  const units = Array.from({ length: rack.totalUnits }, (_, i) => {
    const pos = rack.totalUnits - i;
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

  const legendItems = [
    ["ACTIVE", t("status.active"), "bg-green-600"],
    ["MAINTENANCE", t("status.maintenance"), "bg-purple-600"],
    ["REPAIR", t("status.repair"), "bg-orange-600"],
    ["FAILED", t("status.failed"), "bg-red-600"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <Breadcrumb
          items={[
            { label: t("servers.title"), onClick: onBackToRooms },
            { label: roomName, onClick: onBackToRoom },
            { label: rack.name },
          ]}
          className="mb-1"
        />
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Rack {rack.name}</h2>
          <span className="text-sm text-gray-400">
            ({rack.equipment.length} devices / {rack.totalUnits}U)
          </span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Rack SVG */}
        <div className="w-96 rounded-lg border-2 border-gray-700 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
              <div className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <span className="font-mono text-[10px] text-gray-500">
              {rack.name}
            </span>
          </div>
          <div className="space-y-px">
            {units.map(({ position, equipment, isStart }) => (
              <div key={position} className="flex items-stretch gap-1">
                <span className="w-8 text-right text-[10px] leading-6 text-gray-500">
                  U{position}
                </span>
                {equipment && isStart ? (
                  <Link
                    href={`/servers/${equipment.id}`}
                    title={`${equipment.hostname || equipment.type} · ${equipment.status}${equipment.model ? ` · ${equipment.model}` : ""}${equipment.manufacturer ? ` · ${equipment.manufacturer}` : ""}`}
                    className={cn(
                      "group/eq relative flex flex-1 items-center rounded border-2 px-2 text-xs transition-all hover:brightness-125 hover:shadow-lg",
                      statusColor[equipment.status] ||
                        "bg-gray-800 border-gray-700 text-gray-400",
                    )}
                    style={{
                      height: `${equipment.rackHeight * 24 + (equipment.rackHeight - 1)}px`,
                    }}
                  >
                    <span className="truncate font-mono">
                      {equipment.hostname || equipment.type}
                    </span>
                    <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-56 rounded-lg border border-gray-700 bg-gray-900 p-3 text-left text-xs shadow-xl group-hover/eq:block">
                      <p className="font-semibold text-gray-100">
                        {equipment.hostname || t("common.unnamed")}
                      </p>
                      <div className="mt-1 space-y-0.5 text-gray-400">
                        <p>
                          <span className="text-gray-500">Status:</span>{" "}
                          <span className="text-gray-200">
                            {equipment.status}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-500">Type:</span>{" "}
                          <span className="text-gray-200">
                            {equipment.type}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-500">Position:</span>{" "}
                          <span className="font-mono text-gray-200">
                            U{equipment.rackPosition} ({equipment.rackHeight}U)
                          </span>
                        </p>
                        {equipment.model && (
                          <p>
                            <span className="text-gray-500">Model:</span>{" "}
                            <span className="font-mono text-blue-300">
                              {equipment.model}
                            </span>
                          </p>
                        )}
                        {equipment.manufacturer && (
                          <p>
                            <span className="text-gray-500">Mfr:</span>{" "}
                            <span className="text-gray-200">
                              {equipment.manufacturer}
                            </span>
                          </p>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] text-blue-400">
                        {t("twin.clickToDetail")}
                      </p>
                    </div>
                  </Link>
                ) : equipment ? (
                  <div className="h-0 flex-1" />
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
          {legendItems.map(([status, label, color]) => (
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
