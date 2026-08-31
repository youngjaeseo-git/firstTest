export const dynamic = "force-dynamic";

import Link from "next/link";
import { getSessionUser } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { AlertSettingsClient } from "@/components/alerts/alert-settings-client";
import { SlidersHorizontal } from "lucide-react";

export default async function AlertSettingsPage() {
  const user = await getSessionUser();
  const isAdmin = user?.role === "ADMIN";
  const canEditMaintenance = user?.role === "ADMIN" || user?.role === "OPERATOR";

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={SlidersHorizontal}
          title="Alert Settings"
          subtitle="Notification channels, escalation policies, and maintenance windows"
          accent="violet"
          right={
            <Link
              href="/alerts"
              className="rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-200 transition-all hover:border-blue-500/50 hover:text-blue-300"
            >
              ← Alerts
            </Link>
          }
        />
        <AlertSettingsClient isAdmin={isAdmin} canEditMaintenance={canEditMaintenance} />
      </div>
    </PageTransition>
  );
}
