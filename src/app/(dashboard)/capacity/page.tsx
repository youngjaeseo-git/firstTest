export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { LiveCapacityMetrics } from "@/components/capacity/live-capacity-metrics";
import { CapacityForecast } from "@/components/capacity/capacity-forecast";
import { TranslatedPageHeader } from "@/components/ui/translated-page-header";
import { BarChart3 } from "lucide-react";

export default async function CapacityPage() {
  let data;
  try {
    data = await Promise.all([
      prisma.room.findMany({
        include: {
          racks: {
            include: {
              equipment: {
                select: {
                  id: true,
                  rackPosition: true,
                  rackHeight: true,
                  status: true,
                  totalMemoryGB: true,
                  cpus: { select: { tdpWatts: true } },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.equipment.findMany({
        select: {
          status: true,
          rackHeight: true,
          totalMemoryGB: true,
          cpus: { select: { cores: true, tdpWatts: true } },
        },
      }),
    ]);
  } catch (err) {
    // DB schema drift (e.g. migrations not applied after a DB restore) would
    // otherwise crash the whole page into the error boundary. Degrade instead.
    console.error("Capacity page DB query failed:", err);
    return (
      <div className="space-y-6">
        <TranslatedPageHeader
          icon={BarChart3}
          title="Capacity Planning"
          subtitleKey="capacity.subtitle"
          accent="amber"
        />
        <Card>
          <EmptyState message="용량 데이터를 불러오지 못했습니다. 서버 DB 스키마 동기화가 필요할 수 있습니다 (prisma db push)." />
        </Card>
      </div>
    );
  }
  const [rooms, equipment] = data;

  // Global totals
  const totalEquipment = equipment.length;
  const activeEquipment = equipment.filter((e) => e.status === "ACTIVE").length;
  const totalMemoryGB = equipment.reduce(
    (sum, e) => sum + (e.totalMemoryGB || 0),
    0,
  );
  const totalCores = equipment.reduce(
    (sum, e) => sum + e.cpus.reduce((s, c) => s + (c.cores || 0), 0),
    0,
  );
  const totalTdpWatts = equipment.reduce(
    (sum, e) => sum + e.cpus.reduce((s, c) => s + (c.tdpWatts || 0), 0),
    0,
  );

  // Rack utilization
  const allRacks = rooms.flatMap((r) =>
    r.racks.map((rack) => ({
      roomName: r.name,
      ...rack,
    })),
  );
  const totalUnits = allRacks.reduce((s, r) => s + r.totalUnits, 0);
  const usedUnits = allRacks.reduce(
    (s, r) =>
      s +
      r.equipment.reduce((sum, eq) => sum + (eq.rackHeight || 1), 0),
    0,
  );
  const utilizationPct =
    totalUnits > 0 ? (usedUnits / totalUnits) * 100 : 0;

  const maxPowerWatts = allRacks.reduce(
    (s, r) => s + (r.maxPowerWatts || 0),
    0,
  );
  const estimatedPowerPct =
    maxPowerWatts > 0 ? (totalTdpWatts / maxPowerWatts) * 100 : 0;

  // Per-rack breakdown
  const rackDetails = allRacks
    .map((rack) => {
      const usedU = rack.equipment.reduce(
        (s, e) => s + (e.rackHeight || 1),
        0,
      );
      const rackTdp = rack.equipment.reduce(
        (s, e) =>
          s + e.cpus.reduce((sum, c) => sum + (c.tdpWatts || 0), 0),
        0,
      );
      const util = (usedU / rack.totalUnits) * 100;
      const powerUtil = rack.maxPowerWatts
        ? (rackTdp / rack.maxPowerWatts) * 100
        : null;
      return {
        id: rack.id,
        name: rack.name,
        roomName: rack.roomName,
        rowLabel: rack.rowLabel,
        usedU,
        totalU: rack.totalUnits,
        util,
        equipmentCount: rack.equipment.length,
        rackTdp,
        maxPower: rack.maxPowerWatts,
        powerUtil,
      };
    })
    .sort((a, b) => b.util - a.util);

  const formatWatts = (w: number) => {
    if (w >= 1000) return `${(w / 1000).toFixed(1)} kW`;
    return `${w} W`;
  };

  const utilColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 75) return "bg-amber-500";
    if (pct >= 50) return "bg-blue-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-6">
      <TranslatedPageHeader
        icon={BarChart3}
        title="Capacity Planning"
        subtitleKey="capacity.subtitle"
        accent="amber"
      />

      {/* Live Prometheus metrics */}
      <LiveCapacityMetrics />

      {/* Long-term capacity forecast */}
      <CapacityForecast />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-gray-400">Total Equipment</p>
          <p className="mt-1 text-3xl font-bold text-gray-100">
            {totalEquipment}
          </p>
          <p className="mt-1 text-xs text-green-400">
            {activeEquipment} active
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Rack Space</p>
          <p className="mt-1 text-3xl font-bold text-gray-100">
            {usedUnits}
            <span className="text-lg text-gray-500"> / {totalUnits} U</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {utilizationPct.toFixed(1)}% 사용중
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Total Memory</p>
          <p className="mt-1 text-3xl font-bold text-gray-100">
            {totalMemoryGB.toLocaleString()}
            <span className="text-lg text-gray-500"> GB</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {totalCores.toLocaleString()} CPU cores
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Est. TDP</p>
          <p className="mt-1 text-3xl font-bold text-gray-100">
            {formatWatts(totalTdpWatts)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {maxPowerWatts > 0
              ? `${estimatedPowerPct.toFixed(1)}% of ${formatWatts(maxPowerWatts)}`
              : "max 미설정"}
          </p>
        </Card>
      </div>

      {/* Per-room summary */}
      <Card>
        <p className="mb-4 font-medium">Room 별 사용량</p>
        <div className="space-y-4">
          {rooms.map((room) => {
            const roomU = room.racks.reduce((s, r) => s + r.totalUnits, 0);
            const roomUsedU = room.racks.reduce(
              (s, r) =>
                s +
                r.equipment.reduce(
                  (sum, eq) => sum + (eq.rackHeight || 1),
                  0,
                ),
              0,
            );
            const roomPct = roomU > 0 ? (roomUsedU / roomU) * 100 : 0;
            const roomEquipment = room.racks.reduce(
              (s, r) => s + r.equipment.length,
              0,
            );
            return (
              <div key={room.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-100">
                      {room.name}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {room.racks.length} racks · {roomEquipment} equipment
                    </span>
                  </div>
                  <span className="font-mono text-xs text-gray-400">
                    {roomUsedU}/{roomU} U ({roomPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div
                    className={`h-full ${utilColor(roomPct)}`}
                    style={{ width: `${Math.min(roomPct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {rooms.length === 0 && <EmptyState icon={false} className="py-2" />}
        </div>
      </Card>

      {/* Rack detail table */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-gray-800 px-6 py-4">
          <p className="font-medium">Rack 별 상세</p>
          <p className="mt-1 text-xs text-gray-500">
            사용률이 높은 순서대로 정렬됨
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs text-gray-400">
                <th className="px-4 py-2 font-medium">Room</th>
                <th className="px-4 py-2 font-medium">Rack</th>
                <th className="px-4 py-2 font-medium">Row</th>
                <th className="px-4 py-2 font-medium">장비 수</th>
                <th className="px-4 py-2 font-medium">U 사용률</th>
                <th className="px-4 py-2 font-medium">전력 사용률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rackDetails.map((rack) => (
                <tr key={rack.id} className="text-gray-300">
                  <td className="px-4 py-2 text-xs">{rack.roomName}</td>
                  <td className="px-4 py-2 font-medium text-gray-100">
                    {rack.name}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {rack.rowLabel || "-"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {rack.equipmentCount}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-800">
                        <div
                          className={`h-full ${utilColor(rack.util)}`}
                          style={{ width: `${Math.min(rack.util, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs">
                        {rack.usedU}/{rack.totalU}U
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {rack.maxPower && rack.powerUtil !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className={`h-full ${utilColor(rack.powerUtil)}`}
                            style={{
                              width: `${Math.min(rack.powerUtil, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono">
                          {formatWatts(rack.rackTdp)}/
                          {formatWatts(rack.maxPower)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {rackDetails.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState icon={false} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Warnings / recommendations */}
      {rackDetails.some((r) => r.util >= 90) && (
        <Card>
          <div className="flex items-start gap-3">
            <Badge variant="warning">주의</Badge>
            <div className="flex-1">
              <p className="font-medium text-gray-100">
                포화 상태의 랙이 있습니다
              </p>
              <p className="mt-1 text-sm text-gray-400">
                다음 랙은 사용률 90% 이상입니다. 추가 장비 배치 전 여유 공간을
                확보하거나 재배치를 검토하세요.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-300">
                {rackDetails
                  .filter((r) => r.util >= 90)
                  .map((r) => (
                    <li key={r.id} className="font-mono text-xs">
                      • {r.roomName} / {r.name} — {r.usedU}/{r.totalU}U (
                      {r.util.toFixed(1)}%)
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
