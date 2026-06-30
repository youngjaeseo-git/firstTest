export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { ReportActions } from "@/components/reports/report-actions";
import { TranslatedPageHeader } from "@/components/ui/translated-page-header";
import { FileText } from "lucide-react";

export default async function ReportsPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    equipment,
    rooms,
    alertsTotal,
    alerts30d,
    alerts7d,
    criticalAlerts,
    recentAlerts,
    topRules,
    firedByCategory,
  ] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        status: true,
        type: true,
        manufacturer: true,
        totalMemoryGB: true,
        rackHeight: true,
      },
    }),
    prisma.room.findMany({
      include: { _count: { select: { racks: true } } },
    }),
    prisma.alert.count(),
    prisma.alert.count({ where: { firedAt: { gte: thirtyDaysAgo } } }),
    prisma.alert.count({ where: { firedAt: { gte: sevenDaysAgo } } }),
    prisma.alert.count({
      where: { severity: "CRITICAL", firedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.alert.findMany({
      where: { firedAt: { gte: thirtyDaysAgo } },
      orderBy: { firedAt: "desc" },
      take: 10,
      include: { rule: true },
    }),
    prisma.alert.groupBy({
      by: ["ruleId"],
      where: { ruleId: { not: null }, firedAt: { gte: thirtyDaysAgo } },
      // orderBy._count.ruleId requires ruleId selected in _count; keep _all for rendering.
      _count: { _all: true, ruleId: true },
      orderBy: { _count: { ruleId: "desc" } },
      take: 5,
    }),
    prisma.alert.groupBy({
      by: ["category"],
      where: { firedAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  // Resolve rule names for topRules
  const ruleIds = topRules.map((r) => r.ruleId!).filter(Boolean);
  const rules =
    ruleIds.length > 0
      ? await prisma.alertRule.findMany({
          where: { id: { in: ruleIds } },
          select: { id: true, name: true, severity: true },
        })
      : [];
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  // Status breakdown
  const statusBreakdown = equipment.reduce(
    (acc, eq) => {
      acc[eq.status] = (acc[eq.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Type breakdown
  const typeBreakdown = equipment.reduce(
    (acc, eq) => {
      acc[eq.type] = (acc[eq.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Manufacturer breakdown
  const manufacturerBreakdown = equipment.reduce(
    (acc, eq) => {
      const m = eq.manufacturer || "Unknown";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalMemoryGB = equipment.reduce(
    (s, e) => s + (e.totalMemoryGB || 0),
    0,
  );

  const reportDate = now.toLocaleString("ko-KR");
  const periodStart = thirtyDaysAgo.toLocaleDateString("ko-KR");
  const periodEnd = now.toLocaleDateString("ko-KR");

  // Serialize equipment data for the client component CSV export
  const equipmentData = equipment.map((eq) => ({
    status: eq.status,
    type: eq.type,
    manufacturer: eq.manufacturer,
    totalMemoryGB: eq.totalMemoryGB,
    rackHeight: eq.rackHeight,
  }));

  return (
    <div className="space-y-6">
      <TranslatedPageHeader
        icon={FileText}
        title="Reports"
        subtitleKey="reports.subtitle"
        subtitleSuffix={` · ${reportDate}`}
        accent="amber"
        right={
          <ReportActions
            equipmentData={equipmentData}
            reportDate={reportDate}
            periodStart={periodStart}
            periodEnd={periodEnd}
          />
        }
      />

      {/* Printable report */}
      <div id="report-content" className="space-y-6">
        {/* Print-only header: shown only when printing */}
        <div className="hidden print:block print-report-header">
          <h1 className="text-2xl font-bold text-black">
            DCIM Infrastructure Report
          </h1>
          <div className="mt-2 text-sm text-gray-600">
            <p>
              <span className="font-medium">Report Generated:</span>{" "}
              {reportDate}
            </p>
            <p>
              <span className="font-medium">Data Period:</span> {periodStart} —{" "}
              {periodEnd}
            </p>
            <p>
              <span className="font-medium">Total Equipment:</span>{" "}
              {equipment.length}
            </p>
          </div>
          <hr className="mt-3 border-gray-300" />
        </div>

        {/* Executive Summary */}
        <Card>
          <p className="mb-4 text-lg font-bold">Executive Summary</p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">총 장비</p>
              <p className="text-3xl font-bold text-gray-100 print:text-gray-900">
                {equipment.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">운영중</p>
              <p className="text-3xl font-bold text-green-400 print:text-green-700">
                {statusBreakdown.ACTIVE || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">장애</p>
              <p className="text-3xl font-bold text-red-400 print:text-red-700">
                {statusBreakdown.FAILED || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">총 메모리</p>
              <p className="text-3xl font-bold text-gray-100 print:text-gray-900">
                {totalMemoryGB.toLocaleString()}
                <span className="text-lg text-gray-500 print:text-gray-600"> GB</span>
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 border-t border-gray-800 pt-4 print:border-gray-300 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">Rooms</p>
              <p className="text-xl font-semibold print:text-gray-900">{rooms.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">Racks</p>
              <p className="text-xl font-semibold print:text-gray-900">
                {rooms.reduce((s, r) => s + r._count.racks, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">알림 (30d)</p>
              <p className="text-xl font-semibold print:text-gray-900">{alerts30d}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 print:text-gray-600">Critical (30d)</p>
              <p className="text-xl font-semibold text-red-400 print:text-red-700">
                {criticalAlerts}
              </p>
            </div>
          </div>
        </Card>

        {/* Equipment Breakdown */}
        <Card>
          <p className="mb-4 text-lg font-bold">Equipment Breakdown</p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 print:text-gray-700">
                상태별
              </p>
              <div className="space-y-1">
                {Object.entries(statusBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-400 print:text-gray-600">{status}</span>
                      <span className="font-mono font-medium text-gray-100 print:text-gray-900">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 print:text-gray-700">
                타입별
              </p>
              <div className="space-y-1">
                {Object.entries(typeBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-400 print:text-gray-600">{type}</span>
                      <span className="font-mono font-medium text-gray-100 print:text-gray-900">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 print:text-gray-700">
                제조사별
              </p>
              <div className="space-y-1">
                {Object.entries(manufacturerBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([m, count]) => (
                    <div
                      key={m}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-400 print:text-gray-600">{m}</span>
                      <span className="font-mono font-medium text-gray-100 print:text-gray-900">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Alert Statistics */}
        <Card>
          <p className="mb-4 text-lg font-bold">Alert Statistics (30d)</p>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-800 p-4 print:border-gray-300">
              <p className="text-xs text-gray-400 print:text-gray-600">전체 알림</p>
              <p className="text-2xl font-bold print:text-gray-900">{alertsTotal}</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-4 print:border-gray-300">
              <p className="text-xs text-gray-400 print:text-gray-600">최근 30일</p>
              <p className="text-2xl font-bold print:text-gray-900">{alerts30d}</p>
            </div>
            <div className="rounded-lg border border-gray-800 p-4 print:border-gray-300">
              <p className="text-xs text-gray-400 print:text-gray-600">최근 7일</p>
              <p className="text-2xl font-bold print:text-gray-900">{alerts7d}</p>
            </div>
          </div>

          {/* Category breakdown */}
          {firedByCategory.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-gray-300 print:text-gray-700">
                카테고리별
              </p>
              <div className="flex flex-wrap gap-2">
                {firedByCategory
                  .sort((a, b) => b._count._all - a._count._all)
                  .map((c) => (
                    <Badge
                      key={c.category || "uncategorized"}
                      variant="info"
                    >
                      {c.category || "기타"}: {c._count._all}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Top firing rules */}
          {topRules.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300 print:text-gray-700">
                Top Firing Rules
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs text-gray-400 print:border-gray-300 print:text-gray-600">
                    <th className="px-3 py-2">Rule</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 print:divide-gray-300">
                  {topRules.map((r) => {
                    const rule = ruleMap.get(r.ruleId!);
                    return (
                      <tr key={r.ruleId}>
                        <td className="px-3 py-2 text-gray-100 print:text-gray-900">
                          {rule?.name || "(deleted)"}
                        </td>
                        <td className="px-3 py-2">
                          {rule?.severity && (
                            <SeverityBadge severity={rule.severity} />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r._count._all}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recent alerts */}
        <Card>
          <p className="mb-4 text-lg font-bold">Recent Alerts</p>
          {recentAlerts.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              최근 30일간 알림이 없습니다.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-400 print:border-gray-300 print:text-gray-600">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Summary</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 print:divide-gray-300">
                {recentAlerts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-xs text-gray-400 print:text-gray-600">
                      {a.firedAt.toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-2">
                      <SeverityBadge severity={a.severity} />
                    </td>
                    <td className="px-3 py-2 text-gray-100 print:text-gray-900">{a.summary}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 print:text-gray-600">
                      {a.source || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
