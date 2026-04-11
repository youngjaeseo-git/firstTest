export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { AlertsPageClient } from "@/components/alerts/alerts-page-client";
import { PageTransition } from "@/components/ui/page-transition";

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    include: { rule: true, acknowledgement: { include: { user: true } } },
    orderBy: { firedAt: "desc" },
    take: 500,
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
            <p className="text-sm text-gray-500 mt-1">
              Alert management and history
            </p>
          </div>
          <Link
            href="/alerts/rules"
            className="rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-200 hover:border-blue-500/50 hover:text-blue-300 transition-all"
          >
            Manage Rules
          </Link>
        </div>

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
