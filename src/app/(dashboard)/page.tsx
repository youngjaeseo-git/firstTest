export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardSummaryCards } from "@/components/dashboard/summary-cards";
import { PrometheusMetrics } from "@/components/dashboard/prometheus-metrics";

export default async function DashboardPage() {
  const [
    totalEquipment,
    activeEquipmentCount,
    maintenanceCount,
    failedCount,
    maintenanceEquipmentList,
    failedEquipmentList,
    activeEquipmentList,
    totalRacks,
    totalRooms,
    firingAlerts,
    recentAlerts,
    statusBreakdown,
  ] = await Promise.all([
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: "ACTIVE" } }),
    prisma.equipment.count({
      where: { status: { in: ["MAINTENANCE", "REPAIR"] } },
    }),
    prisma.equipment.count({ where: { status: "FAILED" } }),
    prisma.equipment.findMany({
      where: { status: { in: ["MAINTENANCE", "REPAIR"] } },
      select: {
        id: true,
        hostname: true,
        status: true,
        ipAddress: true,
      },
      take: 10,
    }),
    prisma.equipment.findMany({
      where: { status: "FAILED" },
      select: {
        id: true,
        hostname: true,
        status: true,
        ipAddress: true,
      },
      take: 10,
    }),
    prisma.equipment.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        hostname: true,
        status: true,
        ipAddress: true,
      },
      take: 10,
    }),
    prisma.rack.count(),
    prisma.room.count(),
    prisma.alert.count({ where: { status: "FIRING" } }),
    prisma.alert.findMany({
      where: { status: "FIRING" },
      orderBy: { firedAt: "desc" },
      take: 5,
    }),
    prisma.equipment.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Prometheus Live Metrics */}
      <PrometheusMetrics />

      {/* Summary Cards with hover overlay */}
      <DashboardSummaryCards
        totalEquipment={totalEquipment}
        activeCount={activeEquipmentCount}
        activeList={activeEquipmentList}
        maintenanceCount={maintenanceCount}
        maintenanceList={maintenanceEquipmentList}
        failedCount={failedCount}
        failedList={failedEquipmentList}
        totalRacks={totalRacks}
        totalRooms={totalRooms}
        firingAlerts={firingAlerts}
      />

      {/* Status Breakdown Card */}
      <Card>
        <h3 className="mb-3 text-sm font-medium text-gray-400">
          Status Breakdown
        </h3>
        <div className="flex flex-wrap gap-2">
          {statusBreakdown.map((s) => (
            <div
              key={s.status}
              className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2"
            >
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
              <span className="font-mono text-sm text-gray-300">
                {s._count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Quick Links</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/servers"
                className="rounded-lg border border-gray-700 p-4 transition-colors hover:border-blue-600 hover:bg-blue-600/5"
              >
                <p className="font-medium">Servers</p>
                <p className="mt-1 text-xs text-gray-400">
                  Server monitoring & Digital Twin
                </p>
              </Link>
              <Link
                href="/infrastructure"
                className="rounded-lg border border-gray-700 p-4 transition-colors hover:border-blue-600 hover:bg-blue-600/5"
              >
                <p className="font-medium">Infrastructure</p>
                <p className="mt-1 text-xs text-gray-400">Equipment management</p>
              </Link>
              <Link
                href="/alerts"
                className="rounded-lg border border-gray-700 p-4 transition-colors hover:border-blue-600 hover:bg-blue-600/5"
              >
                <p className="font-medium">Alerts</p>
                <p className="mt-1 text-xs text-gray-400">
                  Alert management & history
                </p>
              </Link>
              <Link
                href="/settings/discovery"
                className="rounded-lg border border-gray-700 p-4 transition-colors hover:border-blue-600 hover:bg-blue-600/5"
              >
                <p className="font-medium">Discovery</p>
                <p className="mt-1 text-xs text-gray-400">
                  Prometheus target sync
                </p>
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
