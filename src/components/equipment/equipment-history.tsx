"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Power,
  ArrowLeftRight,
  Wrench,
  History as HistoryIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  changes: Record<string, unknown> | null;
  reason: string | null;
  ticketRef: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

interface ActionMeta {
  label: string;
  Icon: typeof Plus;
  className: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  CREATE: {
    label: "Created",
    Icon: Plus,
    className: "bg-green-500/15 text-green-400 ring-green-500/30",
  },
  UPDATE: {
    label: "Updated",
    Icon: Pencil,
    className: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  },
  DELETE: {
    label: "Deleted",
    Icon: Trash2,
    className: "bg-red-500/15 text-red-400 ring-red-500/30",
  },
  STATUS_CHANGE: {
    label: "Status Change",
    Icon: RefreshCw,
    className: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  },
  POWER_ACTION: {
    label: "Power Action",
    Icon: Power,
    className: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  },
  RACK_MOVE: {
    label: "Rack Moved",
    Icon: ArrowLeftRight,
    className: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/30",
  },
  MAINTENANCE_START: {
    label: "Maintenance Start",
    Icon: Wrench,
    className: "bg-yellow-500/15 text-yellow-400 ring-yellow-500/30",
  },
  MAINTENANCE_END: {
    label: "Maintenance End",
    Icon: Wrench,
    className: "bg-green-500/15 text-green-400 ring-green-500/30",
  },
};

const FALLBACK_META: ActionMeta = {
  label: "Action",
  Icon: HistoryIcon,
  className: "bg-gray-700/40 text-gray-300 ring-gray-600/40",
};

function formatChanges(action: string, changes: Record<string, unknown> | null) {
  if (!changes) return null;

  if (action === "POWER_ACTION") {
    const success = changes.success as boolean | undefined;
    const resetType = changes.resetType as string | undefined;
    const error = changes.error as string | undefined;
    return (
      <span className={success === false ? "text-red-400" : "text-gray-300"}>
        {resetType}
        {success === false && error ? ` — failed: ${error}` : ""}
      </span>
    );
  }

  // Generic field diff: { field: { from, to } }
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-xs text-gray-400">
      {entries.slice(0, 6).map(([key, value]) => {
        const v = value as { from?: unknown; to?: unknown } | unknown;
        if (v && typeof v === "object" && "from" in v && "to" in v) {
          const diff = v as { from: unknown; to: unknown };
          return (
            <li key={key}>
              <span className="font-medium text-gray-300">{key}</span>:{" "}
              <span className="text-gray-500 line-through">
                {String(diff.from ?? "—")}
              </span>{" "}
              → <span className="text-gray-200">{String(diff.to ?? "—")}</span>
            </li>
          );
        }
        return (
          <li key={key}>
            <span className="font-medium text-gray-300">{key}</span>:{" "}
            <span className="text-gray-200">{String(value)}</span>
          </li>
        );
      })}
      {entries.length > 6 && (
        <li className="text-gray-600">+{entries.length - 6} more…</li>
      )}
    </ul>
  );
}

export function EquipmentHistory({ equipmentId }: { equipmentId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/equipment/${equipmentId}/history`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load history");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setEntries(json.items || []);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Loading history…</p>
    );
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No history recorded yet for this equipment.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const meta = ACTION_META[entry.action] || FALLBACK_META;
        const Icon = meta.Icon;
        return (
          <li
            key={entry.id}
            className="flex gap-3 rounded-lg border border-gray-800/80 bg-gray-900/40 p-3"
          >
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1",
                meta.className,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-100">
                  {meta.label}
                </p>
                <p className="text-[11px] text-gray-500">
                  {new Date(entry.createdAt).toLocaleString("ko-KR")}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                by {entry.user.name || entry.user.email}
                {entry.ticketRef && (
                  <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
                    {entry.ticketRef}
                  </span>
                )}
              </p>
              {entry.reason && (
                <p className="mt-1.5 text-sm text-gray-300">{entry.reason}</p>
              )}
              <div className="mt-1.5">
                {formatChanges(entry.action, entry.changes)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
