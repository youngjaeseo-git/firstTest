"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/i18n-context";

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
  const t = useT();
  const [targets, setTargets] = useState<Target[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState<string | null>(null);
  const [unregistering, setUnregistering] = useState<string | null>(null);
  const [filterJob, setFilterJob] = useState<string>("all");
  const [filterHealth, setFilterHealth] = useState<string>("all");
  const [filterLinked, setFilterLinked] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

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
        setError(data.error || t("discovery.syncFail"));
        setSyncing(false);
        return;
      }
      const result: SyncResult = await res.json();
      setLastSync(result);
      setTargets(result.targets || []);
    } catch {
      setError(t("common.serverError"));
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
        setError(data.error || t("discovery.registerFail"));
      }
    } catch {
      setError(t("discovery.registerError"));
    }
    setRegistering(null);
  }

  async function handleUnregister(targetId: string) {
    if (!confirm(t("discovery.unregisterConfirm"))) return;
    setUnregistering(targetId);
    try {
      const res = await fetch("/api/discovery/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (res.ok) {
        setTargets((prev) =>
          prev.map((t) =>
            t.id === targetId ? { ...t, equipmentId: null, equipmentHostname: null } : t,
          ),
        );
      } else {
        const data = await res.json();
        setError(data.error || t("discovery.unregisterFail"));
      }
    } catch {
      setError(t("discovery.unregisterError"));
    }
    setUnregistering(null);
  }

  const jobs = Array.from(new Set(targets.map((t) => t.job))).sort();

  const filtered = targets.filter((t) => {
    if (filterJob !== "all" && t.job !== filterJob) return false;
    if (filterHealth !== "all" && t.health !== filterHealth) return false;
    if (filterLinked === "linked" && !t.equipmentId) return false;
    if (filterLinked === "unlinked" && t.equipmentId) return false;
    if (search && !t.instance.toLowerCase().includes(search.toLowerCase()) && !(t.hostname || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("discovery.title")}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {t("discovery.description")}
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t("discovery.syncTitle")}</p>
            <p className="mt-1 text-sm text-gray-400">
              {t("discovery.syncDesc")}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? t("discovery.syncing") : t("discovery.syncRun")}
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
            <p className="text-sm text-gray-400">{t("discovery.totalSynced")}</p>
            <p className="mt-1 text-2xl font-bold text-blue-400">
              {lastSync.synced}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-400">{t("discovery.newTargets")}</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              {lastSync.created}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-400">{t("discovery.updated")}</p>
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
              {t("discovery.targets")} ({filtered.length} / {targets.length})
            </p>
            <select
              value={filterJob}
              onChange={(e) => { setFilterJob(e.target.value); setPage(0); }}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
            >
              <option value="all">{t("discovery.allJobs")}</option>
              {jobs.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <select
              value={filterHealth}
              onChange={(e) => { setFilterHealth(e.target.value); setPage(0); }}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
            >
              <option value="all">{t("discovery.allHealth")}</option>
              <option value="up">UP</option>
              <option value="down">DOWN</option>
            </select>
            <select
              value={filterLinked}
              onChange={(e) => { setFilterLinked(e.target.value); setPage(0); }}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
            >
              <option value="all">{t("common.all")}</option>
              <option value="linked">{t("discovery.linked")}</option>
              <option value="unlinked">{t("discovery.notLinked")}</option>
            </select>
            <input
              type="text"
              placeholder={t("discovery.searchPlaceholder")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 w-48"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">{t("discovery.instance")}</th>
                  <th className="px-3 py-2">{t("discovery.job")}</th>
                  <th className="px-3 py-2">{t("discovery.health")}</th>
                  <th className="px-3 py-2">{t("discovery.lastSeen")}</th>
                  <th className="px-3 py-2">{t("discovery.linked")}</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {paged.map((target) => (
                  <tr key={target.id}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {target.instance}
                    </td>
                    <td className="px-3 py-2 text-xs">{target.job}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          target.health === "up"
                            ? "active"
                            : target.health === "down"
                              ? "critical"
                              : "info"
                        }
                      >
                        {target.health}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {new Date(target.lastSeen).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {target.equipmentId ? (
                        <a
                          href={`/infrastructure/${target.equipmentId}`}
                          className="text-blue-400 hover:underline"
                        >
                          {target.equipmentHostname || t("discovery.linked")}
                        </a>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {target.equipmentId ? (
                        <button
                          onClick={() => handleUnregister(target.id)}
                          disabled={unregistering === target.id}
                          className="rounded bg-red-600/80 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {unregistering === target.id ? "..." : t("discovery.unregister")}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRegister(target.id)}
                          disabled={registering === target.id}
                          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {registering === target.id ? "..." : t("discovery.register")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-40"
                >
                  ← {t("common.prev")}
                </button>
                <span className="text-xs text-gray-400">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-40"
                >
                  {t("common.next")} →
                </button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
