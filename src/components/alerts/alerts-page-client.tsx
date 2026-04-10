"use client";

import { useMemo, useState } from "react";
import { SeverityBadge, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface AlertRow {
  id: string;
  status: string;
  severity: string;
  category: string | null;
  summary: string;
  details: string | null;
  source: string | null;
  firedAt: string;
}

interface AlertsPageClientProps {
  alerts: AlertRow[];
}

export function AlertsPageClient({ alerts }: AlertsPageClientProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Category counts (computed from all alerts, not filtered)
  const categories = useMemo(() => {
    return alerts.reduce(
      (acc, a) => {
        const cat = a.category || "기타";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [alerts]);

  // Apply filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (categoryFilter && (a.category || "기타") !== categoryFilter)
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

  return (
    <div className="space-y-6">
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
          <p className="text-sm text-gray-400">Firing</p>
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
          <p className="text-sm text-gray-400">Acknowledged</p>
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
          <p className="text-sm text-gray-400">Resolved</p>
          <p className="text-2xl font-bold text-green-400">{resolved}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-400">Total</p>
          <p className="text-2xl font-bold">{alerts.length}</p>
        </Card>
      </div>

      {/* Category filter badges - clickable */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Category:</span>
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
            필터 초기화
          </button>
        )}
      </div>

      {hasActiveFilter && (
        <p className="text-xs text-gray-500">
          필터링 결과: {filteredAlerts.length} / {alerts.length}
        </p>
      )}

      {/* Date-grouped accordion */}
      {dates.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          {hasActiveFilter
            ? "필터 조건에 맞는 알림이 없습니다."
            : "알림 내역이 없습니다."}
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={dates.slice(0, 3)}>
          {dates.map((date) => (
            <AccordionItem key={date} value={date}>
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold">{date}</span>
                  <Badge>{grouped[date].length}건</Badge>
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
                        <div className="mt-1 flex gap-3 text-xs text-gray-500">
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
                            {new Date(alert.firedAt).toLocaleTimeString(
                              "ko-KR",
                            )}
                          </span>
                        </div>
                      </div>
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
