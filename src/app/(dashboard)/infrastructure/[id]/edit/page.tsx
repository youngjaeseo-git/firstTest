"use client";

import { useRouter, useParams } from "next/navigation";
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

interface EquipmentData {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  type: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  assetTag: string | null;
  rackId: string | null;
  rackPosition: number | null;
  rackHeight: number;
  status: string;
  osType: string | null;
  osVersion: string | null;
  biosVersion: string | null;
  bmcIpAddress: string | null;
  totalMemoryGB: number | null;
  notes: string | null;
  rack: { roomId: string } | null;
  cpus: CpuData[];
  memories: MemoryData[];
}

interface CpuData {
  id: string;
  socketIndex: number;
  manufacturer: string | null;
  model: string | null;
  cores: number | null;
  threads: number | null;
  baseFreqMhz: number | null;
  maxFreqMhz: number | null;
  architecture: string | null;
  tdpWatts: number | null;
}

interface MemoryData {
  id: string;
  slotName: string;
  slotIndex: number;
  populated: boolean;
  capacityGb: number | null;
  memoryType: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  serialNumber: string | null;
  speedMhz: number | null;
  rank: number | null;
  eccEnabled: boolean | null;
  formFactor: string | null;
}

const EQUIPMENT_TYPES = [
  "SERVER", "SWITCH", "ROUTER", "FIREWALL", "STORAGE",
  "PDU", "UPS", "PATCH_PANEL", "OTHER",
];

const EQUIPMENT_STATUSES = [
  "PLANNED", "RECEIVING", "INSTALLED", "ACTIVE", "MAINTENANCE",
  "REPAIR", "FAILED", "DECOMMISSIONED", "DISPOSED",
];


