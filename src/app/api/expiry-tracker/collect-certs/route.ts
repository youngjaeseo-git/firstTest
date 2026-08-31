import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { instantQuery } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

/**
 * Auto-collect certificate expiry from Prometheus.
 *
 * Probes several well-known cert-expiry metrics (value = unix-seconds the cert
 * expires). The first metric that returns data is used. Each series becomes an
 * ExpiryTracker row keyed by a stable `source` so re-runs update in place.
 *
 * NOTE (data-first): the exact metric present in this cluster must be confirmed
 * with check/20260602-k8s-cert-metrics.sh. The probe list below covers the
 * common exporters; if none match, this returns found:0 and the script result
 * tells us which metric name to add.
 */
const CANDIDATES: { metric: string; category: "K8S_CERTIFICATE" | "TLS_CERTIFICATE" }[] = [
  // x509-certificate-exporter — value is not_after (unix seconds)
  { metric: "x509_cert_not_after", category: "K8S_CERTIFICATE" },
  // cert-manager
  { metric: "certmanager_certificate_expiration_timestamp_seconds", category: "K8S_CERTIFICATE" },
  // ssl-exporter
  { metric: "ssl_cert_not_after", category: "TLS_CERTIFICATE" },
  // blackbox-exporter probe
  { metric: "probe_ssl_earliest_cert_expiry", category: "TLS_CERTIFICATE" },
];

function labelName(labels: Record<string, string>): string {
  return (
    labels.subject_CN ||
    labels.name ||
    labels.cn ||
    labels.secret_name ||
    labels.filepath ||
    labels.filename ||
    labels.instance ||
    "unknown cert"
  );
}

function labelSource(metric: string, labels: Record<string, string>): string {
  const key =
    labels.filepath ||
    labels.secret_name ||
    `${labels.namespace || ""}/${labels.name || ""}` ||
    labels.instance ||
    labelName(labels);
  return `cert:${metric}:${key}`;
}

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let used: string | null = null;
  let series: { metric: Record<string, string>; value: [number, string] }[] = [];

  try {
    for (const cand of CANDIDATES) {
      const res = await instantQuery(cand.metric);
      const results = res.data?.result ?? [];
      if (results.length > 0) {
        used = cand.metric;
        series = results as typeof series;
        break;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Prometheus query failed", found: 0 },
      { status: 502 },
    );
  }

  if (!used) {
    return NextResponse.json({
      found: 0,
      created: 0,
      updated: 0,
      message:
        "인증서 만기 메트릭을 찾지 못했습니다. check/20260602-k8s-cert-metrics.sh 실행 결과로 메트릭명을 확인하세요.",
    });
  }

  const category =
    CANDIDATES.find((c) => c.metric === used)?.category ?? "TLS_CERTIFICATE";

  let created = 0;
  let updated = 0;
  const details: { name: string; expiresAt: string }[] = [];

  for (const s of series) {
    const labels = s.metric || {};
    const unixSeconds = s.value ? parseFloat(s.value[1]) : NaN;
    if (isNaN(unixSeconds) || unixSeconds <= 0) continue;

    const expiresAt = new Date(unixSeconds * 1000);
    const source = labelSource(used, labels);
    const name = labelName(labels);

    const existing = await prisma.expiryTracker.findFirst({ where: { source } });

    if (existing) {
      // Only touch auto-collected rows; never clobber a manual edit's expiry.
      await prisma.expiryTracker.update({
        where: { id: existing.id },
        data: {
          expiresAt,
          name,
          // If a previously-expired cert was renewed (new future date), reactivate.
          status: expiresAt > new Date() ? "ACTIVE" : existing.status,
        },
      });
      updated++;
    } else {
      await prisma.expiryTracker.create({
        data: {
          name,
          category,
          description: `Prometheus ${used} 에서 자동 수집`,
          expiresAt,
          notifyDays: 30,
          source,
          createdBy: user.id,
          metadata: labels,
        },
      });
      created++;
    }
    if (details.length < 50) {
      details.push({ name, expiresAt: expiresAt.toISOString().slice(0, 10) });
    }
  }

  return NextResponse.json({
    metric: used,
    found: series.length,
    created,
    updated,
    details,
  });
}
