"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useT } from "@/lib/i18n/i18n-context";
import {
  Stethoscope,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Unlink,
  Link2,
  Monitor,
} from "lucide-react";

interface DiagnosticResult {
  ipOnlyTargets: { instance: string; job: string; ip: string }[];
  duplicateScrapes: {
    ip: string;
    jobs: string[];
    instances: string[];
    count: number;
  }[];
  prometheusOrphans: {
    instance: string;
    job: string;
    ip: string;
    health: string;
  }[];
  dbOrphans: { id: string; hostname: string | null; ipAddress: string | null }[];
  summary: {
    totalLiveTargets: number;
    totalEquipment: number;
    ipOnlyCount: number;
    duplicateCount: number;
    promOrphanCount: number;
    dbOrphanCount: number;
    checkedAt: string;
  };
}

const SUMMARY_CARDS = [
  { key: "ipOnly", field: "ipOnlyCount", border: "border-l-amber-500", text: "text-amber-400" },
  { key: "duplicate", field: "duplicateCount", border: "border-l-red-500", text: "text-red-400" },
  { key: "promOrphan", field: "promOrphanCount", border: "border-l-purple-500", text: "text-purple-400" },
  { key: "dbOrphan", field: "dbOrphanCount", border: "border-l-cyan-500", text: "text-cyan-400" },
] as const;

export default function PrometheusDiagnosticPage() {
  const t = useT();
  const [data, setData] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [osLoading, setOsLoading] = useState(false);
  const [osResult, setOsResult] = useState<{ updated: number; total: number; details: { hostname: string | null; ip: string; osType: string; osVersion: string }[] } | null>(null);

  async function fetchDiagnostic() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/discovery/diagnostic");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
    } catch {
      setError(t("common.serverError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDiagnostic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function collectOsInfo() {
    setOsLoading(true);
    setOsResult(null);
    try {
      const res = await fetch("/api/discovery/os-info", { method: "POST" });
      if (res.ok) {
        setOsResult(await res.json());
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "OS 정보 수집 실패");
      }
    } catch {
      setError("OS 정보 수집 중 오류");
    } finally {
      setOsLoading(false);
    }
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Stethoscope}
        title={t("diagnostic.title")}
        subtitle={t("diagnostic.subtitle")}
        accent="amber"
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={collectOsInfo}
              disabled={osLoading}
            >
              <Monitor className={`mr-1 h-4 w-4 ${osLoading ? "animate-spin" : ""}`} />
              OS 정보 수집
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDiagnostic}
              disabled={loading}
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {t("diagnostic.recheck")}
            </Button>
          </div>
        }
      />

      {loading && !data && (
        <div className="flex items-center justify-center gap-3 py-20">
          <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          <span className="text-gray-400">{t("common.loading")}</span>
        </div>
      )}

      {error && (
        <Card className="border-red-800/60 bg-red-900/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <div>
              <p className="text-sm text-red-400">{t("diagnostic.fetchError")}</p>
              <p className="mt-1 font-mono text-xs text-red-500">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {osResult && (
        <Card className="border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-400" />
            <h3 className="text-base font-semibold text-gray-100">OS 정보 수집 결과</h3>
            <Badge variant="info">{osResult.updated}개 업데이트</Badge>
            <span className="text-xs text-gray-500">/ 전체 {osResult.total}개 타겟</span>
          </div>
          {osResult.details.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                    <th className="px-3 py-2">Hostname</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">OS Type</th>
                    <th className="px-3 py-2">OS Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {osResult.details.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-gray-300">{d.hostname || "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-300">{d.ip}</td>
                      <td className="px-3 py-2"><Badge variant="info">{d.osType}</Badge></td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-300">{d.osVersion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">모든 장비의 OS 정보가 이미 최신 상태입니다.</p>
          )}
        </Card>
      )}

      {data && summary && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span>
              {t("diagnostic.liveTargets")}:{" "}
              <span className="font-mono text-gray-300">{summary.totalLiveTargets}</span>
            </span>
            <span>
              {t("diagnostic.equipment")}:{" "}
              <span className="font-mono text-gray-300">{summary.totalEquipment}</span>
            </span>
            <span>
              {t("diagnostic.checkedAt")}:{" "}
              <span className="font-mono text-gray-300">
                {new Date(summary.checkedAt).toLocaleTimeString()}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {SUMMARY_CARDS.map(({ key, field, border, text }) => {
              const count = summary[field];
              const isZero = count === 0;
              return (
                <Card
                  key={key}
                  className={`border-l-4 ${isZero ? "border-l-green-500" : border}`}
                >
                  <p className={`text-3xl font-bold ${isZero ? "text-green-400" : text}`}>
                    {count}
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    {t(`diagnostic.${key}`)}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* IP-Only Targets */}
          <SectionCard
            icon={<Copy className="h-5 w-5 text-amber-400" />}
            title={t("diagnostic.ipOnly")}
            desc={t("diagnostic.ipOnlyDesc")}
            count={data.ipOnlyTargets.length}
            clearText={t("diagnostic.allClear")}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">Instance</th>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.ipOnlyTargets.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">{item.instance}</td>
                    <td className="px-3 py-2">
                      <Badge variant="default">{item.job}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">{item.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          {/* Duplicate Scrapes */}
          <SectionCard
            icon={<Copy className="h-5 w-5 text-red-400" />}
            title={t("diagnostic.duplicate")}
            desc={t("diagnostic.duplicateDesc")}
            count={data.duplicateScrapes.length}
            clearText={t("diagnostic.allClear")}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Jobs</th>
                  <th className="px-3 py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.duplicateScrapes.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">{item.ip}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {item.jobs.map((j) => (
                          <Badge key={j} variant="default">{j}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-300">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          {/* Prometheus Orphans */}
          <SectionCard
            icon={<Unlink className="h-5 w-5 text-purple-400" />}
            title={t("diagnostic.promOrphan")}
            desc={t("diagnostic.promOrphanDesc")}
            count={data.prometheusOrphans.length}
            clearText={t("diagnostic.allClear")}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">Instance</th>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.prometheusOrphans.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">{item.instance}</td>
                    <td className="px-3 py-2">
                      <Badge variant="default">{item.job}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">{item.ip}</td>
                    <td className="px-3 py-2">
                      <Badge variant={item.health === "up" ? "active" : "critical"}>
                        {item.health}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          {/* DB Orphans */}
          <SectionCard
            icon={<Link2 className="h-5 w-5 text-cyan-400" />}
            title={t("diagnostic.dbOrphan")}
            desc={t("diagnostic.dbOrphanDesc")}
            count={data.dbOrphans.length}
            clearText={t("diagnostic.allClear")}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                  <th className="px-3 py-2">Hostname</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.dbOrphans.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-medium text-gray-300">
                      {item.hostname || <span className="text-gray-500">-</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">
                      {item.ipAddress || "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/infrastructure/${item.id}`}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  desc,
  count,
  clearText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  count: number;
  clearText: string;
  children: React.ReactNode;
}) {
  if (count === 0) {
    return (
      <Card>
        <div className="mb-2 flex items-center gap-2">
          {icon}
          <h3 className="text-base font-semibold text-gray-100">{title}</h3>
        </div>
        <p className="text-xs text-gray-500">{desc}</p>
        <div className="flex items-center gap-2 py-6 text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm">{clearText}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-gray-100">
          {title}{" "}
          <Badge variant="default" className="ml-2 align-middle">
            {count}
          </Badge>
        </h3>
      </div>
      <p className="mb-4 text-xs text-gray-500">{desc}</p>
      <div className="-mx-4 overflow-x-auto">{children}</div>
    </Card>
  );
}
