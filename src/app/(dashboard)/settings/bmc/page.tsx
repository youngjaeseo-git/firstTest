"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { RefreshCw, Power, Zap, ChevronLeft, CheckSquare, Square, Minus } from "lucide-react";

interface EquipmentItem {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  bmcIpAddress: string | null;
  status: string;
  manufacturer: string | null;
  model: string | null;
}

interface BulkResultItem {
  equipmentId: string;
  hostname: string | null;
  bmcIp: string | null;
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

interface BulkResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkResultItem[];
}

type ResetType = "On" | "ForceOn" | "ForceOff" | "GracefulShutdown" | "GracefulRestart" | "ForceRestart" | "Nmi" | "PowerCycle";

const POWER_ACTIONS: { type: ResetType; label: string; danger: boolean }[] = [
  { type: "On", label: "Power On", danger: false },
  { type: "GracefulRestart", label: "Graceful Restart", danger: false },
  { type: "GracefulShutdown", label: "Graceful Shutdown", danger: true },
  { type: "ForceRestart", label: "Force Restart", danger: true },
  { type: "ForceOff", label: "Force Off", danger: true },
  { type: "PowerCycle", label: "Power Cycle", danger: true },
];

export default function BmcManagementPage() {
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [powerStates, setPowerStates] = useState<Record<string, string>>({});
  const [lastResults, setLastResults] = useState<BulkResponse | null>(null);
  const [reason, setReason] = useState("");
  const [showPowerPanel, setShowPowerPanel] = useState(false);

  const fetchEquipment = useCallback(async () => {
    try {
      const res = await fetch("/api/equipment?type=SERVER&limit=500");
      const json = await res.json();
      const items: EquipmentItem[] = (json.items || json.equipment || json || [])
        .filter((e: EquipmentItem) => e.bmcIpAddress);
      setEquipment(items);
    } catch {
      toast({ type: "error", title: "Failed to load equipment" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === equipment.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(equipment.map((e) => e.id)));
    }
  };

  const bulkRefreshHw = async () => {
    if (selected.size === 0) return;
    setRunning(true);
    setLastResults(null);
    try {
      const res = await fetch("/api/equipment/bulk-bmc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh-hw",
          equipmentIds: Array.from(selected),
        }),
      });
      const json: BulkResponse = await res.json();
      setLastResults(json);
      toast({
        type: json.failed > 0 ? "warning" : "success",
        title: "Bulk HW Refresh",
        message: `${json.succeeded} succeeded, ${json.failed} failed`,
      });
    } catch {
      toast({ type: "error", title: "Bulk refresh failed", message: "Network error" });
    } finally {
      setRunning(false);
    }
  };

  const bulkPowerAction = async (resetType: ResetType) => {
    if (selected.size === 0 || !reason.trim()) return;
    const confirmed = window.confirm(
      `${selected.size}대의 서버에 "${resetType}" 명령을 실행합니다. 계속하시겠습니까?`
    );
    if (!confirmed) return;

    setRunning(true);
    setLastResults(null);
    try {
      const res = await fetch("/api/equipment/bulk-bmc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "power",
          equipmentIds: Array.from(selected),
          resetType,
          reason: reason.trim(),
        }),
      });
      const json: BulkResponse = await res.json();
      setLastResults(json);
      toast({
        type: json.failed > 0 ? "warning" : "success",
        title: `Bulk ${resetType}`,
        message: `${json.succeeded} succeeded, ${json.failed} failed`,
      });
    } catch {
      toast({ type: "error", title: "Bulk power action failed", message: "Network error" });
    } finally {
      setRunning(false);
    }
  };

  const fetchPowerStates = async () => {
    if (selected.size === 0) return;
    setRunning(true);
    try {
      const res = await fetch("/api/equipment/bulk-bmc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "power-status",
          equipmentIds: Array.from(selected),
        }),
      });
      const json: BulkResponse = await res.json();
      const states: Record<string, string> = {};
      for (const r of json.results) {
        states[r.equipmentId] = r.success
          ? (r.data?.powerState as string) || "Unknown"
          : "Error";
      }
      setPowerStates((prev) => ({ ...prev, ...states }));
      toast({
        type: "success",
        title: "Power states updated",
        message: `${json.succeeded} checked`,
      });
    } catch {
      toast({ type: "error", title: "Failed to check power states" });
    } finally {
      setRunning(false);
    }
  };

  const allSelected = equipment.length > 0 && selected.size === equipment.length;
  const someSelected = selected.size > 0 && selected.size < equipment.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/settings" className="hover:text-gray-200 flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" />
            Settings
          </Link>
          <span>/</span>
          <span>BMC Management</span>
        </div>
        <h1 className="text-2xl font-bold">BMC 일괄 관리</h1>
        <p className="mt-1 text-sm text-gray-400">
          BMC가 설정된 서버의 하드웨어 정보 갱신 및 전원 제어를 일괄 수행합니다.
        </p>
      </div>

      {/* Action bar */}
      <Card className="sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-300">
            <span className="font-bold text-blue-400">{selected.size}</span>
            <span className="text-gray-500"> / {equipment.length} selected</span>
          </span>
          <div className="h-5 w-px bg-gray-700" />
          <Button
            variant="outline"
            size="sm"
            onClick={bulkRefreshHw}
            disabled={selected.size === 0 || running}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            Refresh HW ({selected.size})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPowerStates}
            disabled={selected.size === 0 || running}
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Check Power
          </Button>
          <Button
            variant={showPowerPanel ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPowerPanel(!showPowerPanel)}
            disabled={selected.size === 0}
          >
            <Power className="mr-1.5 h-3.5 w-3.5" />
            Power Control
          </Button>
        </div>
      </Card>

      {/* Power control panel */}
      {showPowerPanel && selected.size > 0 && (
        <Card className="border-amber-600/30 bg-amber-500/5">
          <p className="text-sm font-medium text-amber-300 mb-3">
            Power Control — {selected.size}대 선택됨
          </p>
          <div className="mb-3">
            <label className="text-xs text-gray-400 block mb-1">사유 (필수, 3자 이상)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Scheduled maintenance, firmware update..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {POWER_ACTIONS.map((act) => (
              <Button
                key={act.type}
                variant="outline"
                size="sm"
                disabled={running || reason.trim().length < 3}
                onClick={() => bulkPowerAction(act.type)}
                className={act.danger ? "border-red-700/50 text-red-400 hover:bg-red-900/30" : ""}
              >
                {act.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Results panel */}
      {lastResults && (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-medium text-gray-200">Results</h3>
            <span className="text-xs text-green-400">{lastResults.succeeded} OK</span>
            {lastResults.failed > 0 && (
              <span className="text-xs text-red-400">{lastResults.failed} Failed</span>
            )}
            <button
              onClick={() => setLastResults(null)}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300"
            >
              Close
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {lastResults.results.map((r) => (
              <div
                key={r.equipmentId}
                className={`flex items-center justify-between rounded px-3 py-1.5 text-xs ${
                  r.success ? "bg-green-900/20" : "bg-red-900/20"
                }`}
              >
                <span className="font-mono text-gray-300">{r.hostname || r.equipmentId}</span>
                <span className="text-gray-500">{r.bmcIp}</span>
                {r.success ? (
                  <span className="text-green-400">
                    {r.data?.manufacturer
                      ? `${r.data.manufacturer} ${r.data.model || ""}`
                      : r.data?.powerState
                        ? String(r.data.powerState)
                        : r.data?.resetType
                          ? String(r.data.resetType)
                          : "OK"}
                  </span>
                ) : (
                  <span className="text-red-400">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Equipment list */}
      <Card>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : equipment.length === 0 ? (
          <p className="text-gray-500 text-sm">BMC IP가 설정된 서버가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-3 w-8">
                    <button onClick={selectAll} className="text-gray-400 hover:text-gray-200">
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : someSelected ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="pb-2 pr-3">Hostname</th>
                  <th className="pb-2 pr-3">IP</th>
                  <th className="pb-2 pr-3">BMC IP</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Model</th>
                  <th className="pb-2 pr-3">Power</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr
                    key={eq.id}
                    onClick={() => toggleSelect(eq.id)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                      selected.has(eq.id)
                        ? "bg-blue-900/20"
                        : "hover:bg-gray-800/30"
                    }`}
                  >
                    <td className="py-2 pr-3">
                      {selected.has(eq.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-600" />
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-gray-200">{eq.hostname || "-"}</td>
                    <td className="py-2 pr-3 font-mono text-gray-400">{eq.ipAddress || "-"}</td>
                    <td className="py-2 pr-3 font-mono text-gray-400">{eq.bmcIpAddress}</td>
                    <td className="py-2 pr-3"><StatusBadge status={eq.status} /></td>
                    <td className="py-2 pr-3 text-gray-400 truncate max-w-[200px]">
                      {eq.manufacturer && eq.model
                        ? `${eq.manufacturer} ${eq.model}`
                        : eq.model || eq.manufacturer || "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {powerStates[eq.id] ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            powerStates[eq.id] === "On"
                              ? "bg-green-900/40 text-green-400"
                              : powerStates[eq.id] === "Off"
                                ? "bg-gray-800 text-gray-400"
                                : "bg-yellow-900/40 text-yellow-400"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            powerStates[eq.id] === "On" ? "bg-green-400" : "bg-gray-500"
                          }`} />
                          {powerStates[eq.id]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
