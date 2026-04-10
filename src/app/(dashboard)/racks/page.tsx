export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardDrive, Building2, Server } from "lucide-react";

export default async function RacksPage() {
  const racks = await prisma.rack.findMany({
    include: {
      room: true,
      equipment: {
        select: {
          id: true,
          status: true,
          rackHeight: true,
          type: true,
        },
      },
      pdus: true,
    },
    orderBy: [{ room: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  // Group by room
  const byRoom = racks.reduce(
    (acc, rack) => {
      const key = rack.room.id;
      if (!acc[key]) {
        acc[key] = { roomName: rack.room.name, racks: [] as typeof racks };
      }
      acc[key].racks.push(rack);
      return acc;
    },
    {} as Record<string, { roomName: string; racks: typeof racks }>,
  );

  const totalRacks = racks.length;
  const totalEquipment = racks.reduce((s, r) => s + r.equipment.length, 0);
  const totalUnits = racks.reduce((s, r) => s + r.totalUnits, 0);
  const usedUnits = racks.reduce(
    (s, r) =>
      s + r.equipment.reduce((u, e) => u + (e.rackHeight || 1), 0),
    0,
  );
  const utilization =
    totalUnits > 0 ? Math.round((usedUnits / totalUnits) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Racks</h1>
        <p className="text-sm text-gray-400">
          랙 목록 및 사용률 — 전체 {totalRacks}개 랙
        </p>
      </div>

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
          <p className="mt-1 text-2xl font-bold">
            {Object.keys(byRoom).length}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Equipment</p>
            <Server className="h-4 w-4 text-green-400" />
          </div>
          <p className="mt-1 text-2xl font-bold">{totalEquipment}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">U Utilization</p>
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
      {Object.entries(byRoom).length === 0 ? (
        <Card className="p-12 text-center text-gray-500">
          등록된 랙이 없습니다.
        </Card>
      ) : (
        Object.entries(byRoom).map(([roomId, { roomName, racks: roomRacks }]) => (
          <div key={roomId}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-200">
              <Building2 className="h-5 w-5 text-blue-400" />
              {roomName}
              <Badge>{roomRacks.length} racks</Badge>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {roomRacks.map((rack) => {
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
                return (
                  <Link
                    key={rack.id}
                    href={`/servers?rack=${rack.id}`}
                    className="block"
                  >
                    <Card className="h-full p-4 transition-colors hover:border-blue-600 hover:bg-blue-600/5">
                      <div className="flex items-start justify-between">
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
                        <HardDrive className="h-4 w-4 text-gray-500" />
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
                            className={`h-full transition-all ${
                              pct > 85
                                ? "bg-red-500"
                                : pct > 60
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
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
                            ● {active} active
                          </span>
                        )}
                        {failed > 0 && (
                          <span className="text-red-400">● {failed} failed</span>
                        )}
                      </div>

                      {rack.maxPowerWatts && (
                        <p className="mt-2 text-xs text-gray-500">
                          Max {(rack.maxPowerWatts / 1000).toFixed(1)} kW
                        </p>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
