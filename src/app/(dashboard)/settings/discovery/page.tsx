"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Target {
  id: string;
  instance: string;
  job: string;
  hostname: string | null;
  health: string;
  lastSeen: string;
  equipmentId: string | null;
  labels: Record<string, string> | null;
}

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  targets: Target[];
}

export default function DiscoveryPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  async function handleSync() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/discovery/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "동기화 실패");
        setSyncing(false);
        return;
      }
      const result: SyncResult = await res.json();
      setLastSync(result);
      setTargets(result.targets || []);
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.");
    }
    setSyncing(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prometheus Discovery</h1>
        <p className="mt-1 text-sm text-gray-400">
          Prometheus 서버에서 타겟을 자동 탐지하고 장비와 연결합니다.
        </p>
      </div>

      {/* Sync Action */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">타겟 동기화</p>
            <p className="mt-1 text-sm text-gray-400">
              Prometheus /api/v1/targets 엔드포인트에서 활성 타겟을 가져옵니다.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "동기화 중..." : "동기화 실행"}
          </button>
        </div>
      </Card>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sync Result */}
      {lastSync && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-400">Total Synced</p>
            <p className="mt-1 text-2xl font-bold text-blue-400">
              {lastSync.synced}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-400">New Targets</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              {lastSync.created}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-400">Updated</p>
            <p className="mt-1 text-2xl font-bold text-yellow-400">
              {lastSync.updated}
            </p>
          </Card>
        </div>
      )}

      {/* Target List */}
      {targets.length > 0 && (
        <Card>
          <p className="mb-3 text-sm font-medium text-gray-400">
            Discovered Targets ({targets.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">Instance</th>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Hostname</th>
                  <th className="px-3 py-2">Health</th>
                  <th className="px-3 py-2">Last Seen</th>
                  <th className="px-3 py-2">Linked Equipment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {targets.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {t.instance}
                    </td>
                    <td className="px-3 py-2">{t.job}</td>
                    <td className="px-3 py-2">{t.hostname || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          t.health === "up"
                            ? "active"
                            : t.health === "down"
                              ? "critical"
                              : "info"
                        }
                      >
                        {t.health}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {new Date(t.lastSeen).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-2">
                      {t.equipmentId ? (
                        <Badge variant="active">Linked</Badge>
                      ) : (
                        <span className="text-gray-500">Not linked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
