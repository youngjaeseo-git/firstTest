"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/i18n-context";
import {
  ShieldCheck,
  Plus,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Bell,
} from "lucide-react";

interface ExpiryItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  expiresAt: string;
  notifyDays: number;
  status: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  K8S_CERTIFICATE: "K8s 인증서",
  TLS_CERTIFICATE: "TLS 인증서",
  LICENSE: "라이선스",
  WARRANTY: "보증",
  DOMAIN: "도메인",
  CUSTOM: "기타",
};

const CATEGORY_COLORS: Record<string, string> = {
  K8S_CERTIFICATE: "bg-blue-500/15 text-blue-400",
  TLS_CERTIFICATE: "bg-purple-500/15 text-purple-400",
  LICENSE: "bg-green-500/15 text-green-400",
  WARRANTY: "bg-amber-500/15 text-amber-400",
  DOMAIN: "bg-cyan-500/15 text-cyan-400",
  CUSTOM: "bg-gray-500/15 text-gray-400",
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number): string {
  if (days < 0) return "text-red-400 bg-red-500/10 border-red-500/30";
  if (days <= 7) return "text-red-400 bg-red-500/10 border-red-500/30";
  if (days <= 30) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  if (days <= 90) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  return "text-green-400 bg-green-500/10 border-green-500/30";
}

export default function ExpiryTrackerPage() {
  const t = useT();
  const { toast } = useToast();
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    category: "K8S_CERTIFICATE",
    description: "",
    expiresAt: "",
    notifyDays: 30,
    source: "",
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expiry-tracker");
      if (res.ok) setItems(await res.json());
    } catch {
      toast({ type: "error", title: "로드 실패" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSubmit = async () => {
    if (!form.name || !form.expiresAt) {
      toast({ type: "error", title: "이름과 만기일은 필수입니다" });
      return;
    }

    const method = editingId ? "PATCH" : "POST";
    const url = editingId ? `/api/expiry-tracker/${editingId}` : "/api/expiry-tracker";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expiresAt: new Date(form.expiresAt).toISOString(),
          description: form.description || null,
          source: form.source || null,
        }),
      });
      if (res.ok) {
        toast({ type: "success", title: editingId ? "수정 완료" : "등록 완료" });
        resetForm();
        fetchItems();
      } else {
        const data = await res.json();
        toast({ type: "error", title: data.error || "실패" });
      }
    } catch {
      toast({ type: "error", title: "서버 통신 오류" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/expiry-tracker/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ type: "success", title: "삭제 완료" });
        fetchItems();
      }
    } catch {
      toast({ type: "error", title: "삭제 실패" });
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/expiry-tracker/check", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        toast({
          type: "success",
          title: `점검 완료: ${result.alertsCreated}개 알림 생성, ${result.expired}개 만료`,
        });
        fetchItems();
      }
    } catch {
      toast({ type: "error", title: "점검 실패" });
    } finally {
      setChecking(false);
    }
  };

  const startEdit = (item: ExpiryItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      description: item.description || "",
      expiresAt: item.expiresAt.slice(0, 10),
      notifyDays: item.notifyDays,
      source: item.source || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({ name: "", category: "K8S_CERTIFICATE", description: "", expiresAt: "", notifyDays: 30, source: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const expired = items.filter((i) => i.status === "EXPIRED" || daysUntil(i.expiresAt) < 0);
  const expiringSoon = items.filter(
    (i) => i.status === "ACTIVE" && daysUntil(i.expiresAt) >= 0 && daysUntil(i.expiresAt) <= 30,
  );
  const healthy = items.filter(
    (i) => i.status === "ACTIVE" && daysUntil(i.expiresAt) > 30,
  );

  const inputCls =
    "w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="만기 관리"
        subtitle="인증서, 라이선스, 보증 만기일 추적 및 알림"
        accent="blue"
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checking}
            >
              <Bell className={`mr-1 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              만기 점검
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              등록
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-400">{expired.length}</p>
              <p className="text-xs text-gray-500">만료됨</p>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-amber-500 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-amber-400">{expiringSoon.length}</p>
              <p className="text-xs text-gray-500">30일 이내 만기</p>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-green-500 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-400">{healthy.length}</p>
              <p className="text-xs text-gray-500">정상</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-blue-800/50 bg-blue-900/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-300">
              {editingId ? "만기 항목 수정" : "새 만기 항목 등록"}
            </h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">이름 *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: K8s API Server 인증서"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">카테고리</label>
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">만기일 *</label>
              <input
                type="date"
                className={inputCls}
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">사전 알림 (일)</label>
              <input
                type="number"
                className={inputCls}
                value={form.notifyDays}
                onChange={(e) => setForm({ ...form, notifyDays: parseInt(e.target.value) || 30 })}
                min={1}
                max={365}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">출처/대상</label>
              <input
                className={inputCls}
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="예: kube-apiserver, *.example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">설명</label>
              <input
                className={inputCls}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="비고"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSubmit}>
              {editingId ? "수정" : "등록"}
            </Button>
          </div>
        </Card>
      )}

      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          <span className="text-gray-400">{t("common.loading")}</span>
        </div>
      ) : items.length === 0 ? (
        <Card className="py-12 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-gray-600" />
          <p className="mt-3 text-gray-500">등록된 만기 항목이 없습니다</p>
          <p className="mt-1 text-xs text-gray-600">
            K8s 인증서, TLS 인증서, 라이선스 등의 만기일을 등록하세요
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items
            .sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt))
            .map((item) => {
              const days = daysUntil(item.expiresAt);
              const isExpired = days < 0;

              return (
                <Card
                  key={item.id}
                  className={`border-l-4 ${urgencyClass(days)} transition-colors hover:brightness-110`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className={`text-lg font-bold ${isExpired ? "text-red-400" : days <= 30 ? "text-amber-400" : "text-green-400"}`}>
                          {isExpired ? "만료" : `D-${days}`}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(item.expiresAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div className="border-l border-gray-700 pl-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-200">{item.name}</p>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[item.category] || "bg-gray-500/15 text-gray-400"}`}>
                            {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                          {item.status === "RENEWED" && (
                            <Badge variant="active">갱신됨</Badge>
                          )}
                          {item.status === "DISMISSED" && (
                            <Badge variant="default">무시</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          {item.source && <span>{item.source}</span>}
                          {item.description && (
                            <>
                              <span className="text-gray-700">·</span>
                              <span>{item.description}</span>
                            </>
                          )}
                          <span className="text-gray-700">·</span>
                          <span>{item.notifyDays}일 전 알림</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(item)}
                        className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-gray-300"
                        title="수정"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-red-400"
                        title="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
