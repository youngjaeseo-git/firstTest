"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/i18n-context";
import { UserPlus, LogOut, Clock, User, Target } from "lucide-react";

interface Assignment {
  id: string;
  assignedTo: string;
  purpose: string | null;
  assignedAt: string;
  releasedAt: string | null;
  notes: string | null;
  createdBy: string;
}

interface EquipmentAssignmentsProps {
  equipmentId: string;
}

export function EquipmentAssignments({ equipmentId }: EquipmentAssignmentsProps) {
  const t = useT();
  const [active, setActive] = useState<Assignment[]>([]);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/assignments`);
      if (!res.ok) return;
      const data = await res.json();
      setActive(data.active || []);
      setHistory(data.history || []);
    } catch {
      // silent
    }
  }, [equipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssign = async () => {
    if (!assignedTo.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: assignedTo.trim(),
          purpose: purpose.trim() || null,
        }),
      });
      if (res.ok) {
        setAssignedTo("");
        setPurpose("");
        setShowForm(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async (assignmentId: string) => {
    setReleasing(assignmentId);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (res.ok) {
        await load();
      }
    } finally {
      setReleasing(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const daysSince = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-200">
            {t("assignment.title")}
          </h3>
          {active.length > 0 && (
            <Badge variant="warning">{t("assignment.inUse")}</Badge>
          )}
          {active.length === 0 && (
            <Badge variant="active">{t("assignment.available")}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("assignment.assign")}
        </Button>
      </div>

      {showForm && (
        <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3 space-y-2">
          <input
            type="text"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder={t("assignment.whoPlaceholder")}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={t("assignment.purposePlaceholder")}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setAssignedTo(""); setPurpose(""); }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={saving || !assignedTo.trim()}
            >
              {saving ? "..." : t("assignment.confirm")}
            </Button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="mt-3 space-y-2">
          {active.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-300">
                    {a.assignedTo}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {daysSince(a.assignedAt)}{t("assignment.daysAgo")}
                  </span>
                </div>
                {a.purpose && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Target className="h-3 w-3" />
                    {a.purpose}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRelease(a.id)}
                disabled={releasing === a.id}
                className="flex items-center gap-1 text-xs border-gray-600 hover:border-red-500/50 hover:text-red-400"
              >
                <LogOut className="h-3 w-3" />
                {releasing === a.id ? "..." : t("assignment.release")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
          >
            <Clock className="h-3 w-3" />
            {t("assignment.history")} ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1">
              {history.slice(0, 10).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded px-2 py-1 text-xs text-gray-500"
                >
                  <span>
                    <span className="text-gray-400">{a.assignedTo}</span>
                    {a.purpose && (
                      <span className="ml-1.5 text-gray-600">— {a.purpose}</span>
                    )}
                  </span>
                  <span className="font-mono text-[10px]">
                    {formatDate(a.assignedAt)} ~ {formatDate(a.releasedAt!)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
