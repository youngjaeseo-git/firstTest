"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RoomData {
  id: string;
  name: string;
  racks: {
    id: string;
    name: string;
    totalUnits: number;
    rowLabel: string | null;
    equipment: { rackPosition: number; rackHeight: number }[];
  }[];
}

interface CpuEntry {
  socketIndex: number;
  manufacturer: string;
  model: string;
  cores: number | "";
  threads: number | "";
  baseFreqMhz: number | "";
  maxFreqMhz: number | "";
  architecture: string;
  tdpWatts: number | "";
}

interface MemoryEntry {
  slotName: string;
  slotIndex: number;
  populated: boolean;
  capacityGb: number | "";
  memoryType: string;
  manufacturer: string;
  partNumber: string;
  serialNumber: string;
  speedMhz: number | "";
  rank: number | "";
  eccEnabled: boolean;
  formFactor: string;
}

const EQUIPMENT_TYPES = [
  "SERVER",
  "SWITCH",
  "ROUTER",
  "FIREWALL",
  "STORAGE",
  "PDU",
  "UPS",
  "PATCH_PANEL",
  "OTHER",
];

const MEMORY_TYPES = [
  "DDR3",
  "DDR4",
  "DDR5",
  "HBM",
  "HBM2",
  "HBM2E",
  "HBM3",
  "LPDDR4",
  "LPDDR5",
];

const FORM_FACTORS = ["RDIMM", "LRDIMM", "UDIMM", "SO-DIMM"];

function emptyCpu(socketIndex: number): CpuEntry {
  return {
    socketIndex,
    manufacturer: "",
    model: "",
    cores: "",
    threads: "",
    baseFreqMhz: "",
    maxFreqMhz: "",
    architecture: "x86_64",
    tdpWatts: "",
  };
}

function emptyMemory(slotIndex: number): MemoryEntry {
  return {
    slotName: `DIMM_${String.fromCharCode(65 + Math.floor(slotIndex / 2))}${(slotIndex % 2) + 1}`,
    slotIndex,
    populated: false,
    capacityGb: "",
    memoryType: "DDR5",
    manufacturer: "",
    partNumber: "",
    serialNumber: "",
    speedMhz: "",
    rank: "",
    eccEnabled: true,
    formFactor: "RDIMM",
  };
}

