export const revalidate = 30;

import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUser } from "@/lib/rbac";
import { PageTransition } from "@/components/ui/page-transition";
import { Building2 } from "lucide-react";
import { EquipmentTable } from "./equipment-table";

export default async function InfrastructurePage() {
  const user = await getSessionUser();
  const equipment = await prisma.equipment.findMany({
    include: {
      rack: { include: { room: true } },
      cpus: true,
      _count: { select: { memories: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const statusCounts = equipment.reduce(
    (acc, eq) => {
      acc[eq.status] = (acc[eq.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const tableData = equipment.map(eq => ({
    id: eq.id,
    hostname: eq.hostname,
    ipAddress: eq.ipAddress,
    type: eq.type,
    model: eq.model,
    status: eq.status,
    rackHeight: eq.rackHeight,
    totalMemoryGB: eq.totalMemoryGB,
    location: eq.rack ? `${eq.rack.room.name} / ${eq.rack.name} / U${eq.rackPosition}` : null,
    cpuModel: eq.cpus[0]?.model || null,
  }));

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Building2}
          title="Infrastructure"
          subtitle={`Equipment management — ${equipment.length} total`}
          accent="purple"
          right={
            (user?.role === "ADMIN" || user?.role === "OPERATOR") ? (
              <div className="flex gap-2">
                <Link href="/infrastructure/import">
                  <Button variant="outline">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Bulk Import
                  </Button>
                </Link>
                <Link href="/infrastructure/new">
                  <Button>+ Add Equipment</Button>
                </Link>
              </div>
            ) : undefined
          }
        />

        {/* Status summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Card key={status} className="p-4 text-center hover:border-gray-700/80 hover:shadow-md">
              <StatusBadge status={status} />
              <p className="mt-2 text-2xl font-bold">{count}</p>
            </Card>
          ))}
        </div>

        <EquipmentTable data={tableData} />
      </div>
    </PageTransition>
  );
}
