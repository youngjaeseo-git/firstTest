"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm";
import { PageHeader } from "@/components/ui/page-header";
import { ShieldAlert } from "lucide-react";
import { useT } from "@/lib/i18n/i18n-context";
import { inputClass, labelClass } from "@/lib/styles";

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  metric: string;
  condition: string;
  duration: number;
  severity: string;
  category: string | null;
  enabled: boolean;
  createdAt: string;
  _count: { alerts: number };
}

const SEVERITIES = ["CRITICAL", "WARNING", "INFO"];
const COMMON_CATEGORIES = [
  "temperature",
  "cpu",
  "memory",
  "disk",
  "network",
  "power",
  "hardware",
];

const PRESETS = [
  {
    name: "High CPU Usage",
    metric: '100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    condition: "> 90",
    duration: 300,
    severity: "WARNING",
    category: "cpu",
  },
  {
    name: "High Memory Usage",
    metric: "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
    condition: "> 90",
    duration: 300,
    severity: "WARNING",
    category: "memory",
  },
  {
    name: "Disk Space Low",
    metric: '(node_filesystem_avail_bytes{fstype!~"tmpfs|devtmpfs"} / node_filesystem_size_bytes) * 100',
    condition: "< 10",
    duration: 600,
    severity: "CRITICAL",
    category: "disk",
  },
  {
    name: "High Temperature",
    metric: "node_hwmon_temp_celsius",
    condition: "> 80",
    duration: 120,
    severity: "CRITICAL",
    category: "temperature",
  },
  {
    name: "Node Down",
    metric: "up",
    condition: "== 0",
    duration: 60,
    severity: "CRITICAL",
    category: "hardware",
  },
];

export default function AlertRulesPage() {
  const t = useT();
  const confirm = useConfirm();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState("");
  const [condition, setCondition] = useState("");
  const [duration, setDuration] = useState(60);
  const [severity, setSeverity] = useState("WARNING");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRules() {
    try {
      const res = await fetch("/api/alert-rules");
      if (res.ok) setRules(await res.json());
    } catch {
      setError(t("alerts.loadError"));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRules();
  }, []);

  function applyPreset(preset: (typeof PRESETS)[0]) {
    setName(preset.name);
    setMetric(preset.metric);
    setCondition(preset.condition);
    setDuration(preset.duration);
    setSeverity(preset.severity);
    setCategory(preset.category);
  }

  function startEdit(rule: AlertRule) {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || "");
    setMetric(rule.metric);
    setCondition(rule.condition);
    setDuration(rule.duration);
    setSeverity(rule.severity);
    setCategory(rule.category || "");
    setShowForm(true);
  }

  function resetForm() {
    setEditingRule(null);
    setName("");
    setDescription("");
    setMetric("");
    setCondition("");
    setDuration(60);
    setSeverity("WARNING");
    setCategory("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name,
        description: description || null,
        metric,
        condition,
        duration,
        severity,
        category: category || null,
      };
      const isEdit = !!editingRule;
      const res = await fetch(
        isEdit ? `/api/alert-rules/${editingRule!.id}` : "/api/alert-rules",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("alerts.createError"));
      } else {
        setShowForm(false);
        resetForm();
        await loadRules();
      }
    } catch {
      setError(t("alerts.serverError"));
    }
    setSaving(false);
  }

  async function toggleRule(id: string, enabled: boolean) {
    await fetch(`/api/alert-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await loadRules();
  }

  async function deleteRule(id: string) {
    const ok = await confirm({
      title: t("common.delete"),
      message: t("alerts.confirmDelete"),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    await fetch(`/api/alert-rules/${id}`, { method: "DELETE" });
    await loadRules();
  }

  return (
    <div className="space-y-6">
      <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/alerts" className="hover:text-gray-200">
          {t("nav.alerts")}
        </Link>
        <span>/</span>
        <span>{t("alerts.rules")}</span>
      </div>
      <PageHeader
        icon={ShieldAlert}
        title={t("alerts.rules")}
        subtitle={t("alerts.rulesDesc")}
        accent="red"
        right={
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showForm ? t("common.cancel") : t("alerts.addRule")}
          </button>
        }
      />

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* New Rule Form */}
      {showForm && (
        <Card>
          <p className="mb-4 font-medium">{editingRule ? t("common.edit") : t("alerts.newRule")}</p>

          {/* Presets */}
          <div className="mb-4">
            <p className={labelClass}>{t("alerts.usePreset")}</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300 hover:border-blue-500 hover:text-blue-300"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label className={labelClass}>{t("alerts.ruleName")} *</label>
              <input
                required
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="High CPU Usage"
              />
            </div>
            <div>
              <label className={labelClass}>{t("alerts.category")}</label>
              <input
                list="categories"
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="cpu, memory, disk..."
              />
              <datalist id="categories">
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>{t("common.description")}</label>
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="CPU 사용률이 지속적으로 높음"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>PromQL Metric *</label>
              <textarea
                required
                rows={3}
                className={`${inputClass} font-mono text-xs`}
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                placeholder='100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
              />
            </div>
            <div>
              <label className={labelClass}>Condition *</label>
              <input
                required
                className={`${inputClass} font-mono`}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="> 90"
              />
            </div>
            <div>
              <label className={labelClass}>{t("alerts.durationSec")}</label>
              <input
                type="number"
                className={inputClass}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                min={10}
              />
            </div>
            <div>
              <label className={labelClass}>Severity *</label>
              <select
                className={inputClass}
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? t("common.saving") : editingRule ? t("common.save") : t("alerts.createRule")}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Rules List */}
      <Card>
        {loading ? (
          <p className="text-center text-gray-400">Loading...</p>
        ) : rules.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            {t("alerts.noRules")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">{t("common.name")}</th>
                  <th className="px-3 py-2">{t("alerts.severity")}</th>
                  <th className="px-3 py-2">{t("alerts.category")}</th>
                  <th className="px-3 py-2">{t("alerts.condition")}</th>
                  <th className="px-3 py-2">{t("alerts.duration")}</th>
                  <th className="px-3 py-2">{t("nav.alerts")}</th>
                  <th className="px-3 py-2">{t("common.enabled")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-100">{r.name}</p>
                      {r.description && (
                        <p className="text-xs text-gray-500">
                          {r.description}
                        </p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-gray-600 truncate max-w-md">
                        {r.metric}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <SeverityBadge severity={r.severity} />
                    </td>
                    <td className="px-3 py-2">
                      {r.category ? (
                        <Badge variant="info">{r.category}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.condition}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.duration}s</td>
                    <td className="px-3 py-2 text-xs">{r._count.alerts}</td>
                    <td className="px-3 py-2">
                      <label className="inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) => toggleRule(r.id, e.target.checked)}
                          className="h-4 w-4 rounded"
                        />
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(r)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => deleteRule(r.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
