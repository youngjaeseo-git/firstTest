import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MemorySlotDiagram } from "@/components/memory/memory-slot-diagram";

export default async function MemoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: params.id },
    include: {
      cpus: { orderBy: { socketIndex: "asc" } },
      memories: { orderBy: { slotIndex: "asc" } },
    },
  });

  if (!equipment) notFound();

  const memories = equipment.memories;
  const populated = memories.filter((m) => m.populated);
  const totalCapacity = populated.reduce((s, m) => s + (m.capacityGb || 0), 0);
  const memoryTypes = [...new Set(populated.map((m) => m.memoryType).filter(Boolean))];
  const manufacturers = [...new Set(populated.map((m) => m.manufacturer).filter(Boolean))];
  const maxSpeed = Math.max(...populated.map((m) => m.speedMhz || 0), 0);

  // Group slots by CPU socket (simple heuristic: divide evenly or by slot name pattern)
  const cpuCount = Math.max(equipment.cpus.length, 1);
  const slotsPerCpu = Math.ceil(memories.length / cpuCount);
  const socketGroups = Array.from({ length: cpuCount }, (_, i) => {
    const slots = memories.slice(i * slotsPerCpu, (i + 1) * slotsPerCpu);
    const pop = slots.filter((s) => s.populated);
    return {
      socketIndex: i,
      cpu: equipment.cpus[i] || null,
      slots,
      populatedCount: pop.length,
      totalCapacity: pop.reduce((s, m) => s + (m.capacityGb || 0), 0),
    };
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Title */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/infrastructure" className="hover:text-gray-200">Infrastructure</Link>
          <span>/</span>
          <Link href={`/infrastructure/${equipment.id}`} className="hover:text-gray-200">
            {equipment.hostname || equipment.serialNumber}
          </Link>
          <span>/</span>
          <span>Memory</span>
        </div>
        <h1 className="text-2xl font-bold">
          Memory Detail - {equipment.hostname || "Equipment"}
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <p className="text-sm text-gray-400">Total Capacity</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">{totalCapacity} GB</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">DIMM Slots</p>
          <p className="mt-1 text-2xl font-bold">
            <span className="text-green-400">{populated.length}</span>
            <span className="text-lg text-gray-500"> / {memories.length}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {memories.length - populated.length} empty
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Memory Type</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {memoryTypes.length > 0
              ? memoryTypes.map((t) => (
                  <Badge key={t} variant="info">{t}</Badge>
                ))
              : <span className="text-gray-500">-</span>}
          </div>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Manufacturers</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {manufacturers.length > 0
              ? manufacturers.map((m) => (
                  <Badge key={m}>{m}</Badge>
                ))
              : <span className="text-gray-500">-</span>}
          </div>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Max Speed</p>
          <p className="mt-1 text-2xl font-bold">
            {maxSpeed > 0 ? `${maxSpeed}` : "-"}
            <span className="text-lg text-gray-500"> MHz</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            ECC: {populated.some((m) => m.eccEnabled) ? "Yes" : "N/A"}
          </p>
        </Card>
      </div>

      {/* Slot Visual Diagram */}
      <Card>
        <p className="mb-3 text-sm font-medium text-gray-400">DIMM Slot Overview</p>
        <MemorySlotDiagram memories={memories.map((m) => ({
          slotName: m.slotName,
          populated: m.populated,
          capacityGb: m.capacityGb,
          memoryType: m.memoryType,
        }))} />
      </Card>

      {/* Per-Socket Accordion */}
      <Accordion type="multiple" defaultValue={socketGroups.map((_, i) => `socket-${i}`)}>
        {socketGroups.map((group) => (
          <AccordionItem key={group.socketIndex} value={`socket-${group.socketIndex}`}>
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold">
                  Socket {group.socketIndex}
                  {group.cpu ? ` (${group.cpu.model || group.cpu.manufacturer || "Unknown"})` : ""}
                </span>
                <Badge variant="info">
                  {group.populatedCount}/{group.slots.length} slots
                </Badge>
                <Badge>{group.totalCapacity} GB</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                      <th className="px-3 py-2">Slot</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Capacity</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Speed</th>
                      <th className="px-3 py-2">Manufacturer</th>
                      <th className="px-3 py-2">Part Number</th>
                      <th className="px-3 py-2">Serial</th>
                      <th className="px-3 py-2">Rank</th>
                      <th className="px-3 py-2">ECC</th>
                      <th className="px-3 py-2">Form Factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {group.slots.map((slot) => (
                      <tr
                        key={slot.id}
                        className={
                          slot.populated
                            ? "text-gray-200"
                            : "text-gray-600"
                        }
                      >
                        <td className="px-3 py-2 font-mono text-xs font-medium">
                          {slot.slotName}
                        </td>
                        <td className="px-3 py-2">
                          {slot.populated ? (
                            <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                          ) : (
                            <span className="inline-flex h-2 w-2 rounded-full bg-gray-600" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {slot.populated ? `${slot.capacityGb} GB` : "-"}
                        </td>
                        <td className="px-3 py-2">{slot.memoryType || "-"}</td>
                        <td className="px-3 py-2">
                          {slot.speedMhz ? `${slot.speedMhz} MHz` : "-"}
                          {slot.currentSpeedMhz && slot.currentSpeedMhz !== slot.speedMhz
                            ? ` (${slot.currentSpeedMhz})`
                            : ""}
                        </td>
                        <td className="px-3 py-2">{slot.manufacturer || "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {slot.partNumber || "-"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {slot.serialNumber || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {slot.rank ? `${slot.rank}R` : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {slot.eccEnabled === true
                            ? "Yes"
                            : slot.eccEnabled === false
                              ? "No"
                              : "-"}
                        </td>
                        <td className="px-3 py-2">{slot.formFactor || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
