export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AlertsPageClient } from "@/components/alerts/alerts-page-client";
import { PageTransition } from "@/components/ui/page-transition";
import { Bell } from "lucide-react";

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    include: { rule: true, acknowledgement: { include: { user: true } } },
    orderBy: { firedAt: "desc" },
    take: 500,
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Bell}
          title="Alerts"
          subtitle="Alert management and history"
          accent="red"
          right={
            <Link
              href="/alerts/rules"
              className="rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-200 hover:border-blue-500/50 hover:text-blue-300 transition-all"
            >
              Manage Rules
            </Link>
          }
        />

        <Suspense
          fallback={<Card className="p-8 text-center text-gray-500">Loading...</Card>}
        >
          <AlertsPageClient
            alerts={JSON.parse(JSON.stringify(alerts))}
          />
        </Suspense>
      </div>
    </PageTransition>
  );
}
