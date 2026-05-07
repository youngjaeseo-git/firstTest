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
import { useT } from "@/lib/i18n/i18n-context";

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

const ACTION_META: Record<string, Omit<ActionMeta, "label"> & { labelKey: string }> = {
  CREATE: {
    labelKey: "history.created",
    Icon: Plus,
    className: "bg-green-500/15 text-green-400 ring-green-500/30",
  },
  UPDATE: {
    labelKey: "history.updated",
    Icon: Pencil,
    className: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  },
  DELETE: {
    labelKey: "history.deleted",
    Icon: Trash2,
    className: "bg-red-500/15 text-red-400 ring-red-500/30",
  },
  STATUS_CHANGE: {
    labelKey: "history.statusChange",
    Icon: RefreshCw,
    className: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  },
  POWER_ACTION: {
    labelKey: "history.powerAction",
    Icon: Power,
    className: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  },
  RACK_MOVE: {
    labelKey: "history.rackMoved",
    Icon: ArrowLeftRight,
    className: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/30",
  },
  MAINTENANCE_START: {
    labelKey: "history.maintenanceStart",
    Icon: Wrench,
    className: "bg-yellow-500/15 text-yellow-400 ring-yellow-500/30",
  },
  MAINTENANCE_END: {
    labelKey: "history.maintenanceEnd",
    Icon: Wrench,
    className: "bg-green-500/15 text-green-400 ring-green-500/30",
  },
};

const FALLBACK_LABEL_KEY = "history.action";

function formatChanges(action: string, changes: Record<string, unknown> | null, t: (key: string) => string) {
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
        <li className="text-gray-600">+{entries.length - 6} {t("common.more")}…</li>
      )}
    </ul>
  );
}

const MANUAL_ACTIONS = [
  { value: "MAINTENANCE_START", label: "Maintenance Start" },
  { value: "MAINTENANCE_END", label: "Maintenance End" },
  { value: "STATUS_CHANGE", label: "Status Change" },
  { value: "RACK_MOVE", label: "Rack Move" },
  { value: "UPDATE", label: "Note / Update" },
] as const;

export function EquipmentHistory({ equipmentId }: { equipmentId: string }) {
  const t = useT();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formAction, setFormAction] = useState("UPDATE");
  const [formReason, setFormReason] = useState("");
  const [formTicket, setFormTicket] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadHistory = () => {
    setLoading(true);
    fetch(`/api/equipment/${equipmentId}/history`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load history");
        return res.json();
      })
      .then((json) => {
        setEntries(json.items || []);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [equipmentId]);

  const handleSubmit = async () => {
    if (formReason.trim().length < 3) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: formAction,
          reason: formReason.trim(),
          ticketRef: formTicket.trim() || null,
        }),
      });
      if (res.ok) {
        setFormReason("");
        setFormTicket("");
        setShowForm(false);
        loadHistory();
      }
    } catch {}
    setSubmitting(false);
  };

  if (loading) {
    return (
      <p className="text-sm text-gray-500">{t("history.loading")}</p>
    );
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {t("history.noHistory")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-1.5 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Record
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Type</label>
              <select
                value={formAction}
                onChange={(e) => setFormAction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
              >
                {MANUAL_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Ticket (optional)</label>
              <input
                type="text"
                value={formTicket}
                onChange={(e) => setFormTicket(e.target.value)}
                placeholder="OPS-1234"
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-mono text-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400">Description *</label>
            <textarea
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              rows={2}
              placeholder="e.g., Replaced faulty DIMM in slot A2, Moved to Rack B3 U12"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || formReason.trim().length < 3}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

    <ol className="space-y-3">
      {entries.map((entry) => {
        const meta = ACTION_META[entry.action];
        const Icon = meta ? meta.Icon : HistoryIcon;
        const label = meta ? t(meta.labelKey) : t(FALLBACK_LABEL_KEY);
        const className = meta ? meta.className : "bg-gray-700/40 text-gray-300 ring-gray-600/40";
        return (
          <li
            key={entry.id}
            className="flex gap-3 rounded-lg border border-gray-800/80 bg-gray-900/40 p-3"
          >
            <div
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1",
                className,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-100">
                  {label}
                </p>
                <p className="text-[11px] text-gray-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {t("common.by")} {entry.user.name || entry.user.email}
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
                {formatChanges(entry.action, entry.changes, t)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
    </div>
  );
}