export default function NewEquipmentPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Basic info
  const [hostname, setHostname] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [type, setType] = useState("SERVER");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [osType, setOsType] = useState("");
  const [osVersion, setOsVersion] = useState("");
  const [biosVersion, setBiosVersion] = useState("");
  const [bmcIpAddress, setBmcIpAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Rack position
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRackId, setSelectedRackId] = useState("");
  const [rackPosition, setRackPosition] = useState<number | "">("");
  const [rackHeight, setRackHeight] = useState(1);

  // CPU entries
  const [cpus, setCpus] = useState<CpuEntry[]>([emptyCpu(0), emptyCpu(1)]);

  // Memory entries
  const [memorySlotCount, setMemorySlotCount] = useState(16);
  const [memories, setMemories] = useState<MemoryEntry[]>(
    Array.from({ length: 16 }, (_, i) => emptyMemory(i))
  );

  // Active sections
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["basic", "location", "cpu", "memory"])
  );

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((data) => {
        const roomsWithEquipment = data.map(
          (room: RoomData & { racks: (RoomData["racks"][0] & { _count?: { equipment: number } })[] }) => ({
            ...room,
            racks: room.racks.map((rack) => ({
              ...rack,
              equipment: rack.equipment || [],
            })),
          })
        );
        setRooms(roomsWithEquipment);
      })
      .catch(() => {});
  }, []);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const selectedRack = selectedRoom?.racks.find(
    (r) => r.id === selectedRackId
  );

  // Calculate occupied U positions in selected rack
  const occupiedUnits = new Set<number>();
  if (selectedRack) {
    for (const eq of selectedRack.equipment) {
      for (let u = eq.rackPosition; u < eq.rackPosition + eq.rackHeight; u++) {
        occupiedUnits.add(u);
      }
    }
  }

  function toggleSection(section: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function handleMemorySlotCountChange(count: number) {
    setMemorySlotCount(count);
    setMemories((prev) => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, (_, i) =>
            emptyMemory(prev.length + i)
          ),
        ];
      }
      return prev.slice(0, count);
    });
  }

  function updateCpu(index: number, field: keyof CpuEntry, value: unknown) {
    setCpus((prev) =>
      prev.map((cpu, i) => (i === index ? { ...cpu, [field]: value } : cpu))
    );
  }

  function updateMemory(
    index: number,
    field: keyof MemoryEntry,
    value: unknown
  ) {
    setMemories((prev) =>
      prev.map((mem, i) => (i === index ? { ...mem, [field]: value } : mem))
    );
  }

  // Bulk fill for memory: copy first populated slot settings to all populated slots
  function bulkFillMemory() {
    const first = memories.find((m) => m.populated);
    if (!first) return;
    setMemories((prev) =>
      prev.map((m) =>
        m.populated
          ? {
              ...m,
              capacityGb: first.capacityGb,
              memoryType: first.memoryType,
              manufacturer: first.manufacturer,
              speedMhz: first.speedMhz,
              rank: first.rank,
              eccEnabled: first.eccEnabled,
              formFactor: first.formFactor,
            }
          : m
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cpuData = cpus
      .filter((c) => c.manufacturer || c.model)
      .map((c) => ({
        socketIndex: c.socketIndex,
        manufacturer: c.manufacturer || null,
        model: c.model || null,
        cores: c.cores || null,
        threads: c.threads || null,
        baseFreqMhz: c.baseFreqMhz || null,
        maxFreqMhz: c.maxFreqMhz || null,
        architecture: c.architecture || null,
        tdpWatts: c.tdpWatts || null,
      }));

    const memData = memories.map((m) => ({
      slotName: m.slotName,
      slotIndex: m.slotIndex,
      populated: m.populated,
      capacityGb: m.populated && m.capacityGb ? Number(m.capacityGb) : null,
      memoryType: m.populated ? m.memoryType || null : null,
      manufacturer: m.populated ? m.manufacturer || null : null,
      partNumber: m.populated ? m.partNumber || null : null,
      serialNumber: m.populated ? m.serialNumber || null : null,
      speedMhz: m.populated && m.speedMhz ? Number(m.speedMhz) : null,
      rank: m.populated && m.rank ? Number(m.rank) : null,
      eccEnabled: m.populated ? m.eccEnabled : null,
      formFactor: m.populated ? m.formFactor || null : null,
    }));

    const totalMemoryGB = memData
      .filter((m) => m.populated)
      .reduce((s, m) => s + (m.capacityGb || 0), 0);

    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: hostname || null,
          ipAddress: ipAddress || null,
          type,
          manufacturer: manufacturer || null,
          model: model || null,
          serialNumber: serialNumber || null,
          assetTag: assetTag || null,
          rackId: selectedRackId || null,
          rackPosition: rackPosition || null,
          rackHeight,
          status: "ACTIVE",
          osType: osType || null,
          osVersion: osVersion || null,
          biosVersion: biosVersion || null,
          bmcIpAddress: bmcIpAddress || null,
          totalMemoryGB: totalMemoryGB || null,
          notes: notes || null,
          cpus: cpuData.length > 0 ? cpuData : undefined,
          memories: memData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "등록에 실패했습니다.");
        setLoading(false);
        return;
      }

      const created = await res.json();
      router.push(`/infrastructure/${created.id}`);
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "mb-1 block text-sm font-medium text-gray-300";
  const sectionHeaderClass =
    "flex cursor-pointer items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/infrastructure" className="hover:text-gray-200">
            Infrastructure
          </Link>
          <span>/</span>
          <span>New Equipment</span>
        </div>
        <h1 className="text-2xl font-bold">장비 등록</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <Card>
          <div
            className={sectionHeaderClass}
            onClick={() => toggleSection("basic")}
          >
            <h2 className="text-base font-semibold">기본 정보</h2>
            <span className="text-gray-400">
              {openSections.has("basic") ? "−" : "+"}
            </span>
          </div>
          {openSections.has("basic") && (
            <div className="mt-4 grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass}>Hostname</label>
                <input
                  className={inputClass}
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  placeholder="server-01"
                />
              </div>
              <div>
                <label className={labelClass}>IP Address</label>
                <input
                  className={inputClass}
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="10.0.0.1"
                />
              </div>
              <div>
                <label className={labelClass}>Type *</label>
                <select
                  className={inputClass}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {EQUIPMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Manufacturer</label>
                <input
                  className={inputClass}
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Dell, HPE, Supermicro..."
                />
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <input
                  className={inputClass}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="PowerEdge R760"
                />
              </div>
              <div>
                <label className={labelClass}>Serial Number</label>
                <input
                  className={inputClass}
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN-XXXXXX"
                />
              </div>
              <div>
                <label className={labelClass}>Asset Tag</label>
                <input
                  className={inputClass}
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  placeholder="AT-XXXXXX"
                />
              </div>
              <div>
                <label className={labelClass}>OS Type</label>
                <input
                  className={inputClass}
                  value={osType}
                  onChange={(e) => setOsType(e.target.value)}
                  placeholder="Linux, Windows, ESXi"
                />
              </div>
              <div>
                <label className={labelClass}>OS Version</label>
                <input
                  className={inputClass}
                  value={osVersion}
                  onChange={(e) => setOsVersion(e.target.value)}
                  placeholder="Ubuntu 22.04"
                />
              </div>
              <div>
                <label className={labelClass}>BIOS Version</label>
                <input
                  className={inputClass}
                  value={biosVersion}
                  onChange={(e) => setBiosVersion(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>BMC/IPMI IP</label>
                <input
                  className={inputClass}
                  value={bmcIpAddress}
                  onChange={(e) => setBmcIpAddress(e.target.value)}
                  placeholder="10.0.1.1"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className={labelClass}>Notes</label>
                <textarea
                  className={inputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </Card>

        {/* Location: Room → Rack → U Position */}
        <Card>
          <div
            className={sectionHeaderClass}
            onClick={() => toggleSection("location")}
          >
            <h2 className="text-base font-semibold">위치 (Room → Rack → U)</h2>
            <span className="text-gray-400">
              {openSections.has("location") ? "−" : "+"}
            </span>
          </div>
          {openSections.has("location") && (
            <div className="mt-4 space-y-4 px-4 pb-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Room</label>
                  <select
                    className={inputClass}
                    value={selectedRoomId}
                    onChange={(e) => {
                      setSelectedRoomId(e.target.value);
                      setSelectedRackId("");
                      setRackPosition("");
                    }}
                  >
                    <option value="">-- Select Room --</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Rack</label>
                  <select
                    className={inputClass}
                    value={selectedRackId}
                    onChange={(e) => {
                      setSelectedRackId(e.target.value);
                      setRackPosition("");
                    }}
                    disabled={!selectedRoomId}
                  >
                    <option value="">-- Select Rack --</option>
                    {selectedRoom?.racks.map((rack) => (
                      <option key={rack.id} value={rack.id}>
                        {rack.name}
                        {rack.rowLabel ? ` (Row ${rack.rowLabel})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>U Position (bottom)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={rackPosition}
                    onChange={(e) =>
                      setRackPosition(
                        e.target.value ? parseInt(e.target.value) : ""
                      )
                    }
                    min={1}
                    max={selectedRack?.totalUnits || 42}
                    disabled={!selectedRackId}
                    placeholder="1-42"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Height (U)</label>
                  <select
                    className={inputClass}
                    value={rackHeight}
                    onChange={(e) => setRackHeight(parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((h) => (
                      <option key={h} value={h}>
                        {h}U
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Visual rack preview */}
              {selectedRack && (
                <div>
                  <p className="mb-2 text-sm text-gray-400">
                    Rack Layout (occupied units shown in blue, selected in green)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(
                      { length: selectedRack.totalUnits },
                      (_, i) => {
                        const u = i + 1;
                        const isOccupied = occupiedUnits.has(u);
                        const isSelected =
                          rackPosition !== "" &&
                          u >= (rackPosition as number) &&
                          u < (rackPosition as number) + rackHeight;
                        return (
                          <div
                            key={u}
                            className={`flex h-6 w-8 items-center justify-center rounded text-xs font-mono ${
                              isSelected
                                ? "bg-green-600 text-white"
                                : isOccupied
                                  ? "bg-blue-800 text-blue-300"
                                  : "bg-gray-800 text-gray-500"
                            }`}
                            title={`U${u}${isOccupied ? " (occupied)" : ""}`}
                          >
                            {u}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* CPU Information */}
        <Card>
          <div
            className={sectionHeaderClass}
            onClick={() => toggleSection("cpu")}
          >
            <h2 className="text-base font-semibold">
              CPU 정보{" "}
              <Badge variant="info">{cpus.length} sockets</Badge>
            </h2>
            <span className="text-gray-400">
              {openSections.has("cpu") ? "−" : "+"}
            </span>
          </div>
          {openSections.has("cpu") && (
            <div className="mt-4 space-y-4 px-4 pb-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCpus((prev) => [...prev, emptyCpu(prev.length)])
                  }
                  className="rounded bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600"
                >
                  + Add Socket
                </button>
                {cpus.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCpus((prev) => prev.slice(0, -1))}
                    className="rounded bg-gray-700 px-3 py-1 text-xs text-red-400 hover:bg-gray-600"
                  >
                    Remove Last
                  </button>
                )}
              </div>
              {cpus.map((cpu, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-700 p-4"
                >
                  <p className="mb-3 text-sm font-medium text-gray-300">
                    Socket {i}
                  </p>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div>
                      <label className={labelClass}>Manufacturer</label>
                      <select
                        className={inputClass}
                        value={cpu.manufacturer}
                        onChange={(e) =>
                          updateCpu(i, "manufacturer", e.target.value)
                        }
                      >
                        <option value="">--</option>
                        <option value="Intel">Intel</option>
                        <option value="AMD">AMD</option>
                        <option value="ARM">ARM</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Model</label>
                      <input
                        className={inputClass}
                        value={cpu.model}
                        onChange={(e) =>
                          updateCpu(i, "model", e.target.value)
                        }
                        placeholder="Xeon Gold 6348"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Cores</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={cpu.cores}
                        onChange={(e) =>
                          updateCpu(
                            i,
                            "cores",
                            e.target.value ? parseInt(e.target.value) : ""
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Threads</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={cpu.threads}
                        onChange={(e) =>
                          updateCpu(
                            i,
                            "threads",
                            e.target.value ? parseInt(e.target.value) : ""
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Base Freq (MHz)</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={cpu.baseFreqMhz}
                        onChange={(e) =>
                          updateCpu(
                            i,
                            "baseFreqMhz",
                            e.target.value ? parseInt(e.target.value) : ""
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Max Freq (MHz)</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={cpu.maxFreqMhz}
                        onChange={(e) =>
                          updateCpu(
                            i,
                            "maxFreqMhz",
                            e.target.value ? parseInt(e.target.value) : ""
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Architecture</label>
                      <select
                        className={inputClass}
                        value={cpu.architecture}
                        onChange={(e) =>
                          updateCpu(i, "architecture", e.target.value)
                        }
                      >
                        <option value="x86_64">x86_64</option>
                        <option value="aarch64">aarch64</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>TDP (Watts)</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={cpu.tdpWatts}
                        onChange={(e) =>
                          updateCpu(
                            i,
                            "tdpWatts",
                            e.target.value ? parseInt(e.target.value) : ""
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Memory Slots */}
        <Card>
          <div
            className={sectionHeaderClass}
            onClick={() => toggleSection("memory")}
          >
            <h2 className="text-base font-semibold">
              메모리 (DIMM Slots){" "}
              <Badge variant="info">
                {memories.filter((m) => m.populated).length}/{memories.length}{" "}
                populated
              </Badge>
            </h2>
            <span className="text-gray-400">
              {openSections.has("memory") ? "−" : "+"}
            </span>
          </div>
          {openSections.has("memory") && (
            <div className="mt-4 space-y-4 px-4 pb-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className={labelClass}>Total Slot Count</label>
                  <select
                    className={inputClass}
                    value={memorySlotCount}
                    onChange={(e) =>
                      handleMemorySlotCountChange(parseInt(e.target.value))
                    }
                  >
                    {[4, 8, 12, 16, 24, 32].map((n) => (
                      <option key={n} value={n}>
                        {n} slots
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={bulkFillMemory}
                  className="mt-5 rounded bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700"
                >
                  Bulk Fill (copy first populated)
                </button>
              </div>

              {/* Quick toggle: populate/unpopulate slots */}
              <div>
                <p className="mb-2 text-sm text-gray-400">
                  Click to toggle populated (green = populated)
                </p>
                <div className="flex flex-wrap gap-1">
                  {memories.map((mem, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        updateMemory(i, "populated", !mem.populated)
                      }
                      className={`h-8 w-16 rounded text-xs font-mono ${
                        mem.populated
                          ? "bg-green-700 text-green-100"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {mem.slotName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail table for populated slots */}
              {memories.some((m) => m.populated) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                        <th className="px-2 py-2">Slot</th>
                        <th className="px-2 py-2">Capacity (GB)</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Speed (MHz)</th>
                        <th className="px-2 py-2">Manufacturer</th>
                        <th className="px-2 py-2">Part Number</th>
                        <th className="px-2 py-2">Rank</th>
                        <th className="px-2 py-2">ECC</th>
                        <th className="px-2 py-2">Form Factor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {memories
                        .filter((m) => m.populated)
                        .map((mem) => (
                          <tr key={mem.slotIndex}>
                            <td className="px-2 py-2 font-mono text-xs font-medium text-gray-300">
                              {mem.slotName}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                                value={mem.capacityGb}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "capacityGb",
                                    e.target.value
                                      ? parseInt(e.target.value)
                                      : ""
                                  )
                                }
                                placeholder="32"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <select
                                className="w-24 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                                value={mem.memoryType}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "memoryType",
                                    e.target.value
                                  )
                                }
                              >
                                {MEMORY_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                                value={mem.speedMhz}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "speedMhz",
                                    e.target.value
                                      ? parseInt(e.target.value)
                                      : ""
                                  )
                                }
                                placeholder="4800"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className="w-28 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                                value={mem.manufacturer}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "manufacturer",
                                    e.target.value
                                  )
                                }
                                placeholder="Samsung"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className="w-32 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                                value={mem.partNumber}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "partNumber",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-2">
                              <select
                                className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                                value={mem.rank}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "rank",
                                    e.target.value
                                      ? parseInt(e.target.value)
                                      : ""
                                  )
                                }
                              >
                                <option value="">-</option>
                                <option value="1">1R</option>
                                <option value="2">2R</option>
                                <option value="4">4R</option>
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={mem.eccEnabled}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "eccEnabled",
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <select
                                className="w-24 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                                value={mem.formFactor}
                                onChange={(e) =>
                                  updateMemory(
                                    mem.slotIndex,
                                    "formFactor",
                                    e.target.value
                                  )
                                }
                              >
                                <option value="">-</option>
                                {FORM_FACTORS.map((f) => (
                                  <option key={f} value={f}>
                                    {f}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/infrastructure"
            className="rounded-lg border border-gray-700 px-6 py-2.5 text-sm text-gray-300 hover:bg-gray-800"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "등록 중..." : "장비 등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
