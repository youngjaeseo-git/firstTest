"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import { History } from "lucide-react";
import { useT } from "@/lib/i18n/i18n-context";

interface AlertRow {
  id: string;
  status: string;
  severity: string;
  category: string | null;
  summary: string;
  details: string | null;
  source: string | null;
  firedAt: string;
  resolvedAt: string | null;
  rule: { name: string } | null;
}

const SEVERITIES = ["CRITICAL", "WARNING", "INFO"] as const;
const STATUSES = ["FIRING", "RESOLVED", "ACKNOWLEDGED"] as const;
const DATE_RANGES = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "All", value: "all" },
] as const;

const PAGE_SIZE = 25;

function formatDuration(firedAt: string, resolvedAt: string | null): string {
  if (!resolvedAt) return "-";
  const ms = new Date(resolvedAt).getTime() - new Date(firedAt).getTime();
  if (ms < 0) return "-";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getDateRangeFilter(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export default function AlertHistoryPage() {
  const t = useT();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState("all");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // Categories extracted from all alerts for filter dropdown
  const [allCategories, setAllCategories] = useState<string[]>([]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (severity) params.set("severity", severity);
      if (status) params.set("status", status);
      if (category) params.set("category", category);

      const res = await fetch(`/api/alerts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.items);
        setTotal(data.total);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [page, severity, status, category]);

  // Load categories once
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/alerts?limit=1000");
        if (res.ok) {
          const data = await res.json();
          const cats = new Set<string>();
          data.items.forEach((a: AlertRow) => {
            if (a.category) cats.add(a.category);
          });
          setAllCategories(Array.from(cats).sort());
        }
      } catch {
        // ignore
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [severity, status, category, dateRange]);

  // Client-side date range filtering (since API doesn't support date params)
  const filteredAlerts = useMemo(() => {
    const rangeStart = getDateRangeFilter(dateRange);
    if (!rangeStart) return alerts;
    return alerts.filter((a) => new Date(a.firedAt) >= rangeStart);
  }, [alerts, dateRange]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectClass =
    "rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  const hasActiveFilter = !!(severity || status || category || dateRange !== "all");

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Breadcrumb & Header */}
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/alerts" className="hover:text-gray-200">
            {t("alertHistory.breadcrumb.alerts")}
          </Link>
          <span>/</span>
          <span>{t("alertHistory.breadcrumb.history")}</span>
        </div>
        <PageHeader
          icon={History}
          title="Alert History"
          subtitle="All alert records with filtering and pagination"
          accent="red"
          right={
            <Link
              href="/alerts"
              className="rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm font-medium text-gray-200 hover:border-blue-500/50 hover:text-blue-300 transition-all"
            >
              Back to Alerts
            </Link>
          }
        />

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Filters
            </span>

            {/* Date Range */}
            <div className="flex items-center gap-1.5">
              {DATE_RANGES.map((dr) => (
                <button
                  key={dr.value}
                  onClick={() => setDateRange(dr.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    dateRange === dr.value
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-gray-700 bg-gray-800 text-gray-300 hover:border-blue-500/50 hover:text-blue-300"
                  }`}
                >
                  {dr.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-gray-700" />

            {/* Severity */}
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className={selectClass}
            >
              <option value="">All Severity</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClass}
            >
              <option value="">All Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Category */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
            >
              <option value="">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {hasActiveFilter && (
              <button
                onClick={() => {
                  setDateRange("all");
                  setSeverity("");
                  setStatus("");
                  setCategory("");
                }}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </Card>

        {/* Results info */}
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {total} total alert{total !== 1 ? "s" : ""}
            {hasActiveFilter && ` (showing ${filteredAlerts.length} on this page)`}
          </span>
          <span>
            Page {page} of {totalPages}
          </span>
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {hasActiveFilter
                ? "No alerts match the selected filters."
                : "No alert history found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Summary</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-300">
                        {formatDateTime(alert.firedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={alert.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            alert.status === "FIRING"
                              ? "critical"
                              : alert.status === "ACKNOWLEDGED"
                                ? "warning"
                                : "active"
                          }
                        >
                          {alert.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-200 max-w-md truncate">
                          {alert.summary}
                        </p>
                        {alert.details && (
                          <p className="mt-0.5 text-xs text-gray-500 max-w-md truncate">
                            {alert.details}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                        {alert.source || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {alert.category ? (
                          <Badge variant="info">{alert.category}</Badge>
                        ) : (
                          <span className="text-xs text-gray-600">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                        {formatDuration(alert.firedAt, alert.resolvedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:border-blue-500/50 hover:text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                // Show first, last, and pages near current
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - page) <= 2) return true;
                return false;
              })
              .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                if (i > 0 && arr[i - 1] !== undefined && p - (arr[i - 1] as number) > 1) {
                  acc.push("ellipsis");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-600">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      page === item
                        ? "border-blue-500 bg-blue-500/20 text-blue-300"
                        : "border-gray-700 bg-gray-800 text-gray-300 hover:border-blue-500/50 hover:text-blue-300"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:border-blue-500/50 hover:text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
