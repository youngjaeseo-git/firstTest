import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/rbac";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Infrastructure</h1>
          <p className="text-sm text-gray-400">
            장비 관리 - 총 {equipment.length}대
          </p>
        </div>
        {user?.role === "ADMIN" && (
          <Link href="/infrastructure/new">
            <Button>+ 장비 등록</Button>
          </Link>
        )}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card key={status} className="p-4 text-center">
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
              <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Hostname</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">CPU</th>
                <th className="px-4 py-3 font-medium">Memory</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {equipment.map((eq) => (
                <tr
                  key={eq.id}
                  className="text-gray-300 hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 font-medium text-gray-100">
                    <Link
                      href={`/infrastructure/${eq.id}`}
                      className="hover:text-blue-400"
                    >
                      {eq.hostname || "-"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {eq.ipAddress || "-"}
                  </td>
                  <td className="px-4 py-3">{eq.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={eq.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {eq.rack
                      ? `${eq.rack.room.name} / ${eq.rack.name} / U${eq.rackPosition}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {eq.cpus[0]?.model || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {eq.totalMemoryGB ? `${eq.totalMemoryGB} GB` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/infrastructure/${eq.id}`}>
                        <Button variant="ghost" size="sm">
                          상세
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
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    등록된 장비가 없습니다. 장비를 등록해주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
