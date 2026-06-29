"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/i18n-context";
import { MEMORY_TYPES, FORM_FACTORS } from "@/lib/schemas/equipment";

const SLOT_COUNTS = [8, 12, 16, 24, 32];

interface MemorySlot {
  slotName: string;
  populated: boolean;
  capacityGb: number | null;
  memoryType: string;
  manufacturer: string;
  partNumber: string;
  serialNumber: string;
  speedMhz: number | null;
  currentSpeedMhz: number | null;
  rank: number | null;
  eccEnabled: boolean | null;
  formFactor: string;
  voltage: number | null;
}

interface MemoryEditorProps {
  equipmentId: string;
  initialMemories: MemorySlot[];
  onSave: (memories: MemorySlot[]) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function generateSlotName(index: number, pattern: string): string {
  if (pattern === "DIMM") {
    const letter = String.fromCharCode(65 + Math.floor(index / 2));
    const num = (index % 2) + 1;
    return `DIMM_${letter}${num}`;
  }
  const cpu = Math.floor(index / 8);
  const ch = Math.floor((index % 8) / 2);
  const dimm = index % 2;
  return `CPU${cpu}_CH${ch}_DIMM${dimm}`;
}

function emptySlot(slotName: string): MemorySlot {
  return {
    slotName,
    populated: false,
    capacityGb: null,
    memoryType: "",
    manufacturer: "",
    partNumber: "",
    serialNumber: "",
    speedMhz: null,
    currentSpeedMhz: null,
    rank: null,
    eccEnabled: null,
    formFactor: "",
    voltage: null,
  };
}

export function MemoryEditor({
  initialMemories,
  onSave,
  onCancel,
  saving,
}: MemoryEditorProps) {
  const t = useT();
  const [slots, setSlots] = useState<MemorySlot[]>(initialMemories);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [showQuickFill, setShowQuickFill] = useState(false);
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [showAddSlots, setShowAddSlots] = useState(false);

  const [fillCapacity, setFillCapacity] = useState<number | "">("");
  const [fillType, setFillType] = useState("");
  const [fillManufacturer, setFillManufacturer] = useState("");
  const [fillSpeed, setFillSpeed] = useState<number | "">("");
  const [fillEcc, setFillEcc] = useState<boolean | null>(null);
  const [fillFormFactor, setFillFormFactor] = useState("");
  const [fillRank, setFillRank] = useState<number | "">("");

  const [bulkField, setBulkField] = useState("capacityGb");
  const [bulkValue, setBulkValue] = useState("");

  const [addCount, setAddCount] = useState(8);
  const [addPattern, setAddPattern] = useState("DIMM");

  const updateSlot = useCallback((index: number, field: string, value: unknown) => {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  function validate(): boolean {
    const newErrors: Record<number, string> = {};
    slots.forEach((slot, i) => {
      if (!slot.slotName.trim()) {
        newErrors[i] = "Slot name is required";
      }
      if (slot.populated && (!slot.capacityGb || slot.capacityGb <= 0)) {
        newErrors[i] = "Populated slots must have a positive capacity";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave(slots);
  }

  function addSlot() {
    const nextIndex = slots.length;
    const name = generateSlotName(nextIndex, "DIMM");
    setSlots((prev) => [...prev, emptySlot(name)]);
  }

  function removeLastSlot() {
    if (slots.length === 0) return;
    setSlots((prev) => prev.slice(0, -1));
  }

  function addEmptySlots() {
    const startIndex = slots.length;
    const newSlots = Array.from({ length: addCount }, (_, i) =>
      emptySlot(generateSlotName(startIndex + i, addPattern))
    );
    setSlots((prev) => [...prev, ...newSlots]);
    setShowAddSlots(false);
  }

  function fillEmptySlots() {
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.populated) return slot;
        return {
          ...slot,
          populated: true,
          capacityGb: fillCapacity ? Number(fillCapacity) : slot.capacityGb,
          memoryType: fillType || slot.memoryType,
          manufacturer: fillManufacturer || slot.manufacturer,
          speedMhz: fillSpeed ? Number(fillSpeed) : slot.speedMhz,
          eccEnabled: fillEcc !== null ? fillEcc : slot.eccEnabled,
          formFactor: fillFormFactor || slot.formFactor,
          rank: fillRank ? Number(fillRank) : slot.rank,
        };
      })
    );
    setShowQuickFill(false);
  }

  function markAllPopulated() {
    setSlots((prev) => prev.map((s) => ({ ...s, populated: true })));
  }

  function markAllEmpty() {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        populated: false,
        capacityGb: null,
        memoryType: "",
        manufacturer: "",
        partNumber: "",
        serialNumber: "",
        speedMhz: null,
        currentSpeedMhz: null,
        rank: null,
        eccEnabled: null,
        formFactor: "",
        voltage: null,
      }))
    );
  }

  function removeEmptySlots() {
    setSlots((prev) => prev.filter((s) => s.populated));
  }

  function applyToAllPopulated() {
    setSlots((prev) =>
      prev.map((slot) => {
        if (!slot.populated) return slot;
        let val: unknown = bulkValue;
        if (bulkField === "capacityGb" || bulkField === "speedMhz" || bulkField === "rank" || bulkField === "voltage") {
          val = bulkValue ? Number(bulkValue) : null;
        }
        if (bulkField === "eccEnabled") {
          val = bulkValue === "true" ? true : bulkValue === "false" ? false : null;
        }
        return { ...slot, [bulkField]: val };
      })
    );
    setShowBulkApply(false);
    setBulkValue("");
  }

  const populatedCount = slots.filter((s) => s.populated).length;
  const totalCapacity = slots
    .filter((s) => s.populated)
    .reduce((sum, s) => sum + (s.capacityGb || 0), 0);

  const inputClass =
    "w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const selectClass =
    "w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "mb-1 block text-xs font-medium text-gray-400";
  const btnSecondary =
    "rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600 transition-colors";
  const btnDanger =
    "rounded bg-gray-700 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-600 transition-colors";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-gray-400">{t("memory.summary")}</p>
            <Badge variant="info">{populatedCount}/{slots.length} populated</Badge>
            <Badge>{totalCapacity} GB total</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-400">{t("memory.quickActions")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addSlot} className={btnSecondary}>+ {t("memory.addSlot")}</button>
            {slots.length > 0 && (
              <button type="button" onClick={removeLastSlot} className={btnDanger}>{t("memory.removeLastSlot")}</button>
            )}
            <button type="button" onClick={() => setShowAddSlots(!showAddSlots)} className={btnSecondary}>
              {t("memory.addNSlots")}
            </button>
            <button type="button" onClick={() => setShowQuickFill(!showQuickFill)} className={btnSecondary}>
              {t("memory.fillEmpty")}
            </button>
            <button type="button" onClick={markAllPopulated} className={btnSecondary}>{t("memory.markAllPopulated")}</button>
            <button type="button" onClick={markAllEmpty} className={btnDanger}>{t("memory.markAllEmpty")}</button>
            <button type="button" onClick={removeEmptySlots} className={btnDanger}>{t("memory.removeEmpty")}</button>
            <button type="button" onClick={() => setShowBulkApply(!showBulkApply)} className={btnSecondary}>
              {t("memory.applyToAll")}
            </button>
          </div>

          {showAddSlots && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="mb-3 text-xs font-medium text-gray-300">Add Empty Slots</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelClass}>Count</label>
                  <select className={selectClass} value={addCount} onChange={(e) => setAddCount(Number(e.target.value))}>
                    {SLOT_COUNTS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Naming Pattern</label>
                  <select className={selectClass} value={addPattern} onChange={(e) => setAddPattern(e.target.value)}>
                    <option value="DIMM">DIMM_A1, DIMM_A2, ...</option>
                    <option value="CPU">CPU0_CH0_DIMM0, ...</option>
                  </select>
                </div>
                <button type="button" onClick={addEmptySlots} className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  Add
                </button>
                <button type="button" onClick={() => setShowAddSlots(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

          {showQuickFill && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="mb-3 text-xs font-medium text-gray-300">Fill All Empty Slots With</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <div>
                  <label className={labelClass}>Capacity (GB)</label>
                  <input type="number" className={inputClass} value={fillCapacity} onChange={(e) => setFillCapacity(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 32" />
                </div>
                <div>
                  <label className={labelClass}>Memory Type</label>
                  <select className={selectClass} value={fillType} onChange={(e) => setFillType(e.target.value)}>
                    <option value="">--</option>
                    {MEMORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Manufacturer</label>
                  <input className={inputClass} value={fillManufacturer} onChange={(e) => setFillManufacturer(e.target.value)} placeholder="e.g. Samsung" />
                </div>
                <div>
                  <label className={labelClass}>Speed (MHz)</label>
                  <input type="number" className={inputClass} value={fillSpeed} onChange={(e) => setFillSpeed(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 4800" />
                </div>
                <div>
                  <label className={labelClass}>ECC</label>
                  <select className={selectClass} value={fillEcc === null ? "" : String(fillEcc)} onChange={(e) => setFillEcc(e.target.value === "" ? null : e.target.value === "true")}>
                    <option value="">--</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Form Factor</label>
                  <select className={selectClass} value={fillFormFactor} onChange={(e) => setFillFormFactor(e.target.value)}>
                    <option value="">--</option>
                    {FORM_FACTORS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Rank</label>
                  <select className={selectClass} value={fillRank} onChange={(e) => setFillRank(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">--</option>
                    <option value="1">1 (Single)</option>
                    <option value="2">2 (Dual)</option>
                    <option value="4">4 (Quad)</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={fillEmptySlots} className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  Apply to Empty Slots
                </button>
                <button type="button" onClick={() => setShowQuickFill(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}

          {showBulkApply && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <p className="mb-3 text-xs font-medium text-gray-300">Apply Value to All Populated Slots</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelClass}>Field</label>
                  <select className={selectClass} value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}>
                    <option value="capacityGb">Capacity (GB)</option>
                    <option value="memoryType">Memory Type</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="speedMhz">Speed (MHz)</option>
                    <option value="rank">Rank</option>
                    <option value="eccEnabled">ECC</option>
                    <option value="formFactor">Form Factor</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Value</label>
                  {bulkField === "memoryType" ? (
                    <select className={selectClass} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
                      <option value="">--</option>
                      {MEMORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : bulkField === "formFactor" ? (
                    <select className={selectClass} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
                      <option value="">--</option>
                      {FORM_FACTORS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  ) : bulkField === "eccEnabled" ? (
                    <select className={selectClass} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
                      <option value="">--</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : bulkField === "rank" ? (
                    <select className={selectClass} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
                      <option value="">--</option>
                      <option value="1">1 (Single)</option>
                      <option value="2">2 (Dual)</option>
                      <option value="4">4 (Quad)</option>
                    </select>
                  ) : (
                    <input className={inputClass} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
                  )}
                </div>
                <button type="button" onClick={applyToAllPopulated} className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  Apply
                </button>
                <button type="button" onClick={() => setShowBulkApply(false)} className={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {slots.length > 0 && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-2 py-2 text-center">#</th>
                  <th className="px-2 py-2">Slot Name</th>
                  <th className="px-2 py-2 text-center">Populated</th>
                  <th className="px-2 py-2">Capacity</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Speed</th>
                  <th className="px-2 py-2">Manufacturer</th>
                  <th className="px-2 py-2">Part Number</th>
                  <th className="px-2 py-2">Serial</th>
                  <th className="px-2 py-2">Rank</th>
                  <th className="px-2 py-2 text-center">ECC</th>
                  <th className="px-2 py-2">Form Factor</th>
                  <th className="px-2 py-2 text-center">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {slots.map((slot, i) => (
                  <tr key={i} className={errors[i] ? "bg-red-500/5" : slot.populated ? "" : "opacity-50"}>
                    <td className="px-2 py-1.5 text-center text-xs text-gray-500">{i}</td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-28 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 font-mono text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.slotName}
                        onChange={(e) => updateSlot(i, "slotName", e.target.value)}
                      />
                      {errors[i] && <p className="mt-0.5 text-[10px] text-red-400">{errors[i]}</p>}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={slot.populated}
                        onChange={(e) => updateSlot(i, "populated", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-16 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.capacityGb ?? ""}
                        onChange={(e) => updateSlot(i, "capacityGb", e.target.value ? Number(e.target.value) : null)}
                        placeholder="GB"
                        disabled={!slot.populated}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="w-20 rounded border border-gray-700 bg-gray-800 px-1 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.memoryType}
                        onChange={(e) => updateSlot(i, "memoryType", e.target.value)}
                        disabled={!slot.populated}
                      >
                        <option value="">--</option>
                        {MEMORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        className="w-16 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.speedMhz ?? ""}
                        onChange={(e) => updateSlot(i, "speedMhz", e.target.value ? Number(e.target.value) : null)}
                        placeholder="MHz"
                        disabled={!slot.populated}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-20 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.manufacturer}
                        onChange={(e) => updateSlot(i, "manufacturer", e.target.value)}
                        placeholder="Mfr"
                        disabled={!slot.populated}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-24 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 font-mono text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.partNumber}
                        onChange={(e) => updateSlot(i, "partNumber", e.target.value)}
                        placeholder="P/N"
                        disabled={!slot.populated}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-24 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 font-mono text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.serialNumber}
                        onChange={(e) => updateSlot(i, "serialNumber", e.target.value)}
                        placeholder="S/N"
                        disabled={!slot.populated}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="w-14 rounded border border-gray-700 bg-gray-800 px-1 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.rank ?? ""}
                        onChange={(e) => updateSlot(i, "rank", e.target.value ? Number(e.target.value) : null)}
                        disabled={!slot.populated}
                      >
                        <option value="">--</option>
                        <option value="1">1R</option>
                        <option value="2">2R</option>
                        <option value="4">4R</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={slot.eccEnabled === true}
                        onChange={(e) => updateSlot(i, "eccEnabled", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                        disabled={!slot.populated}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="w-20 rounded border border-gray-700 bg-gray-800 px-1 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                        value={slot.formFactor}
                        onChange={(e) => updateSlot(i, "formFactor", e.target.value)}
                        disabled={!slot.populated}
                      >
                        <option value="">--</option>
                        {FORM_FACTORS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
                        className="text-gray-500 hover:text-red-400"
                        title="Remove slot"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {slots.length === 0 && (
        <Card>
          <div className="py-4 text-center text-sm text-gray-500">
            No DIMM slots defined. Use the quick actions above to add slots.
          </div>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-700 px-6 py-2.5 text-sm text-gray-300 hover:bg-gray-800"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t("common.saving") : t("memory.saveConfig")}
        </button>
      </div>
    </div>
  );
}
