"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { X, Check, CheckCheck, Trash2, BellOff } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n/i18n-context";
import { useToast } from "@/components/ui/toast";

interface AckInfo {
  ackedAt: string;
  note: string | null;
  user: { name: string | null; email: string } | null;
}

interface AlertRow {
  id: string;
  status: string;
  severity: string;
  category: string | null;
  summary: string;
  details: string | null;
  source: string | null;
  firedAt: string;
  suppressed?: boolean;
  acknowledgement?: AckInfo[];
}

interface AlertsPageClientProps {
  alerts: AlertRow[];
  canAcknowledge?: boolean;
  isAdmin?: boolean;
  maintenanceActive?: boolean;
}

export function AlertsPageClient({ alerts, canAcknowledge = false, isAdmin = false, maintenanceActive = false }: AlertsPageClientProps) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleAck(alertId: string, action: "acknowledge" | "resolve") {
    setProcessing(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ type: "error", title: t("ack.failed"), message: body.error });
        return;
      }
      toast({
        type: "success",
        title: action === "acknowledge" ? t("ack.acknowledged") : t("ack.resolved"),
      });
      router.refresh();
    } catch {
      toast({ type: "error", title: t("common.serverError") });
    } finally {
      setProcessing(null);
    }
  }

  async function handleDelete(alertId: string) {
    if (!confirm(t("alerts.deleteConfirm"))) return;
    setProcessing(alertId);
    try {
      const res = await fetch(`/api/alerts/delete?id=${alertId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ type: "error", title: body.error || t("common.serverError") });
        return;
      }
      toast({ type: "success", title: t("alerts.deleted") });
      router.refresh();
    } catch {
      toast({ type: "error", title: t("common.serverError") });
    } finally {
      setProcessing(null);
    }
  }

  async function handleDeleteResolved() {
    if (!confirm(t("alerts.deleteResolvedConfirm"))) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/alerts/delete?status=RESOLVED", { method: "DELETE" });
      if (!res.ok) {
        toast({ type: "error", title: t("common.serverError") });
        return;
      }
      const data = await res.json();
      toast({ type: "success", title: `${data.deleted}${t("alerts.deletedCount")}` });
      router.refresh();
    } catch {
      toast({ type: "error", title: t("common.serverError") });
    } finally {
      setBulkDeleting(false);
    }
  }

  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Category counts (computed from all alerts, not filtered)
  const OTHER_LABEL = t("alerts.categoryOther");

  const categories = useMemo(() => {
    return alerts.reduce(
      (acc, a) => {
        const cat = a.category || OTHER_LABEL;
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [alerts, OTHER_LABEL]);

  // Apply filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (categoryFilter && (a.category || OTHER_LABEL) !== categoryFilter)
        return false;
      if (severityFilter && a.severity !== severityFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, categoryFilter, severityFilter, statusFilter]);

  // Group filtered by date
  const grouped = useMemo(() => {
    return filteredAlerts.reduce(
      (acc, alert) => {
        const date = new Date(alert.firedAt).toISOString().split("T")[0];
        (acc[date] = acc[date] || []).push(alert);
        return acc;
      },
      {} as Record<string, AlertRow[]>,
    );
  }, [filteredAlerts]);

  const dates = Object.keys(grouped).sort().reverse();

  // Stats (unfiltered to show totals)
  const firing = alerts.filter((a) => a.status === "FIRING").length;
  const acknowledged = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
  const resolved = alerts.filter((a) => a.status === "RESOLVED").length;

  const hasActiveFilter = !!(categoryFilter || severityFilter || statusFilter);

  function toggleCategory(cat: string) {
    setCategoryFilter((prev) => (prev === cat ? null : cat));
  }
  function toggleStatus(status: string) {
    setStatusFilter((prev) => (prev === status ? null : status));
  }

  const suppressedCount = alerts.filter((a) => a.suppressed).length;

  return (
    <div className="space-y-6">
      {maintenanceActive && (
        <div className="flex items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-3">
          <BellOff className="h-4 w-4 flex-shrink-0 text-purple-400" />
          <p className="text-sm text-purple-200">
            {t("alerts.maintenanceActive")}
            {suppressedCount > 0 && (
              <span className="text-purple-300/80">
                {" "}
                · {suppressedCount} {t("alerts.muted")}
              </span>
            )}
          </p>
          <Link
            href="/alerts/settings"
            className="ml-auto text-xs font-medium text-purple-300 hover:text-purple-200"
          >
            {t("alerts.manageWindows")} →
          </Link>
        </div>
      )}

      {/* Summary - clickable */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          className={cn(
            "cursor-pointer p-4 transition-colors",
            statusFilter === "FIRING"
              ? "border-red-500 bg-red-500/5"
              : "hover:border-gray-700",
          )}
          onClick={() => toggleStatus("FIRING")}
        >
          <p className="text-sm text-gray-400">{t("alerts.firing")}</p>
          <p className="text-2xl font-bold text-red-400">{firing}</p>
        </Card>
        <Card
          className={cn(
            "cursor-pointer p-4 transition-colors",
            statusFilter === "ACKNOWLEDGED"
              ? "border-amber-500 bg-amber-500/5"
              : "hover:border-gray-700",
          )}
          onClick={() => toggleStatus("ACKNOWLEDGED")}
        >
          <p className="text-sm text-gray-400">{t("alerts.acknowledged")}</p>
          <p className="text-2xl font-bold text-amber-400">{acknowledged}</p>
        </Card>
        <Card
          className={cn(
            "cursor-pointer p-4 transition-colors",
            statusFilter === "RESOLVED"
              ? "border-green-500 bg-green-500/5"
              : "hover:border-gray-700",
          )}
          onClick={() => toggleStatus("RESOLVED")}
        >
          <p className="text-sm text-gray-400">{t("alerts.resolved")}</p>
          <p className="text-2xl font-bold text-green-400">{resolved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">{t("common.total")}</p>
          <p className="text-2xl font-bold">{alerts.length}</p>
        </Card>
      </div>

      {/* Category filter badges - clickable */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">{t("alerts.category.label")}</span>
        {Object.entries(categories)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:border-blue-500/50 hover:text-blue-300",
                )}
              >
                {cat} ({count})
              </button>
            );
          })}
        {hasActiveFilter && (
          <button
            onClick={() => {
              setCategoryFilter(null);
              setSeverityFilter(null);
              setStatusFilter(null);
            }}
            className="ml-2 flex items-center gap-1 rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
          >
            <X className="h-3 w-3" />
            {t("alerts.clearFilters")}
          </button>
        )}
        {isAdmin && resolved > 0 && (
          <button
            onClick={handleDeleteResolved}
            disabled={bulkDeleting}
            className="ml-auto flex items-center gap-1 rounded-full border border-red-800/50 bg-red-900/20 px-3 py-1 text-xs text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            {t("alerts.deleteResolved")}
          </button>
        )}
      </div>

      {hasActiveFilter && (
        <p className="text-xs text-gray-500">
          {t("alerts.filterResult")}: {filteredAlerts.length} / {alerts.length}
        </p>
      )}

      {/* Date-grouped accordion */}
      {dates.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          {hasActiveFilter ? t("alerts.noAlerts") : t("alerts.empty")}
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={dates.slice(0, 3)}>
          {dates.map((date) => (
            <AccordionItem key={date} value={date}>
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold">{date}</span>
                  <Badge>{grouped[date].length}</Badge>
                  {grouped[date].some((a) => a.status === "FIRING") && (
                    <Badge variant="critical">
                      {
                        grouped[date].filter((a) => a.status === "FIRING")
                          .length
                      }{" "}
                      firing
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {grouped[date].map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-800/30 p-3"
                    >
                      <SeverityBadge severity={alert.severity} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-200">
                          {alert.summary}
                        </p>
                        {alert.details && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {alert.details}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                          {alert.source && <span>Source: {alert.source}</span>}
                          {alert.category && (
                            <button
                              onClick={() => toggleCategory(alert.category!)}
                              className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-400 hover:bg-blue-600/20 hover:text-blue-300"
                            >
                              {alert.category}
                            </button>
                          )}
                          <span>
                            {new Date(alert.firedAt).toLocaleTimeString()}
                          </span>
                          {alert.acknowledgement && alert.acknowledgement.length > 0 && (
                            <span className="text-amber-500/80">
                              {t("ack.acknowledgedBy")}:{" "}
                              {alert.acknowledgement[0].user?.name ||
                                alert.acknowledgement[0].user?.email ||
                                "?"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
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
                        {alert.suppressed && (
                          <Badge variant="maintenance">
                            <BellOff className="mr-1 h-3 w-3" />
                            {t("alerts.muted")}
                          </Badge>
                        )}
                        {canAcknowledge && alert.status !== "RESOLVED" && (
                          <div className="flex gap-1">
                            {alert.status === "FIRING" && (
                              <button
                                onClick={() => handleAck(alert.id, "acknowledge")}
                                disabled={processing === alert.id}
                                className="flex items-center gap-1 rounded border border-amber-600/40 bg-amber-600/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-600/20 disabled:opacity-50"
                              >
                                <Check className="h-3 w-3" />
                                {t("ack.acknowledge")}
                              </button>
                            )}
                            <button
                              onClick={() => handleAck(alert.id, "resolve")}
                              disabled={processing === alert.id}
                              className="flex items-center gap-1 rounded border border-green-600/40 bg-green-600/10 px-2 py-1 text-xs text-green-300 hover:bg-green-600/20 disabled:opacity-50"
                            >
                              <CheckCheck className="h-3 w-3" />
                              {t("ack.resolve")}
                            </button>
                          </div>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(alert.id)}
                            disabled={processing === alert.id}
                            className="mt-1 flex items-center gap-1 rounded border border-red-800/40 bg-red-900/10 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
