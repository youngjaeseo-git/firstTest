export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSessionUser } from "@/lib/rbac";
import { PageTransition } from "@/components/ui/page-transition";
import { Building2 } from "lucide-react";

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

        {/* Equipment table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/80 bg-gray-900/50 text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Hostname</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">CPU</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Memory</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {equipment.map((eq) => (
                  <tr
                    key={eq.id}
                    className="text-gray-300 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-100">
                      <Link
                        href={`/infrastructure/${eq.id}`}
                        className="hover:text-blue-400 transition-colors"
                      >
                        {eq.hostname || "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {eq.ipAddress || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{eq.type}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={eq.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {eq.rack
                        ? `${eq.rack.room.name} / ${eq.rack.name} / U${eq.rackPosition}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {eq.cpus[0]?.model || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {eq.totalMemoryGB ? `${eq.totalMemoryGB} GB` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link href={`/infrastructure/${eq.id}`}>
                          <Button variant="ghost" size="sm">
                            Detail
                          </Button>
                        </Link>
                        <Link href={`/infrastructure/${eq.id}/memory`}>
                          <Button variant="ghost" size="sm">
                            Memory
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {equipment.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                      <p className="font-medium">No equipment registered</p>
                      <p className="text-xs mt-1">Add your first equipment to get started</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