export default function EditEquipmentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Basic info
  const [hostname, setHostname] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [type, setType] = useState("SERVER");
  const [status, setStatus] = useState("ACTIVE");
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
  const [cpus, setCpus] = useState<Array<{
    socketIndex: number;
    manufacturer: string;
    model: string;
    cores: number | "";
    threads: number | "";
    baseFreqMhz: number | "";
    maxFreqMhz: number | "";
    architecture: string;
    tdpWatts: number | "";
  }>>([]);

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["basic", "location", "cpu"])
  );

  useEffect(() => {
    Promise.all([
      fetch(`/api/equipment/${id}`).then((r) => r.json()),
      fetch("/api/rooms").then((r) => r.json()),
    ]).then(([eq, roomsData]: [EquipmentData, RoomData[]]) => {
      // Populate form
      setHostname(eq.hostname || "");
      setIpAddress(eq.ipAddress || "");
      setType(eq.type);
      setStatus(eq.status);
      setManufacturer(eq.manufacturer || "");
      setModel(eq.model || "");
      setSerialNumber(eq.serialNumber || "");
      setAssetTag(eq.assetTag || "");
      setOsType(eq.osType || "");
      setOsVersion(eq.osVersion || "");
      setBiosVersion(eq.biosVersion || "");
      setBmcIpAddress(eq.bmcIpAddress || "");
      setNotes(eq.notes || "");

      // Location
      if (eq.rack) {
        setSelectedRoomId(eq.rack.roomId);
      }
      setSelectedRackId(eq.rackId || "");
      setRackPosition(eq.rackPosition || "");
      setRackHeight(eq.rackHeight || 1);

      // CPUs
      setCpus(
        eq.cpus.length > 0
          ? eq.cpus.map((c) => ({
              socketIndex: c.socketIndex,
              manufacturer: c.manufacturer || "",
              model: c.model || "",
              cores: c.cores ?? "",
              threads: c.threads ?? "",
              baseFreqMhz: c.baseFreqMhz ?? "",
              maxFreqMhz: c.maxFreqMhz ?? "",
              architecture: c.architecture || "x86_64",
              tdpWatts: c.tdpWatts ?? "",
            }))
          : [
              {
                socketIndex: 0, manufacturer: "", model: "", cores: "",
                threads: "", baseFreqMhz: "", maxFreqMhz: "",
                architecture: "x86_64", tdpWatts: "",
              },
            ]
      );

      setRooms(roomsData);
      setLoading(false);
    }).catch(() => {
      setError("장비 정보를 불러올 수 없습니다.");
      setLoading(false);
    });
  }, [id]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const selectedRack = selectedRoom?.racks.find((r) => r.id === selectedRackId);

  const occupiedUnits = new Set<number>();
  if (selectedRack) {
    for (const eq of selectedRack.equipment) {
      // Exclude current equipment's position
      if (eq.rackPosition === (rackPosition as number)) continue;
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

  function updateCpu(index: number, field: string, value: unknown) {
    setCpus((prev) =>
      prev.map((cpu, i) => (i === index ? { ...cpu, [field]: value } : cpu))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

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

    try {
      const res = await fetch(`/api/equipment/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: hostname || null,
          ipAddress: ipAddress || null,
          type,
          status,
          manufacturer: manufacturer || null,
          model: model || null,
          serialNumber: serialNumber || null,
          assetTag: assetTag || null,
          rackId: selectedRackId || null,
          rackPosition: rackPosition || null,
          rackHeight,
          osType: osType || null,
          osVersion: osVersion || null,
          biosVersion: biosVersion || null,
          bmcIpAddress: bmcIpAddress || null,
          notes: notes || null,
          cpus: cpuData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "수정에 실패했습니다.");
        setSaving(false);
        return;
      }

      router.push(`/infrastructure/${id}`);
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "mb-1 block text-sm font-medium text-gray-300";
  const sectionHeaderClass =
    "flex cursor-pointer items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/infrastructure" className="hover:text-gray-200">Infrastructure</Link>
          <span>/</span>
          <Link href={`/infrastructure/${id}`} className="hover:text-gray-200">{hostname || "Equipment"}</Link>
          <span>/</span>
          <span>Edit</span>
        </div>
        <h1 className="text-2xl font-bold">장비 수정</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <Card>
          <div className={sectionHeaderClass} onClick={() => toggleSection("basic")}>
            <h2 className="text-base font-semibold">기본 정보</h2>
            <span className="text-gray-400">{openSections.has("basic") ? "−" : "+"}</span>
          </div>
          {openSections.has("basic") && (
            <div className="mt-4 grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass}>Hostname</label>
                <input className={inputClass} value={hostname} onChange={(e) => setHostname(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>IP Address</label>
                <input className={inputClass} value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                  {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Manufacturer</label>
                <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Serial Number</label>
                <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Asset Tag</label>
                <input className={inputClass} value={assetTag} onChange={(e) => setAssetTag(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>OS Type</label>
                <input className={inputClass} value={osType} onChange={(e) => setOsType(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>OS Version</label>
                <input className={inputClass} value={osVersion} onChange={(e) => setOsVersion(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>BIOS Version</label>
                <input className={inputClass} value={biosVersion} onChange={(e) => setBiosVersion(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>BMC/IPMI IP</label>
                <input className={inputClass} value={bmcIpAddress} onChange={(e) => setBmcIpAddress(e.target.value)} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className={labelClass}>Notes</label>
                <textarea className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}
        </Card>

        {/* Location */}
        <Card>
          <div className={sectionHeaderClass} onClick={() => toggleSection("location")}>
            <h2 className="text-base font-semibold">위치 (Room → Rack → U)</h2>
            <span className="text-gray-400">{openSections.has("location") ? "−" : "+"}</span>
          </div>
          {openSections.has("location") && (
            <div className="mt-4 space-y-4 px-4 pb-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className={labelClass}>Room</label>
                  <select className={inputClass} value={selectedRoomId} onChange={(e) => { setSelectedRoomId(e.target.value); setSelectedRackId(""); setRackPosition(""); }}>
                    <option value="">-- Select Room --</option>
                    {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Rack</label>
                  <select className={inputClass} value={selectedRackId} onChange={(e) => { setSelectedRackId(e.target.value); setRackPosition(""); }} disabled={!selectedRoomId}>
                    <option value="">-- Select Rack --</option>
                    {selectedRoom?.racks.map((rack) => (
                      <option key={rack.id} value={rack.id}>{rack.name}{rack.rowLabel ? ` (Row ${rack.rowLabel})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>U Position</label>
                  <input type="number" className={inputClass} value={rackPosition} onChange={(e) => setRackPosition(e.target.value ? parseInt(e.target.value) : "")} min={1} max={selectedRack?.totalUnits || 42} disabled={!selectedRackId} />
                </div>
                <div>
                  <label className={labelClass}>Height (U)</label>
                  <select className={inputClass} value={rackHeight} onChange={(e) => setRackHeight(parseInt(e.target.value))}>
                    {[1, 2, 3, 4].map((h) => <option key={h} value={h}>{h}U</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* CPU */}
        <Card>
          <div className={sectionHeaderClass} onClick={() => toggleSection("cpu")}>
            <h2 className="text-base font-semibold">CPU 정보 <Badge variant="info">{cpus.length} sockets</Badge></h2>
            <span className="text-gray-400">{openSections.has("cpu") ? "−" : "+"}</span>
          </div>
          {openSections.has("cpu") && (
            <div className="mt-4 space-y-4 px-4 pb-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setCpus((p) => [...p, { socketIndex: p.length, manufacturer: "", model: "", cores: "", threads: "", baseFreqMhz: "", maxFreqMhz: "", architecture: "x86_64", tdpWatts: "" }])} className="rounded bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600">+ Add Socket</button>
                {cpus.length > 1 && (
                  <button type="button" onClick={() => setCpus((p) => p.slice(0, -1))} className="rounded bg-gray-700 px-3 py-1 text-xs text-red-400 hover:bg-gray-600">Remove Last</button>
                )}
              </div>
              {cpus.map((cpu, i) => (
                <div key={i} className="rounded-lg border border-gray-700 p-4">
                  <p className="mb-3 text-sm font-medium text-gray-300">Socket {i}</p>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div>
                      <label className={labelClass}>Manufacturer</label>
                      <select className={inputClass} value={cpu.manufacturer} onChange={(e) => updateCpu(i, "manufacturer", e.target.value)}>
                        <option value="">--</option>
                        <option value="Intel">Intel</option>
                        <option value="AMD">AMD</option>
                        <option value="ARM">ARM</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Model</label>
                      <input className={inputClass} value={cpu.model} onChange={(e) => updateCpu(i, "model", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Cores</label>
                      <input type="number" className={inputClass} value={cpu.cores} onChange={(e) => updateCpu(i, "cores", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className={labelClass}>Threads</label>
                      <input type="number" className={inputClass} value={cpu.threads} onChange={(e) => updateCpu(i, "threads", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className={labelClass}>Base Freq (MHz)</label>
                      <input type="number" className={inputClass} value={cpu.baseFreqMhz} onChange={(e) => updateCpu(i, "baseFreqMhz", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className={labelClass}>Max Freq (MHz)</label>
                      <input type="number" className={inputClass} value={cpu.maxFreqMhz} onChange={(e) => updateCpu(i, "maxFreqMhz", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className={labelClass}>Architecture</label>
                      <select className={inputClass} value={cpu.architecture} onChange={(e) => updateCpu(i, "architecture", e.target.value)}>
                        <option value="x86_64">x86_64</option>
                        <option value="aarch64">aarch64</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>TDP (Watts)</label>
                      <input type="number" className={inputClass} value={cpu.tdpWatts} onChange={(e) => updateCpu(i, "tdpWatts", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Note about memory editing */}
        <Card>
          <div className="px-4 py-3">
            <p className="text-sm text-gray-400">
              메모리 슬롯 정보는{" "}
              <Link href={`/infrastructure/${id}/memory`} className="text-blue-400 hover:text-blue-300">
                Memory Detail 페이지
              </Link>
              에서 별도 관리합니다.
            </p>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href={`/infrastructure/${id}`} className="rounded-lg border border-gray-700 px-6 py-2.5 text-sm text-gray-300 hover:bg-gray-800">
            취소
          </Link>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
