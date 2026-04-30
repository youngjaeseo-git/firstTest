"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { MemoryEditor } from "@/components/memory/memory-editor";

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

interface ApiMemory {
  slotName: string;
  slotIndex: number;
  populated: boolean;
  capacityGb: number | null;
  memoryType: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  serialNumber: string | null;
  speedMhz: number | null;
  currentSpeedMhz: number | null;
  rank: number | null;
  eccEnabled: boolean | null;
  formFactor: string | null;
  voltage: number | null;
}

export default function MemoryEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hostname, setHostname] = useState("");
  const [memories, setMemories] = useState<MemorySlot[]>([]);

  useEffect(() => {
    fetch(`/api/equipment/${id}/memory`)
      .then((r) => r.json())
      .then((data: { memories: ApiMemory[] }) => {
        setMemories(
          data.memories.map((m) => ({
            slotName: m.slotName,
            populated: m.populated,
            capacityGb: m.capacityGb,
            memoryType: m.memoryType || "",
            manufacturer: m.manufacturer || "",
            partNumber: m.partNumber || "",
            serialNumber: m.serialNumber || "",
            speedMhz: m.speedMhz,
            currentSpeedMhz: m.currentSpeedMhz,
            rank: m.rank,
            eccEnabled: m.eccEnabled,
            formFactor: m.formFactor || "",
            voltage: m.voltage,
          }))
        );
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load memory data.");
        setLoading(false);
      });

    fetch(`/api/equipment/${id}`)
      .then((r) => r.json())
      .then((eq: { hostname: string | null }) => {
        setHostname(eq.hostname || "Equipment");
      })
      .catch(() => {});
  }, [id]);

  async function handleSave(slots: MemorySlot[]) {
    setError("");
    setSaving(true);
    try {
      const payload = slots.map((s) => ({
        slotName: s.slotName,
        populated: s.populated,
        capacityGb: s.populated ? s.capacityGb : null,
        memoryType: s.populated && s.memoryType ? s.memoryType : null,
        manufacturer: s.populated && s.manufacturer ? s.manufacturer : null,
        partNumber: s.populated && s.partNumber ? s.partNumber : null,
        serialNumber: s.populated && s.serialNumber ? s.serialNumber : null,
        speedMhz: s.populated ? s.speedMhz : null,
        currentSpeedMhz: s.populated ? s.currentSpeedMhz : null,
        rank: s.populated ? s.rank : null,
        eccEnabled: s.populated ? s.eccEnabled : null,
        formFactor: s.populated && s.formFactor ? s.formFactor : null,
        voltage: s.populated ? s.voltage : null,
      }));

      const res = await fetch(`/api/equipment/${id}/memory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memories: payload }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save.");
        setSaving(false);
        return;
      }

      router.push(`/infrastructure/${id}/memory`);
    } catch {
      setError("Network error while saving.");
      setSaving(false);
    }
  }

  function handleCancel() {
    router.push(`/infrastructure/${id}/memory`);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/infrastructure" className="hover:text-gray-200">Infrastructure</Link>
          <span>/</span>
          <Link href={`/infrastructure/${id}`} className="hover:text-gray-200">{hostname}</Link>
          <span>/</span>
          <Link href={`/infrastructure/${id}/memory`} className="hover:text-gray-200">Memory</Link>
          <span>/</span>
          <span>Edit</span>
        </div>
        <h1 className="text-2xl font-bold">Edit Memory Configuration</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <MemoryEditor
        equipmentId={id}
        initialMemories={memories}
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saving}
      />
    </div>
  );
}
