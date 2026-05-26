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
  const slotsPerRow = 16;
  const numCpus = cpuCount || Math.max(1, Math.ceil(memories.length / 16));
  const slotsPerCpu = Math.ceil(memories.length / numCpus);

  const groups = Array.from({ length: numCpus }, (_, i) =>
    memories.slice(i * slotsPerCpu, (i + 1) * slotsPerCpu)
  );

  return (
    <div className="space-y-5">
      {groups.map((slots, gi) => (
        <div key={gi}>
          {numCpus > 1 && (
            <p className="mb-2 text-xs font-medium text-gray-400">
              Node {gi} ({slots.filter((s) => s.populated).length}/{slots.length} populated)
            </p>
          )}
          <div className="space-y-2">
            {Array.from(
              { length: Math.ceil(slots.length / slotsPerRow) },
              (_, rowIdx) => {
                const rowSlots = slots.slice(
                  rowIdx * slotsPerRow,
                  (rowIdx + 1) * slotsPerRow
                );
                return (
                  <div key={rowIdx} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(rowSlots.length, slotsPerRow)}, 3rem)` }}>
                    {rowSlots.map((slot) => (
                      <div
                        key={slot.slotName}
                        className={cn(
                          "group relative flex h-14 w-12 flex-col items-center justify-center rounded-md border text-[10px] transition-colors",
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
                        <span className="font-mono font-bold">
                          {slot.populated ? `${slot.capacityGb}G` : ""}
                        </span>
                        <span className="mt-0.5 truncate px-0.5 text-[8px]">
                          {slot.slotName.replace(/DIMM_|CPU\d_/g, "").slice(-4)}
                        </span>

                        <div className="pointer-events-none absolute -top-11 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-gray-200 shadow-lg group-hover:block">
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
