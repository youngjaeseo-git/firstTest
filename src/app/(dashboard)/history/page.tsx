"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import {
  History,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  X,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Zap,
  ArrowRightLeft,
  Wrench,
  CheckCircle,
  Shield,
  ChevronLeft,
} from "lucide-react";

interface AuditUser {
  name: string | null;
  email: string;
}

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  reason: string | null;
  ticketRef: string | null;
  createdAt: string;
  user: AuditUser | null;
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string; labelKo: string }> = {
  CREATE:           { icon: Plus,            color: "text-green-400 bg-green-500/15",  label: "Created",       labelKo: "생성" },
  UPDATE:           { icon: Pencil,          color: "text-blue-400 bg-blue-500/15",    label: "Updated",       labelKo: "수정" },
  DELETE:           { icon: Trash2,          color: "text-red-400 bg-red-500/15",      label: "Deleted",       labelKo: "삭제" },
  STATUS_CHANGE:    { icon: ArrowRightLeft,  color: "text-yellow-400 bg-yellow-500/15",label: "Status Change", labelKo: "상태 변경" },
  POWER_ACTION:     { icon: Zap,             color: "text-orange-400 bg-orange-500/15",label: "Power Action",  labelKo: "전원 작업" },
  RACK_MOVE:        { icon: ArrowRightLeft,  color: "text-purple-400 bg-purple-500/15",label: "Rack Move",     labelKo: "랙 이동" },
  MAINTENANCE_START:{ icon: Wrench,          color: "text-amber-400 bg-amber-500/15",  label: "Maint. Start",  labelKo: "유지보수 시작" },
  MAINTENANCE_END:  { icon: CheckCircle,     color: "text-green-400 bg-green-500/15",  label: "Maint. End",    labelKo: "유지보수 종료" },
  BULK_POWER:       { icon: Zap,             color: "text-orange-400 bg-orange-500/15",label: "Bulk Power",    labelKo: "일괄 전원" },
  BULK_REFRESH_HW:  { icon: RotateCcw,       color: "text-cyan-400 bg-cyan-500/15",    label: "Bulk HW Refresh",labelKo: "일괄 HW 갱신" },
  BULK_CREATE:      { icon: Plus,            color: "text-green-400 bg-green-500/15",  label: "Bulk Create",   labelKo: "일괄 생성" },
};

const DATE_RANGES = [
  { key: "today", label: "Today", labelKo: "오늘", days: 0 },
  { key: "7d", label: "7 Days", labelKo: "7일", days: 7 },
  { key: "30d", label: "30 Days", labelKo: "30일", days: 30 },
  { key: "all", label: "All", labelKo: "전체", days: -1 },
];

function formatDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function ChangesDisplay({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {Object.entries(changes).map(([key, val]) => {
        if (val && typeof val === "object" && "from" in (val as Record<string, unknown>)) {
          const v = val as { from: unknown; to: unknown };
          return (
            <div key={key} className="text-[10px] text-gray-500">
              <span className="text-gray-400">{key}:</span>{" "}
              <span className="text-red-400/70 line-through">{String(v.from ?? "null")}</span>
              {" → "}
              <span className="text-green-400/70">{String(v.to ?? "null")}</span>
            </div>
          );
        }
        return (
          <div key={key} className="text-[10px] text-gray-500">
            <span className="text-gray-400">{key}:</span> {typeof val === "object" ? JSON.stringify(val) : String(val ?? "")}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditHistoryPage() {
  const t = useT();
  const isKo = t("nav.dashboard") === "대시보드";
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);

  const [dateRange, setDateRange] = useState("30d");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const limit = 50;

  const getDateParams = useCallback(() => {
    const range = DATE_RANGES.find((r) => r.key === dateRange);
    if (!range || range.days < 0) return {};
    const now = new Date();
    if (range.days === 0) {
      return { from: now.toISOString().slice(0, 10) };
    }
    const from = new Date(now);
    from.setDate(from.getDate() - range.days);
    return { from: from.toISOString().slice(0, 10) };
  }, [dateRange]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (actionFilter) params.set("action", actionFilter);
    if (entityFilter) params.set("entityType", entityFilter);
    if (userFilter) params.set("userId", userFilter);
    const dateParams = getDateParams();
    if (dateParams.from) params.set("from", dateParams.from);

    const res = await fetch(`/api/audit-logs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.items);
      setTotal(data.total);
      if (data.users) setUsers(data.users);
    }
    setLoading(false);
  }, [page, actionFilter, entityFilter, userFilter, getDateParams]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, actionFilter, entityFilter, userFilter]);

  const groupedByDate: Record<string, AuditLogEntry[]> = {};
  for (const log of logs) {
    const dk = formatDateKey(log.createdAt);
    if (!groupedByDate[dk]) groupedByDate[dk] = [];
    groupedByDate[dk].push(log);
  }
  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const toggleDate = (dk: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dk)) next.delete(dk);
      else next.add(dk);
      return next;
    });
  };

  const totalPages = Math.ceil(total / limit);

  const hasFilters = actionFilter || entityFilter || userFilter;
  const clearFilters = () => {
    setActionFilter("");
    setEntityFilter("");
    setUserFilter("");
  };

  const handleExportCsv = () => {
    const dateParams = getDateParams();
    const params = new URLSearchParams();
    if (dateParams.from) params.set("from", dateParams.from);
    window.open(`/api/audit-logs/export?${params}`, "_blank");
  };

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));
  const uniqueEntities = Array.from(new Set(logs.map((l) => l.entityType)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-500/15 p-2">
            <History className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">
              {isKo ? "감사 로그" : "Audit History"}
            </h1>
            <p className="text-xs text-gray-500">
              {isKo ? "시스템 전체 변경 이력" : "System-wide change history"}
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          {isKo ? "CSV 내보내기" : "Export CSV"}
        </button>
      </div>

      {/* Filters */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-400">
            {isKo ? "필터" : "Filters"}
          </span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300">
              <X className="h-3 w-3" /> {isKo ? "초기화" : "Clear"}
            </button>
          )}
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setDateRange(r.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                dateRange === r.key
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800",
              )}
            >
              {isKo ? r.labelKo : r.label}
            </button>
          ))}
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">{isKo ? "모든 액션" : "All Actions"}</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {ACTION_CONFIG[a]?.[isKo ? "labelKo" : "label"] || a}
              </option>
            ))}
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">{isKo ? "모든 대상" : "All Entities"}</option>
            {uniqueEntities.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">{isKo ? "모든 사용자" : "All Users"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Results info */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {total} {isKo ? "건" : "entries"}
          {total > limit && ` (${isKo ? "페이지" : "page"} ${page}/${totalPages})`}
        </span>
      </div>

      {/* Log entries grouped by date */}
      {loading ? (
        <Card>
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400" />
          </div>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Shield className="h-8 w-8 mb-2 text-gray-600" />
            <p className="text-sm">{isKo ? "감사 로그가 없습니다" : "No audit entries found"}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {dateKeys.map((dk) => {
            const entries = groupedByDate[dk];
            const collapsed = collapsedDates.has(dk);
            return (
              <Card key={dk} className="overflow-hidden">
                <button
                  onClick={() => toggleDate(dk)}
                  className="flex w-full items-center justify-between py-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    {collapsed ? (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="text-sm font-medium text-gray-200">
                      {formatDateLabel(dk)}
                    </span>
                    <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                      {entries.length}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-600">{dk}</span>
                </button>

                {!collapsed && (
                  <div className="mt-2 divide-y divide-gray-800">
                    {entries.map((log) => {
                      const cfg = ACTION_CONFIG[log.action] || {
                        icon: History,
                        color: "text-gray-400 bg-gray-500/15",
                        label: log.action,
                        labelKo: log.action,
                      };
                      const Icon = cfg.icon;
                      return (
                        <div key={log.id} className="flex gap-3 py-2.5">
                          <div className={cn("mt-0.5 rounded-md p-1.5 h-fit", cfg.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-medium", cfg.color.split(" ")[0])}>
                                {isKo ? cfg.labelKo : cfg.label}
                              </span>
                              <span className="rounded bg-gray-700/80 px-1.5 py-0.5 text-[10px] text-gray-400">
                                {log.entityType}
                              </span>
                              <span className="truncate font-mono text-[10px] text-gray-500">
                                {log.entityId.length > 20 ? log.entityId.slice(0, 8) + "..." : log.entityId}
                              </span>
                            </div>
                            {log.reason && (
                              <p className="mt-0.5 text-[11px] text-gray-400">{log.reason}</p>
                            )}
                            <ChangesDisplay changes={log.changes as Record<string, unknown> | null} />
                          </div>
                          <div className="flex flex-col items-end gap-0.5 text-[10px] text-gray-500 shrink-0">
                            <span>{formatTime(log.createdAt)}</span>
                            <span className="text-gray-600">
                              {log.user?.name || log.user?.email || "system"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  page === pageNum
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800",
                )}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
