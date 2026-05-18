export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardSummaryCards } from "@/components/dashboard/summary-cards";
import { DashboardClusterView } from "@/components/dashboard/dashboard-cluster-view";
import { PageTransition } from "@/components/ui/page-transition";

export default async function DashboardPage() {
  const lab1Where = { ipAddress: { startsWith: "10.144.38." } };
  const lab3Where = { ipAddress: { startsWith: "10.144.131." } };

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
    lab1Active,
    lab1Maintenance,
    lab1Failed,
    lab3Active,
    lab3Maintenance,
    lab3Failed,
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
    prisma.equipment.count({ where: { status: "ACTIVE", ...lab1Where } }),
    prisma.equipment.count({ where: { status: { in: ["MAINTENANCE", "REPAIR"] }, ...lab1Where } }),
    prisma.equipment.count({ where: { status: "FAILED", ...lab1Where } }),
    prisma.equipment.count({ where: { status: "ACTIVE", ...lab3Where } }),
    prisma.equipment.count({ where: { status: { in: ["MAINTENANCE", "REPAIR"] }, ...lab3Where } }),
    prisma.equipment.count({ where: { status: "FAILED", ...lab3Where } }),
  ]);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Infrastructure overview and live metrics
          </p>
        </div>

        {/* Prometheus Live Metrics + Fleet Overview (with Lab filter) */}
        <DashboardClusterView
          statusCounts={{
            all: { active: activeEquipmentCount, maintenance: maintenanceCount, failed: failedCount },
            lab1: { active: lab1Active, maintenance: lab1Maintenance, failed: lab1Failed },
            lab3: { active: lab3Active, maintenance: lab3Maintenance, failed: lab3Failed },
          }}
        />

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
          <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Status Breakdown
          </h3>
          <div className="flex flex-wrap gap-2">
            {statusBreakdown.map((s) => (
              <div
                key={s.status}
                className="flex items-center gap-2 rounded-lg border border-gray-800/60 bg-gray-800/20 px-3 py-2 transition-colors hover:bg-gray-800/40"
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
                <span className="font-mono text-sm font-semibold text-gray-300">
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
              <h2 className="mb-4 text-base font-semibold">Quick Links</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    href: "/servers",
                    title: "Servers",
                    desc: "Server monitoring & Digital Twin",
                  },
                  {
                    href: "/infrastructure",
                    title: "Infrastructure",
                    desc: "Equipment management",
                  },
                  {
                    href: "/alerts",
                    title: "Alerts",
                    desc: "Alert management & history",
                  },
                  {
                    href: "/settings/discovery",
                    title: "Discovery",
                    desc: "Prometheus target sync",
                  },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group rounded-xl border border-gray-700/50 p-4 transition-all duration-200 hover:border-blue-500/40 hover:bg-blue-600/5 hover:shadow-lg hover:shadow-blue-600/5"
                  >
                    <p className="font-medium text-gray-200 group-hover:text-blue-300 transition-colors">
                      {link.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{link.desc}</p>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          {/* Recent Alerts Feed */}
          <div>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Active Alerts</h2>
                {firingAlerts > 0 && (
                  <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400 animate-glow-pulse">
                    {firingAlerts} active
                  </span>
                )}
              </div>
              {recentAlerts.length === 0 ? (
                <div className="rounded-lg bg-green-500/5 border border-green-500/10 px-4 py-6 text-center">
                  <p className="text-sm text-green-400 font-medium">All clear</p>
                  <p className="text-xs text-gray-500 mt-1">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border-l-2 p-3 transition-colors hover:bg-gray-800/30 ${
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
                              ? "bg-red-500 animate-pulse"
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
                            <span className="text-gray-700">·</span>
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
    </PageTransition>
  );
}
