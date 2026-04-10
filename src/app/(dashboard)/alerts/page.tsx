export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { AlertsPageClient } from "@/components/alerts/alerts-page-client";

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    include: { rule: true, acknowledgement: { include: { user: true } } },
    orderBy: { firedAt: "desc" },
    take: 500,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <Link
          href="/alerts/rules"
          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:border-blue-500 hover:text-blue-300"
        >
          규칙 관리 →
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
  );
}
