"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/i18n-context";
import { Users, Search, Clock, Server, MapPin, Target, History } from "lucide-react";

interface AssignmentItem {
  id: string;
  assignedTo: string;
  purpose: string | null;
  assignedAt: string;
  releasedAt: string | null;
  notes: string | null;
  equipment: {
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    model: string | null;
    status: string;
    type: string;
    rack: {
      name: string;
      room: { name: string };
    } | null;
  };
}

export default function AssignmentsPage() {
  const t = useT();
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showHistory) params.set("history", "true");
      const res = await fetch(`/api/assignments?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [showHistory]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((a) =>
      [a.assignedTo, a.purpose, a.equipment.hostname, a.equipment.ipAddress, a.equipment.model, a.equipment.rack?.name, a.equipment.rack?.room?.name]
        .some((f) => f?.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, AssignmentItem[]>();
    for (const item of filtered) {
      const key = item.assignedTo;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const daysSince = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const uniqueUsers = new Set(items.map((a) => a.assignedTo)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title={t("assignment.pageTitle")}
        subtitle={
          showHistory
            ? `${filtered.length} ${t("assignment.records")}`
            : `${filtered.length} ${t("assignment.activeAssignments")} · ${uniqueUsers} ${t("assignment.users")}`
        }
        accent="violet"
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("assignment.searchPlaceholder")}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 pl-10 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-1">
          <button
            onClick={() => setShowHistory(false)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${!showHistory ? "bg-violet-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
          >
            <Users className="h-3.5 w-3.5" />
            {t("assignment.activeTab")}
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${showHistory ? "bg-violet-600 text-white" : "text-gray-400 hover:text-gray-200"}`}
          >
            <History className="h-3.5 w-3.5" />
            {t("assignment.historyTab")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-600" />
          <p className="mt-2 text-gray-500">
            {showHistory
              ? t("assignment.noHistory")
              : t("assignment.noActive")}
          </p>
        </Card>
      ) : showHistory ? (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-gray-400">
                <th className="px-4 py-3 font-medium">{t("assignment.user")}</th>
                <th className="px-4 py-3 font-medium">{t("assignment.server")}</th>
                <th className="px-4 py-3 font-medium">{t("assignment.purpose")}</th>
                <th className="px-4 py-3 font-medium">{t("assignment.period")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((a) => (
                <tr key={a.id} className="text-gray-300 hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-200">{a.assignedTo}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/servers/${a.equipment.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {a.equipment.hostname || a.equipment.ipAddress || a.equipment.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{a.purpose || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {formatDate(a.assignedAt)} ~ {a.releasedAt ? formatDate(a.releasedAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([userName, assignments]) => (
            <Card key={userName} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-violet-300 text-sm font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{userName}</h3>
                  <p className="text-xs text-gray-500">
                    {assignments.length} {t("assignment.serversInUse")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {assignments.map((a) => (
                  <Link
                    key={a.id}
                    href={`/servers/${a.equipment.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/30 px-3 py-2 hover:border-gray-600 hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Server className="h-4 w-4 text-gray-500" />
                      <div>
                        <span className="text-sm font-medium text-gray-200">
                          {a.equipment.hostname || a.equipment.ipAddress}
                        </span>
                        {a.equipment.model && (
                          <span className="ml-2 text-xs text-gray-500">{a.equipment.model}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.purpose && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Target className="h-3 w-3" />
                          {a.purpose}
                        </span>
                      )}
                      {a.equipment.rack && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {a.equipment.rack.room.name} / {a.equipment.rack.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="h-3 w-3" />
                        {daysSince(a.assignedAt)}{t("assignment.daysAgo")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
