export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { DashboardSummaryCards } from "@/components/dashboard/summary-cards";
import { DashboardClusterView } from "@/components/dashboard/dashboard-cluster-view";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import {
  LayoutDashboard,
  ListChecks,
  Bell,
  Server,
  Building2,
  Radar,
  ShieldCheck,
} from "lucide-react";

export default async function DashboardPage() {
  const lab1Where = { ipAddress: { startsWith: "10.144.38." } };
  const lab3Where = { ipAddress: { startsWith: "10.144.131." } };

  const [
    statusBreakdown,
    lab1StatusBreakdown,
    lab3StatusBreakdown,
    maintenanceEquipmentList,
    failedEquipmentList,
    activeEquipmentList,
    totalRacks,
    totalRooms,
    firingAlerts,
    recentAlerts,
    equipmentMapping,
    allEquipmentForPlatform,
    promTargets,
  ] = await Promise.all([
    prisma.equipment.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.equipment.groupBy({
      by: ["status"],
      where: lab1Where,
      _count: true,
    }),
    prisma.equipment.groupBy({
      by: ["status"],
      where: lab3Where,
      _count: true,
    }),
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
    prisma.equipment.findMany({
      where: { ipAddress: { not: null } },
      select: { hostname: true, ipAddress: true },
    }),
    prisma.equipment.findMany({
      where: { type: "SERVER" },
      select: { hostname: true, model: true, status: true },
    }),
    prisma.prometheusTarget.findMany({
      where: { hostname: { not: null } },
      select: { instance: true, hostname: true },
    }),
  ]);

  // ExpiryTracker may not exist if DB migration hasn't run yet
  let expiringItems: { id: string; name: string; expiresAt: Date; category: string; source: string | null }[] = [];
  try {
    expiringItems = await prisma.expiryTracker.findMany({
      where: {
        status: { in: ["ACTIVE", "EXPIRED"] },
        expiresAt: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { expiresAt: "asc" },
      take: 5,
    });
  } catch {
    // table doesn't exist yet — skip
  }

  // Derive counts from groupBy results
  function countFromGroupBy(
    groups: { status: string; _count: number }[],
    statuses: string | string[],
  ): number {
    const arr = Array.isArray(statuses) ? statuses : [statuses];
    return groups
      .filter((g) => arr.includes(g.status))
      .reduce((sum, g) => sum + g._count, 0);
  }

  const totalEquipment = statusBreakdown.reduce((sum, g) => sum + g._count, 0);
  const activeEquipmentCount = countFromGroupBy(statusBreakdown, "ACTIVE");
  const maintenanceCount = countFromGroupBy(statusBreakdown, ["MAINTENANCE", "REPAIR"]);
  const failedCount = countFromGroupBy(statusBreakdown, "FAILED");

  const lab1Active = countFromGroupBy(lab1StatusBreakdown, "ACTIVE");
  const lab1Maintenance = countFromGroupBy(lab1StatusBreakdown, ["MAINTENANCE", "REPAIR"]);
  const lab1Failed = countFromGroupBy(lab1StatusBreakdown, "FAILED");

  const lab3Active = countFromGroupBy(lab3StatusBreakdown, "ACTIVE");
  const lab3Maintenance = countFromGroupBy(lab3StatusBreakdown, ["MAINTENANCE", "REPAIR"]);
  const lab3Failed = countFromGroupBy(lab3StatusBreakdown, "FAILED");

  function detectPlatform(hostname: string | null, model: string | null): string {
    const h = (hostname || "").toLowerCase();
    const m = (model || "").toLowerCase();
    if (m.includes("ampere") || m.includes("altra") || h.includes("ampere")) return "Ampere";
    if (m.includes("srf") || h.includes("srf")) return "SRF";
    if (m.includes("gnr-ap") || m.includes("gnrap") || h.includes("gnrap") || h.match(/s\d+hax/)) return "GNR-AP";
    if (m.includes("gnr-sp") || m.includes("gnrsp") || h.includes("gnrsp") || h.match(/s\d+hx/)) return "GNR-SP";
    if (m.includes("spr") || h.match(/s\d+x13/)) return "SPR";
    if (m.includes("emr")) return "EMR";
    return "Other";
  }

  const platformOrder = ["SPR", "GNR-AP", "GNR-SP", "SRF", "Ampere", "EMR", "Other"];
  const platformCounts: Record<string, { total: number; active: number }> = {};
  platformOrder.forEach((p) => { platformCounts[p] = { total: 0, active: 0 }; });

  allEquipmentForPlatform.forEach((e) => {
    const platform = detectPlatform(e.hostname, e.model);
    if (!platformCounts[platform]) platformCounts[platform] = { total: 0, active: 0 };
    platformCounts[platform].total++;
    if (e.status === "ACTIVE") platformCounts[platform].active++;
  });

  const platformStats = platformOrder
    .filter((p) => platformCounts[p].total > 0)
    .map((p) => ({ platform: p, ...platformCounts[p] }));

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={LayoutDashboard}
          title="Dashboard"
          subtitle="Infrastructure overview and live metrics"
          accent="blue"
        />

        {/* Prometheus Live Metrics + Fleet Overview (with Lab filter) */}
        <DashboardClusterView
          statusCounts={{
            all: { active: activeEquipmentCount, maintenance: maintenanceCount, failed: failedCount },
            lab1: { active: lab1Active, maintenance: lab1Maintenance, failed: lab1Failed },
            lab3: { active: lab3Active, maintenance: lab3Maintenance, failed: lab3Failed },
          }}
          hostnameIpMap={(() => {
            const map: Record<string, string> = {};
            for (const e of equipmentMapping) {
              if (e.hostname && e.ipAddress) {
                map[e.hostname] = e.ipAddress;
                map[e.ipAddress] = e.hostname;
              }
            }
            for (const t of promTargets) {
              const ip = t.instance.replace(/:\d+$/, "");
              if (t.hostname && !map[ip]) {
                map[ip] = t.hostname;
                map[t.hostname] = ip;
              }
            }
            return map;
          })()}
          platformStats={platformStats}
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
          <SectionHeading icon={ListChecks} title="Status Breakdown" accent="cyan" className="mb-3" />
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
              <SectionHeading icon={LayoutDashboard} title="Quick Links" accent="blue" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    href: "/servers",
                    title: "Servers",
                    desc: "Server monitoring & Digital Twin",
                    icon: Server,
                  },
                  {
                    href: "/infrastructure",
                    title: "Infrastructure",
                    desc: "Equipment management",
                    icon: Building2,
                  },
                  {
                    href: "/alerts",
                    title: "Alerts",
                    desc: "Alert management & history",
                    icon: Bell,
                  },
                  {
                    href: "/settings/discovery",
                    title: "Discovery",
                    desc: "Prometheus target sync",
                    icon: Radar,
                  },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-start gap-3 rounded-xl border border-gray-700/50 p-4 transition-all duration-200 hover:border-blue-500/40 hover:bg-blue-600/5 hover:shadow-lg hover:shadow-blue-600/5"
                  >
                    <div className="rounded-lg bg-gray-800/60 p-2 transition-colors group-hover:bg-blue-500/15">
                      <link.icon className="h-4 w-4 text-gray-400 transition-colors group-hover:text-blue-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-200 transition-colors group-hover:text-blue-300">
                        {link.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{link.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          {/* Alerts + Expiry Feed */}
          <div className="space-y-6">
            <Card>
              <SectionHeading
                icon={Bell}
                title="Active Alerts"
                accent={firingAlerts > 0 ? "red" : "green"}
                right={
                  firingAlerts > 0 ? (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400 animate-glow-pulse">
                      {firingAlerts} active
                    </span>
                  ) : undefined
                }
              />
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

            {/* Expiry Widget */}
            {expiringItems.length > 0 && (
              <Card>
                <SectionHeading
                  icon={ShieldCheck}
                  title="만기 임박"
                  accent="amber"
                  right={
                    <Link
                      href="/settings/expiry-tracker"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      전체 보기 →
                    </Link>
                  }
                />
                <div className="space-y-2">
                  {expiringItems.map((item) => {
                    const days = Math.ceil(
                      (new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                    );
                    const isExpired = days < 0;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border-l-2 p-3 ${
                          isExpired || days <= 7
                            ? "border-l-red-500 bg-red-500/5"
                            : "border-l-amber-500 bg-amber-500/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-200">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              {item.source || item.category}
                            </p>
                          </div>
                          <span
                            className={`text-sm font-bold ${
                              isExpired ? "text-red-400" : days <= 7 ? "text-red-400" : "text-amber-400"
                            }`}
                          >
                            {isExpired ? "만료" : `D-${days}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
