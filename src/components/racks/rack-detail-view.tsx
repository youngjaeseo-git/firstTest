"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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

/* ── Inline Rack Elevation SVG ── */

function RackElevationInline({ rack }: { rack: RackData }) {
  const t = useT();

  const units = Array.from({ length: rack.totalUnits }, (_, i) => {
    const pos = rack.totalUnits - i; // top to bottom
    const eq = rack.equipment.find(
      (e) =>
        e.rackPosition !== null &&
        pos >= e.rackPosition &&
        pos < e.rackPosition + e.rackHeight,
    );
    const isStart = eq?.rackPosition === pos;
    return { position: pos, equipment: eq || null, isStart };
  });

  // Equipment list sorted by position
  const sortedEquipment = [...rack.equipment]
    .filter((e) => e.rackPosition !== null)
    .sort((a, b) => (b.rackPosition ?? 0) - (a.rackPosition ?? 0));

  const unpositioned = rack.equipment.filter((e) => e.rackPosition === null);

  return (
    <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: SVG Rack Elevation */}
        <div className="w-full max-w-sm shrink-0">
          <div className="rounded-lg border-2 border-gray-700 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-xl">
            {/* Rack top bar decoration */}
            <div className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                <div className="h-2 w-2 rounded-full bg-amber-500" />
              </div>
              <span className="font-mono text-[10px] text-gray-500">
                {rack.name} - {rack.totalUnits}U
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
                      title={`${equipment.hostname || equipment.type} - ${equipment.status}${equipment.model ? ` - ${equipment.model}` : ""}${equipment.manufacturer ? ` - ${equipment.manufacturer}` : ""}`}
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
                      {/* Tooltip on hover */}
                      <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-56 rounded-lg border border-gray-700 bg-gray-900 p-3 text-left text-xs shadow-xl group-hover/eq:block">
                        <p className="font-semibold text-gray-100">
                          {equipment.hostname || "(unnamed)"}
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
                          {equipment.ipAddress && (
                            <p>
                              <span className="text-gray-500">IP:</span>{" "}
                              <span className="font-mono text-gray-200">
                                {equipment.ipAddress}
                              </span>
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-[10px] text-blue-400">
                          {t("common.details")} →
                        </p>
                      </div>
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
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {[
              ["ACTIVE", "bg-green-600"],
              ["MAINTENANCE", "bg-purple-600"],
              ["REPAIR", "bg-orange-600"],
              ["FAILED", "bg-red-600"],
              ["PLANNED", "bg-blue-600"],
            ].map(([status, color]) => (
              <div key={status} className="flex items-center gap-1">
                <span className={cn("h-2.5 w-2.5 rounded-sm", color)} />
                <span className="text-gray-500">{status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Equipment Table */}
        <div className="min-w-0 flex-1">
          <h4 className="mb-3 text-sm font-semibold text-gray-300">
            {t("rack.title")} - {rack.equipment.length} {t("capacity.equipment").toLowerCase()}
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
                    <th className="px-2 py-2 font-medium">{t("infra.manufacturer")}</th>
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
                        U{eq.rackPosition}
                        {eq.rackHeight > 1 && (
                          <span className="text-gray-600">
                            -{(eq.rackPosition ?? 0) + eq.rackHeight - 1}
                          </span>
                        )}
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
                      <td className="px-2 py-2 text-gray-400">
                        {eq.manufacturer || "-"}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/servers/${eq.id}`}
                          className="text-blue-400 hover:text-blue-300"
                          title={t("common.details")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t("common.noData")}</p>
          )}

          {unpositioned.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-amber-400">
                Unpositioned ({unpositioned.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {unpositioned.map((eq) => (
                  <Link
                    key={eq.id}
                    href={`/servers/${eq.id}`}
                    className="rounded border border-amber-800/50 bg-amber-900/20 px-2 py-1 text-xs text-amber-300 transition-colors hover:bg-amber-900/40"
                  >
                    {eq.hostname || eq.type}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
  const [expandedRack, setExpandedRack] = useState<string | null>(null);

  const toggleRack = (rackId: string) => {
    setExpandedRack((prev) => (prev === rackId ? null : rackId));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Layers}
        title={t("nav.racks")}
        subtitle={`${t("rack.title")} - ${t("common.total")} ${totalRacks}`}
        accent="purple"
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
                      {/* Rack Card Header -- clickable to expand */}
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
                            {/* Digital Twin link */}
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
                            {/* Expand/Collapse toggle */}
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

                        {/* Utilization bar */}
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

                        {/* Equipment breakdown */}
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

                      {/* Expanded Detail: Rack Elevation + Equipment Table */}
                      {isExpanded && (
                        <div className="border-t border-gray-700 px-4 pb-4">
                          <RackElevationInline rack={rack} />
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
