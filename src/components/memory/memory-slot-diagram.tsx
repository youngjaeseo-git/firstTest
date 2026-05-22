"use client";

import { cn } from "@/lib/utils";

interface MemorySlot {
  slotName: string;
  populated: boolean;
  capacityGb: number | null;
  memoryType: string | null;
}

export function MemorySlotDiagram({
  memories,
  cpuCount,
}: {
  memories: MemorySlot[];
  cpuCount?: number;
}) {
  const slotsPerRow = 32;
  const numCpus = cpuCount || Math.max(1, Math.ceil(memories.length / 32));
  const slotsPerCpu = Math.ceil(memories.length / numCpus);

  const groups = Array.from({ length: numCpus }, (_, i) =>
    memories.slice(i * slotsPerCpu, (i + 1) * slotsPerCpu)
  );

  return (
    <div className="space-y-4">
      {groups.map((slots, gi) => (
        <div key={gi}>
          {numCpus > 1 && (
            <p className="mb-2 text-[11px] font-medium text-gray-500">
              Node {gi} ({slots.filter((s) => s.populated).length}/{slots.length} populated)
            </p>
          )}
          <div className="space-y-1.5">
            {Array.from(
              { length: Math.ceil(slots.length / slotsPerRow) },
              (_, rowIdx) => {
                const rowSlots = slots.slice(
                  rowIdx * slotsPerRow,
                  (rowIdx + 1) * slotsPerRow
                );
                return (
                  <div key={rowIdx} className="flex flex-wrap gap-1">
                    {rowSlots.map((slot) => (
                      <div
                        key={slot.slotName}
                        className={cn(
                          "group relative flex h-10 w-8 flex-col items-center justify-center rounded border text-[9px] transition-colors",
                          slot.populated
                            ? "border-green-600 bg-green-600/15 text-green-300 hover:bg-green-600/25"
                            : "border-gray-700 bg-gray-800/50 text-gray-600 hover:bg-gray-800"
                        )}
                        title={
                          slot.populated
                            ? `${slot.slotName}: ${slot.capacityGb}GB ${slot.memoryType || ""}`
                            : `${slot.slotName}: Empty`
                        }
                      >
                        <span className="font-mono font-bold text-[8px]">
                          {slot.populated ? `${slot.capacityGb}G` : ""}
                        </span>
                        <span className="truncate px-0.5 text-[7px]">
                          {slot.slotName.replace(/DIMM_|CPU\d_/g, "").slice(-3)}
                        </span>

                        <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-gray-200 shadow-lg group-hover:block">
                          {slot.slotName}
                          {slot.populated && (
                            <>
                              <br />
                              {slot.capacityGb}GB {slot.memoryType}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
