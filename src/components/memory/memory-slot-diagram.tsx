"use client";

import { cn } from "@/lib/utils";

interface MemorySlot {
  slotName: string;
  populated: boolean;
  capacityGb: number | null;
  memoryType: string | null;
}

export function MemorySlotDiagram({ memories }: { memories: MemorySlot[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {memories.map((slot) => (
        <div
          key={slot.slotName}
          className={cn(
            "group relative flex h-16 w-12 flex-col items-center justify-center rounded-md border text-[10px] transition-colors",
            slot.populated
              ? "border-green-600 bg-green-600/15 text-green-300 hover:bg-green-600/25"
              : "border-gray-700 bg-gray-800/50 text-gray-600 hover:bg-gray-800",
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
            {slot.slotName.replace("DIMM_", "").replace("CPU0_", "").replace("CPU1_", "")}
          </span>

          {/* Tooltip */}
          <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-gray-200 shadow-lg group-hover:block">
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
