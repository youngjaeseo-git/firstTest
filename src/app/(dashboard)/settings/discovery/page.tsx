"use client";

import { useState, useEffect } from "react";
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
  equipmentHostname: string | null;
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
  const [registering, setRegistering] = useState<string | null>(null);
  const [filterJob, setFilterJob] = useState<string>("all");
  const [filterHealth, setFilterHealth] = useState<string>("all");
  const [filterLinked, setFilterLinked] = useState<string>("all");

  useEffect(() => {
    loadTargets();
  }, []);

  async function loadTargets() {
    try {
      const res = await fetch("/api/discovery/targets");
      if (res.ok) {
        const data = await res.json();
        setTargets(data.targets || []);
      }
    } catch {}
  }

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

  async function handleRegister(targetId: string) {
    setRegistering(targetId);
    try {
      const res = await fetch("/api/discovery/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTargets((prev) =>
          prev.map((t) =>
            t.id === targetId
              ? { ...t, equipmentId: data.equipment.id, equipmentHostname: data.equipment.hostname }
              : t,
          ),
        );
      } else {
        const data = await res.json();
        setError(data.error || "등록 실패");
      }
    } catch {
      setError("등록 중 오류 발생");
    }
    setRegistering(null);
  }

  const jobs = Array.from(new Set(targets.map((t) => t.job))).sort();

  const filtered = targets.filter((t) => {
    if (filterJob !== "all" && t.job !== filterJob) return false;
    if (filterHealth !== "all" && t.health !== filterHealth) return false;
    if (filterLinked === "linked" && !t.equipmentId) return false;
    if (filterLinked === "unlinked" && t.equipmentId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prometheus Discovery</h1>
        <p className="mt-1 text-sm text-gray-400">
          Prometheus 서버에서 타겟을 자동 탐지하고 장비로 등록합니다.
        </p>
      </div>

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

      {targets.length > 0 && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-gray-400">
              Targets ({filtered.length} / {targets.length})
            </p>
            <select
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
            >
              <option value="all">All Jobs</option>
              {jobs.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <select
              value={filterHealth}
              onChange={(e) => setFilterHealth(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
            >
              <option value="all">All Health</option>
              <option value="up">UP</option>
              <option value="down">DOWN</option>
            </select>
            <select
              value={filterLinked}
              onChange={(e) => setFilterLinked(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Not Linked</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">Instance</th>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Health</th>
                  <th className="px-3 py-2">Last Seen</th>
                  <th className="px-3 py-2">Equipment</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.slice(0, 100).map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {t.instance}
                    </td>
                    <td className="px-3 py-2 text-xs">{t.job}</td>
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
                        <a
                          href={`/infrastructure/${t.equipmentId}`}
                          className="text-blue-400 hover:underline"
                        >
                          {t.equipmentHostname || "Linked"}
                        </a>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {t.equipmentId ? (
                        <Badge variant="active">Registered</Badge>
                      ) : (
                        <button
                          onClick={() => handleRegister(t.id)}
                          disabled={registering === t.id}
                          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {registering === t.id ? "..." : "Register"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p className="mt-2 text-center text-xs text-gray-500">
                Showing first 100 of {filtered.length} targets. Use filters to narrow down.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
