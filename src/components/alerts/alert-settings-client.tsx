"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Bell, Send, Wrench, Mail, MessageSquare, Webhook, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/i18n-context";

type Tab = "channels" | "escalation" | "maintenance";

interface Channel {
  id: string;
  name: string;
  type: "EMAIL" | "SLACK" | "TEAMS" | "WEBHOOK";
  target: string;
  minSeverity: string;
  enabled: boolean;
}

interface Policy {
  id: string;
  name: string;
  description: string | null;
  severity: string;
  afterMinutes: number;
  channelId: string | null;
  enabled: boolean;
  channel?: { id: string; name: string; type: string } | null;
}

interface MWindow {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  targetType: string;
  targetValue: string | null;
  enabled: boolean;
}

const inputClass =
  "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "mb-1 block text-xs font-medium text-gray-400";

const CHANNEL_ICON = {
  EMAIL: Mail,
  SLACK: MessageSquare,
  TEAMS: MessageSquare,
  WEBHOOK: Webhook,
} as const;

export function AlertSettingsClient({
  isAdmin,
  canEditMaintenance,
}: {
  isAdmin: boolean;
  canEditMaintenance: boolean;
}) {
  const [tab, setTab] = useState<Tab>("channels");

  const t = useT();
  const TABS: { key: Tab; label: string; icon: typeof Bell }[] = [
    { key: "channels", label: t("alertSettings.tabs.channels"), icon: Bell },
    { key: "escalation", label: t("alertSettings.tabs.escalation"), icon: Send },
    { key: "maintenance", label: t("alertSettings.tabs.maintenance"), icon: Wrench },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-800/50 p-1 w-fit">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              tab === tb.key
                ? "bg-gray-700 text-gray-50 shadow-sm"
                : "text-gray-400 hover:bg-gray-700/50 hover:text-gray-200"
            }`}
          >
            <tb.icon className="h-3.5 w-3.5" />
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "channels" && <ChannelsTab isAdmin={isAdmin} />}
      {tab === "escalation" && <EscalationTab isAdmin={isAdmin} />}
      {tab === "maintenance" && <MaintenanceTab canEdit={canEditMaintenance} />}
    </div>
  );
}

/* ───────────────────────── Notification Channels ───────────────────────── */

function ChannelsTab({ isAdmin }: { isAdmin: boolean }) {
  const t = useT();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<Channel["type"]>("SLACK");
  const [target, setTarget] = useState("");
  const [minSeverity, setMinSeverity] = useState("WARNING");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notification-channels");
      if (res.ok) setChannels(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/notification-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, target, minSeverity }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName("");
      setTarget("");
      setType("SLACK");
      setMinSeverity("WARNING");
      toast({ type: "success", title: t("alertSettings.channels.created") });
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ type: "error", title: "Failed", message: d.error });
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/notification-channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: t("alertSettings.channels.deleteTitle"),
      message: t("alertSettings.channels.deleteMsg"),
      variant: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    await fetch(`/api/notification-channels/${id}`, { method: "DELETE" });
    toast({ type: "success", title: t("alertSettings.channels.deleted") });
    load();
  }

  async function testSend(id: string) {
    toast({ type: "info", title: t("alertSettings.channels.testSending") });
    const res = await fetch(`/api/notification-channels/${id}/test`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    toast({
      type: d.ok ? "success" : "warning",
      title: d.ok ? "Test sent" : "Test not delivered",
      message: d.message,
    });
  }

  const targetPlaceholder =
    type === "EMAIL" ? "ops@example.com" : "https://hooks.slack.com/services/...";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-100">Notification Channels</p>
          <p className="text-xs text-gray-500">
            Where alerts are delivered. Used by escalation policies.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Close" : "Add Channel"}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={create} className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ops Slack" />
          </div>
          <div>
            <label className={labelClass}>Type *</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as Channel["type"])}>
              <option value="SLACK">Slack</option>
              <option value="TEAMS">Microsoft Teams</option>
              <option value="WEBHOOK">Generic Webhook</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>{type === "EMAIL" ? "Email address *" : "Webhook URL *"}</label>
            <input required className={`${inputClass} font-mono text-xs`} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={targetPlaceholder} />
          </div>
          <div>
            <label className={labelClass}>Minimum severity</label>
            <select className={inputClass} value={minSeverity} onChange={(e) => setMinSeverity(e.target.value)}>
              <option value="INFO">Info and above</option>
              <option value="WARNING">Warning and above</option>
              <option value="CRITICAL">Critical only</option>
            </select>
          </div>
          <div className="flex items-end justify-end">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
      ) : channels.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No channels configured.</p>
      ) : (
        <div className="space-y-2">
          {channels.map((c) => {
            const Icon = CHANNEL_ICON[c.type];
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/20 px-3 py-2.5">
                <div className="rounded-lg bg-gray-800 p-2">
                  <Icon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-100">{c.name}</p>
                    <Badge variant="info">{c.type}</Badge>
                    {!c.enabled && <Badge variant="info">disabled</Badge>}
                  </div>
                  <p className="truncate font-mono text-[11px] text-gray-500">{c.target}</p>
                </div>
                <span className="text-[11px] text-gray-500">≥ {c.minSeverity}</span>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => testSend(c.id)} className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:border-blue-500 hover:text-blue-300">
                      Test
                    </button>
                    <label className="inline-flex cursor-pointer items-center" title="Enabled">
                      <input type="checkbox" checked={c.enabled} onChange={(e) => toggle(c.id, e.target.checked)} className="h-4 w-4 rounded" />
                    </label>
                    <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Escalation Policies ───────────────────────── */

function EscalationTab({ isAdmin }: { isAdmin: boolean }) {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("CRITICAL");
  const [afterMinutes, setAfterMinutes] = useState(15);
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/escalation-policies"),
        fetch("/api/notification-channels"),
      ]);
      if (pRes.ok) setPolicies(await pRes.json());
      if (cRes.ok) setChannels(await cRes.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/escalation-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, severity, afterMinutes, channelId: channelId || null }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName("");
      setSeverity("CRITICAL");
      setAfterMinutes(15);
      setChannelId("");
      toast({ type: "success", title: "Policy created" });
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ type: "error", title: "Failed", message: d.error });
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/escalation-policies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete policy",
      message: "Remove this escalation policy?",
      variant: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await fetch(`/api/escalation-policies/${id}`, { method: "DELETE" });
    toast({ type: "success", title: "Policy deleted" });
    load();
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-100">Escalation Policies</p>
          <p className="text-xs text-gray-500">
            Notify a channel when an alert of a given severity stays unacknowledged.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Close" : "Add Policy"}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={create} className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Critical → on-call" />
          </div>
          <div>
            <label className={labelClass}>Applies to severity *</label>
            <select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Escalate after (minutes) *</label>
            <input type="number" min={1} className={inputClass} value={afterMinutes} onChange={(e) => setAfterMinutes(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <label className={labelClass}>Notify channel</label>
            <select className={inputClass} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">— none —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
      ) : policies.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No escalation policies.</p>
      ) : (
        <div className="space-y-2">
          {policies.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/20 px-3 py-2.5">
              <SeverityBadge severity={p.severity} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-100">{p.name}</p>
                <p className="text-[11px] text-gray-500">
                  After {p.afterMinutes} min unacknowledged →{" "}
                  {p.channel ? `${p.channel.name} (${p.channel.type})` : "no channel"}
                </p>
              </div>
              {!p.enabled && <Badge variant="info">disabled</Badge>}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center" title="Enabled">
                    <input type="checkbox" checked={p.enabled} onChange={(e) => toggle(p.id, e.target.checked)} className="h-4 w-4 rounded" />
                  </label>
                  <button onClick={() => remove(p.id)} className="text-xs text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Maintenance Windows ───────────────────────── */

function fmtLocal(dt: string): string {
  const d = new Date(dt);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MaintenanceTab({ canEdit }: { canEdit: boolean }) {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [windows, setWindows] = useState<MWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance-windows");
      if (res.ok) setWindows(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/maintenance-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        targetType,
        targetValue: targetType === "all" ? null : targetValue,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setName("");
      setStartTime("");
      setEndTime("");
      setTargetType("all");
      setTargetValue("");
      toast({ type: "success", title: "Maintenance window created" });
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ type: "error", title: "Failed", message: d.error });
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/maintenance-windows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete window",
      message: "Remove this maintenance window?",
      variant: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await fetch(`/api/maintenance-windows/${id}`, { method: "DELETE" });
    toast({ type: "success", title: "Window deleted" });
    load();
  }

  const now = Date.now();

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-100">Maintenance Windows</p>
          <p className="text-xs text-gray-500">
            Suppress alerts during planned maintenance. Active windows mute matching alerts.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Close" : "Add Window"}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={create} className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Name *</label>
            <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rack B power work" />
          </div>
          <div>
            <label className={labelClass}>Scope *</label>
            <select className={inputClass} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="all">All alerts</option>
              <option value="source">By source (hostname/IP)</option>
              <option value="category">By category</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Start *</label>
            <input required type="datetime-local" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>End *</label>
            <input required type="datetime-local" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          {targetType !== "all" && (
            <div className="md:col-span-2">
              <label className={labelClass}>
                {targetType === "source" ? "Source (hostname or IP)" : "Category"} *
              </label>
              <input
                required
                className={inputClass}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === "source" ? "s222hx14ae001" : "temperature"}
              />
            </div>
          )}
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
      ) : windows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No maintenance windows.</p>
      ) : (
        <div className="space-y-2">
          {windows.map((w) => {
            const start = new Date(w.startTime).getTime();
            const end = new Date(w.endTime).getTime();
            const active = w.enabled && start <= now && end >= now;
            const upcoming = start > now;
            return (
              <div key={w.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/20 px-3 py-2.5">
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    active ? "bg-amber-400 animate-pulse" : upcoming ? "bg-blue-400" : "bg-gray-600"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-100">{w.name}</p>
                    {active && <Badge variant="maintenance">active</Badge>}
                    {upcoming && <Badge variant="info">upcoming</Badge>}
                    {!w.enabled && <Badge variant="info">disabled</Badge>}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {fmtLocal(w.startTime)} → {fmtLocal(w.endTime)} ·{" "}
                    {w.targetType === "all" ? "all alerts" : `${w.targetType}: ${w.targetValue}`}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center" title="Enabled">
                      <input type="checkbox" checked={w.enabled} onChange={(e) => toggle(w.id, e.target.checked)} className="h-4 w-4 rounded" />
                    </label>
                    <button onClick={() => remove(w.id)} className="text-xs text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
