export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const [
    totalEquipment,
    activeEquipment,
    maintenanceEquipment,
    failedEquipment,
    totalRacks,
    totalRooms,
    firingAlerts,
    recentAlerts,
  ] = await Promise.all([
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: "ACTIVE" } }),
    prisma.equipment.count({
      where: { status: { in: ["MAINTENANCE", "REPAIR"] } },
    }),
    prisma.equipment.count({ where: { status: "FAILED" } }),
    prisma.rack.count(),
    prisma.room.count(),
    prisma.alert.count({ where: { status: "FIRING" } }),
    prisma.alert.findMany({
      where: { status: "FIRING" },
      orderBy: { firedAt: "desc" },
      take: 5,
    }),
  ]);

  const statusBreakdown = await prisma.equipment.groupBy({
    by: ["status"],
    _count: true,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">Total Equipment</h3>
            <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
            </svg>
          </div>
          <p className="mt-2 text-3xl font-bold">
            {activeEquipment}
            <span className="text-lg text-gray-500">/{totalEquipment}</span>
          </p>
          <div className="mt-3 flex gap-3 text-xs">
            <span className="text-green-400">{activeEquipment} Active</span>
            <span className="text-amber-400">{maintenanceEquipment} Maint.</span>
            <span className="text-red-400">{failedEquipment} Failed</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">Infrastructure</h3>
          </div>
          <p className="mt-2 text-3xl font-bold">{totalRacks}</p>
          <p className="mt-1 text-sm text-gray-500">
            Racks across {totalRooms} rooms
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">Active Alerts</h3>
          </div>
          <p className="mt-2 text-3xl font-bold text-red-400">{firingAlerts}</p>
          <Link href="/alerts" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">
            View all alerts →
          </Link>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">Status Breakdown</h3>
          </div>
          <div className="mt-3 space-y-1">
            {statusBreakdown.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-xs">
                <Badge
                  variant={
                    s.status === "ACTIVE"
                      ? "active"
                      : s.status === "FAILED"
                        ? "critical"
                        : s.status === "MAINTENANCE" || s.status === "REPAIR"
                          ? "maintenance"
                          : "info"
                  }
                >
                  {s.status}
                </Badge>
                <span className="font-mono text-gray-300">{s._count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Quick Links</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/servers" className="rounded-lg border border-gray-700 p-4 hover:border-blue-600 hover:bg-blue-600/5 transition-colors">
                <p className="font-medium">Servers</p>
                <p className="mt-1 text-xs text-gray-400">Server monitoring & Digital Twin</p>
              </Link>
              <Link href="/infrastructure" className="rounded-lg border border-gray-700 p-4 hover:border-blue-600 hover:bg-blue-600/5 transition-colors">
                <p className="font-medium">Infrastructure</p>
                <p className="mt-1 text-xs text-gray-400">Equipment management</p>
              </Link>
              <Link href="/alerts" className="rounded-lg border border-gray-700 p-4 hover:border-blue-600 hover:bg-blue-600/5 transition-colors">
                <p className="font-medium">Alerts</p>
                <p className="mt-1 text-xs text-gray-400">Alert management & history</p>
              </Link>
              <Link href="/settings/discovery" className="rounded-lg border border-gray-700 p-4 hover:border-blue-600 hover:bg-blue-600/5 transition-colors">
                <p className="font-medium">Discovery</p>
                <p className="mt-1 text-xs text-gray-400">Prometheus target sync</p>
              </Link>
            </div>
          </Card>
        </div>

        {/* Recent Alerts Feed */}
        <div>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active Alerts</h2>
              {firingAlerts > 0 && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                  {firingAlerts} active
                </span>
              )}
            </div>
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-gray-500">No active alerts</p>
            ) : (
              <div className="space-y-2">
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-r-lg border-l-2 p-3 ${
                      alert.severity === "CRITICAL"
                        ? "border-l-red-500 bg-red-500/5"
                        : alert.severity === "WARNING"
                          ? "border-l-amber-500 bg-amber-500/5"
                          : "border-l-blue-500 bg-blue-500/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                          alert.severity === "CRITICAL"
                            ? "bg-red-500"
                            : alert.severity === "WARNING"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-200">
                          {alert.summary}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span>{alert.source || "-"}</span>
                          <span>-</span>
                          <span>
                            {new Date(alert.firedAt).toLocaleString("ko-KR")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
