"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Thermometer, Fan, Zap, RefreshCw, AlertTriangle } from "lucide-react";

interface ThermalSensor {
  name: string;
  readingCelsius: number | null;
  upperCritical: number | null;
  upperFatal: number | null;
  status: string | null;
}

interface FanSensor {
  name: string;
  reading: number | null;
  readingUnits: string | null;
  status: string | null;
}

interface PowerSupply {
  name: string;
  model: string | null;
  capacityWatts: number | null;
  type: string | null;
  status: string | null;
}

interface PowerControl {
  consumedWatts: number | null;
  capacityWatts: number | null;
  limitWatts: number | null;
}

interface SensorsData {
  temperatures: ThermalSensor[];
  fans: FanSensor[];
  powerSupplies: PowerSupply[];
  powerControl: PowerControl | null;
  fetchedAt: string;
}

function tempColor(reading: number | null, critical: number | null): string {
  if (reading === null) return "text-gray-500";
  if (critical && reading >= critical) return "text-red-400";
  if (critical && reading >= critical * 0.85) return "text-amber-400";
  if (reading >= 80) return "text-amber-400";
  return "text-green-400";
}

function tempBarWidth(reading: number | null, critical: number | null): string {
  if (reading === null) return "0%";
  const max = critical || 100;
  return `${Math.min((reading / max) * 100, 100)}%`;
}

function tempBarColor(reading: number | null, critical: number | null): string {
  if (reading === null) return "bg-gray-700";
  if (critical && reading >= critical) return "bg-red-500";
  if (critical && reading >= critical * 0.85) return "bg-amber-500";
  return "bg-green-500";
}

export function BmcSensorsCard({ equipmentId }: { equipmentId: string }) {
  const [data, setData] = useState<SensorsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSensors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/sensors`);
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-orange-400" />
          BMC Sensors (Thermal & Power)
        </h3>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[10px] text-gray-500">
              {new Date(data.fetchedAt).toLocaleTimeString("ko-KR")}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSensors}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            {data ? "Refresh" : "Load Sensors"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-900/20 border border-red-800/40 px-3 py-2 text-sm text-red-400 mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!data && !error && !loading && (
        <p className="text-sm text-gray-500 text-center py-4">
          Load Sensors 버튼을 클릭하여 BMC에서 실시간 센서 데이터를 가져옵니다.
        </p>
      )}

      {loading && !data && (
        <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
      )}

      {data && (
        <div className="space-y-5">
          {/* Power Summary */}
          {data.powerControl && (
            <div className="rounded-lg bg-gray-800/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-yellow-400" />
                <span className="text-xs font-semibold text-gray-300 uppercase">Power Consumption</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-gray-100">
                  {data.powerControl.consumedWatts ?? "—"}
                </span>
                <span className="text-sm text-gray-400 mb-1">W</span>
                {data.powerControl.capacityWatts && (
                  <span className="text-xs text-gray-500 mb-1 ml-2">
                    / {data.powerControl.capacityWatts}W capacity
                  </span>
                )}
              </div>
              {data.powerControl.capacityWatts && data.powerControl.consumedWatts && (
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all"
                      style={{
                        width: `${Math.min(
                          (data.powerControl.consumedWatts / data.powerControl.capacityWatts) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                    <span>0W</span>
                    <span>
                      {Math.round(
                        (data.powerControl.consumedWatts / data.powerControl.capacityWatts) * 100
                      )}%
                    </span>
                    <span>{data.powerControl.capacityWatts}W</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PSU Info */}
          {data.powerSupplies.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> Power Supplies ({data.powerSupplies.length})
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.powerSupplies.map((psu, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-gray-700/60 bg-gray-800/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-300">{psu.name}</span>
                      <span className={`text-[10px] font-medium ${
                        psu.status === "OK" ? "text-green-400" : "text-amber-400"
                      }`}>
                        {psu.status || "—"}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {[psu.model, psu.capacityWatts ? `${psu.capacityWatts}W` : null, psu.type]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Temperatures */}
          {data.temperatures.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                <Thermometer className="h-3 w-3" /> Temperatures ({data.temperatures.length})
              </h4>
              <div className="space-y-1.5">
                {data.temperatures.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-800/40"
                  >
                    <span className="w-36 text-xs text-gray-400 truncate" title={t.name}>
                      {t.name}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${tempBarColor(t.readingCelsius, t.upperCritical)}`}
                        style={{ width: tempBarWidth(t.readingCelsius, t.upperCritical) }}
                      />
                    </div>
                    <span className={`w-12 text-right text-xs font-mono ${tempColor(t.readingCelsius, t.upperCritical)}`}>
                      {t.readingCelsius !== null ? `${t.readingCelsius}°C` : "—"}
                    </span>
                    <span className="w-14 text-right text-[10px] text-gray-600">
                      {t.upperCritical ? `/${t.upperCritical}°C` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fans */}
          {data.fans.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                <Fan className="h-3 w-3" /> Fans ({data.fans.length})
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {data.fans.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-gray-700/60 bg-gray-800/40 px-3 py-2 text-center"
                  >
                    <span className="text-[10px] text-gray-500 block">{f.name}</span>
                    <span className="text-lg font-bold text-gray-200">
                      {f.reading !== null ? f.reading.toLocaleString() : "—"}
                    </span>
                    <span className="text-[10px] text-gray-500 ml-0.5">
                      {f.readingUnits || "RPM"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
