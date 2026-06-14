export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, canAcknowledgeAlert } from "@/lib/rbac";
import { getActiveMaintenanceWindows, isAlertSuppressed } from "@/lib/alert-suppression";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AlertsPageClient } from "@/components/alerts/alerts-page-client";
import { PageTransition } from "@/components/ui/page-transition";
import { Bell } from "lucide-react";

export default async function AlertsPage() {
  const user = await getSessionUser();
  const canAck = user ? canAcknowledgeAlert(user.role) : false;
  const isAdmin = user?.role === "ADMIN";

  const [rawAlerts, windows] = await Promise.all([
    prisma.alert.findMany({
      include: { rule: true, acknowledgement: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { firedAt: "desc" },
      take: 500,
    }),
    getActiveMaintenanceWindows(),
  ]);
  const alerts = rawAlerts.map((a) => ({
    ...a,
    suppressed: isAlertSuppressed(a, windows),
  }));
  const maintenanceActive = windows.length > 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Bell}
          title="Alerts"
          subtitle="Alert management and history"
          accent="red"
          right={
            <div className="flex items-center gap-2">
              <Link
                href="/alerts/settings"
                className="rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-200 hover:border-blue-500/50 hover:text-blue-300 transition-all"
              >
                Settings
              </Link>
              <Link
                href="/alerts/rules"
                className="rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-200 hover:border-blue-500/50 hover:text-blue-300 transition-all"
              >
                Manage Rules
              </Link>
            </div>
          }
        />

        <Suspense
          fallback={<Card className="p-8 text-center text-gray-500">Loading...</Card>}
        >
          <AlertsPageClient
            alerts={JSON.parse(JSON.stringify(alerts))}
            canAcknowledge={canAck}
            isAdmin={isAdmin}
            maintenanceActive={maintenanceActive}
          />
        </Suspense>
      </div>
    </PageTransition>
  );
}
