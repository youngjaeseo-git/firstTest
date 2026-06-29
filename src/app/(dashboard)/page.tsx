export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { DashboardClusterView } from "@/components/dashboard/dashboard-cluster-view";
import { FilesystemWarnings } from "@/components/dashboard/filesystem-warnings";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import {
  LayoutDashboard,
  Bell,
  Server,
  Building2,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { buildHostnameIpMapFromData } from "@/lib/hostname-resolver";

export default async function DashboardPage() {
  const lab1Where = { ipAddress: { startsWith: "10.144.38." } };
  const lab3Where = { ipAddress: { startsWith: "10.144.131." } };
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let statusBreakdown: { status: string; _count: number }[] = [];
  let lab1StatusBreakdown: { status: string; _count: number }[] = [];
  let lab3StatusBreakdown: { status: string; _count: number }[] = [];
  let totalRacks = 0;
  let totalRooms = 0;
  let firingAlerts = 0;
  let recentAlerts: { id: string; severity: string; summary: string; source: string | null; firedAt: Date; status: string }[] = [];
  let equipmentMapping: { id: string; hostname: string | null; ipAddress: string | null }[] = [];
  let allEquipmentForPlatform: { hostname: string | null; model: string | null; status: string }[] = [];
  let promTargets: { instance: string; hostname: string | null }[] = [];
  let alerts24hBySeverity: { severity: string; _count: number }[] = [];
  let firingBySeverity: { severity: string; _count: number }[] = [];

  try {
    [
      statusBreakdown,
      lab1StatusBreakdown,
      lab3StatusBreakdown,
      totalRacks,
      totalRooms,
      firingAlerts,
      recentAlerts,
      equipmentMapping,
      allEquipmentForPlatform,
      promTargets,
      alerts24hBySeverity,
      firingBySeverity,
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
        select: { id: true, hostname: true, ipAddress: true },
      }),
      prisma.equipment.findMany({
        where: { type: "SERVER" },
        select: { hostname: true, model: true, status: true },
      }),
      prisma.prometheusTarget.findMany({
        where: { hostname: { not: null } },
        select: { instance: true, hostname: true },
      }),
      prisma.alert.groupBy({
        by: ["severity"],
        where: { firedAt: { gte: since24h } },
        _count: true,
      }),
      prisma.alert.groupBy({
        by: ["severity"],
        where: { status: "FIRING" },
        _count: true,
      }),
    ]) as [typeof statusBreakdown, typeof lab1StatusBreakdown, typeof lab3StatusBreakdown, typeof totalRacks, typeof totalRooms, typeof firingAlerts, typeof recentAlerts, typeof equipmentMapping, typeof allEquipmentForPlatform, typeof promTargets, typeof alerts24hBySeverity, typeof firingBySeverity];
  } catch (err) {
    console.error("Dashboard data fetch failed:", err);
  }

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

  // Alert activity (last 24h fired + currently firing), broken down by severity
  function severityCount(
    groups: { severity: string; _count: number }[],
    severity: string,
  ): number {
    return groups.find((g) => g.severity === severity)?._count ?? 0;
  }
  const alertSeverityStats = (["CRITICAL", "WARNING", "INFO"] as const).map((sev) => ({
    severity: sev,
    fired24h: severityCount(alerts24hBySeverity, sev),
    firingNow: severityCount(firingBySeverity, sev),
  }));
  const totalFiringNow = alertSeverityStats.reduce((s, a) => s + a.firingNow, 0);
  const criticalFiringNow =
    alertSeverityStats.find((a) => a.severity === "CRITICAL")?.firingNow ?? 0;

  const hostnameIpMap = buildHostnameIpMapFromData(equipmentMapping, promTargets);

  // IP → {hostname, id} for the Filesystem Warnings widget:
  // shows hostname (not raw IP) and links to /servers/{id} (route resolves by id, not hostname)
  const fsServerMap: Record<string, { hostname: string; id: string }> = {};
  for (const e of equipmentMapping) {
    if (e.ipAddress && e.hostname) {
      fsServerMap[e.ipAddress] = { hostname: e.hostname, id: e.id };
    }
  }

  return (
    <PageTransition>
      <div className="flex gap-6">
        {/* ─── Main Content Area ─── */}
        <div className="min-w-0 flex-1 space-y-6">
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
            hostnameIpMap={hostnameIpMap}
            platformStats={platformStats}
            totalRacks={totalRacks}
            totalRooms={totalRooms}
          />

          {/* Filesystem Capacity Warnings (>70%) */}
          <FilesystemWarnings serverMap={fsServerMap} />

          {/* Active Alerts */}
          <div>
            <Card>
              <SectionHeading
                icon={Bell}
                title="Active Alerts"
                accent={criticalFiringNow > 0 ? "red" : totalFiringNow > 0 ? "amber" : "green"}
                right={
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${totalFiringNow > 0 ? "text-red-400" : "text-green-400"}`}>
                      {totalFiringNow}
                    </span>
                    <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300">
                      View all →
                    </Link>
                  </div>
                }
              />
              <div className="grid grid-cols-3 gap-3">
                {alertSeverityStats.map((a) => {
                  const tone =
                    a.severity === "CRITICAL"
                      ? { text: "text-red-400", dot: "bg-red-500", border: "border-l-red-500" }
                      : a.severity === "WARNING"
                        ? { text: "text-amber-400", dot: "bg-amber-500", border: "border-l-amber-500" }
                        : { text: "text-blue-400", dot: "bg-blue-500", border: "border-l-blue-500" };
                  return (
                    <div
                      key={a.severity}
                      className={`rounded-lg border border-gray-800/60 border-l-2 ${tone.border} bg-gray-800/20 p-3`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                          {a.severity}
                        </span>
                      </div>
                      <p className={`mt-2 text-2xl font-bold ${a.firingNow > 0 ? tone.text : "text-gray-500"}`}>
                        {a.firingNow}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {a.fired24h} fired · 24h
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Quick Links */}
          <Card>
            <SectionHeading icon={LayoutDashboard} title="Quick Links" accent="blue" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { href: "/servers", title: "Servers", desc: "Server monitoring", icon: Server },
                { href: "/infrastructure", title: "Infrastructure", desc: "Equipment management", icon: Building2 },
                { href: "/alerts", title: "Alerts", desc: "Alert management", icon: Bell },
                { href: "/settings/discovery", title: "Discovery", desc: "Prometheus sync", icon: Radar },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-start gap-3 rounded-xl border border-gray-700/50 p-3 transition-all duration-200 hover:border-blue-500/40 hover:bg-blue-600/5"
                >
                  <div className="rounded-lg bg-gray-800/60 p-2 transition-colors group-hover:bg-blue-500/15">
                    <link.icon className="h-4 w-4 text-gray-400 transition-colors group-hover:text-blue-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-200 text-sm">{link.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ─── Right Sidebar: Active Alerts + Expiry ─── */}
        <div className="hidden xl:block w-80 flex-shrink-0 space-y-4">
          <Card className="sticky top-20">
            <SectionHeading
              icon={Bell}
              title="Active Alerts"
              accent={firingAlerts > 0 ? "red" : "green"}
              right={
                <Link href="/alerts" className="text-xs text-blue-400 hover:text-blue-300">
                  History →
                </Link>
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
                    className={`rounded-lg border-l-2 p-2.5 transition-colors hover:bg-gray-800/30 ${
                      alert.severity === "CRITICAL"
                        ? "border-l-red-500 bg-red-500/5"
                        : alert.severity === "WARNING"
                          ? "border-l-amber-500 bg-amber-500/5"
                          : "border-l-blue-500 bg-blue-500/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                          alert.severity === "CRITICAL"
                            ? "bg-red-500 animate-pulse"
                            : alert.severity === "WARNING"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-200 leading-tight">
                          {alert.summary}
                        </p>
                        <p className="mt-1 text-[10px] text-gray-500">
                          {alert.source || "-"} · {new Date(alert.firedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {expiringItems.length > 0 && (
            <Card>
              <SectionHeading
                icon={ShieldCheck}
                title="Expiring Soon"
                accent="amber"
                right={
                  <Link href="/settings/expiry-tracker" className="text-xs text-blue-400 hover:text-blue-300">
                    View all →
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
                      className={`rounded-lg border-l-2 p-2.5 ${
                        isExpired || days <= 7
                          ? "border-l-red-500 bg-red-500/5"
                          : "border-l-amber-500 bg-amber-500/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-200">{item.name}</p>
                          <p className="text-[10px] text-gray-500">{item.source || item.category}</p>
                        </div>
                        <span
                          className={`text-xs font-bold ${
                            isExpired ? "text-red-400" : days <= 7 ? "text-red-400" : "text-amber-400"
                          }`}
                        >
                          {isExpired ? "Expired" : `D-${days}`}
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
    </PageTransition>
  );
}
