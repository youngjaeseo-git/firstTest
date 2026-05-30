import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { fetchTargets, type DiscoveredPrometheusTarget } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

function instanceIp(instance: string): string {
  return instance.replace(/:\d+$/, "");
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let targets: DiscoveredPrometheusTarget[];
  try {
    targets = await fetchTargets();
  } catch (error) {
    console.error("Discovery diagnostic: Prometheus unreachable", error);
    return NextResponse.json(
      { error: "Failed to fetch Prometheus targets" },
      { status: 502 },
    );
  }

  const [equipmentList, prometheusTargets] = await Promise.all([
    prisma.equipment.findMany({
      select: { id: true, hostname: true, ipAddress: true, prometheusInstance: true },
    }),
    prisma.prometheusTarget.findMany({
      select: { id: true, instance: true, hostname: true, health: true, equipmentId: true },
    }),
  ]);

  // ── ipOnlyTargets ──
  // Live targets where instance host is an IP and labels lack hostname/nodename/node_kubernetes_io_hostname
  const ipOnlyTargets = targets
    .filter((t) => {
      const ip = instanceIp(t.instance);
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
      const labels = t.labels;
      return !labels.hostname && !labels.nodename && !labels.node_kubernetes_io_hostname;
    })
    .map((t) => ({
      instance: t.instance,
      job: t.job,
      ip: instanceIp(t.instance),
    }));

  // ── duplicateScrapes ──
  // Group live targets by IP, find IPs with 2+ distinct jobs
  const ipJobMap = new Map<string, { jobs: Set<string>; instances: Set<string> }>();
  for (const t of targets) {
    const ip = instanceIp(t.instance);
    let entry = ipJobMap.get(ip);
    if (!entry) {
      entry = { jobs: new Set(), instances: new Set() };
      ipJobMap.set(ip, entry);
    }
    entry.jobs.add(t.job);
    entry.instances.add(t.instance);
  }
  const duplicateScrapes = Array.from(ipJobMap.entries())
    .filter(([, v]) => v.jobs.size >= 2)
    .map(([ip, v]) => ({
      ip,
      jobs: Array.from(v.jobs).sort(),
      instances: Array.from(v.instances).sort(),
      count: v.jobs.size,
    }));

  // ── prometheusOrphans ──
  // Live target IPs that don't match any equipment's ipAddress or prometheusInstance host
  const equipmentIpSet = new Set<string>();
  for (const eq of equipmentList) {
    if (eq.ipAddress) equipmentIpSet.add(eq.ipAddress);
    if (eq.prometheusInstance) equipmentIpSet.add(instanceIp(eq.prometheusInstance));
  }
  const prometheusOrphans = targets
    .filter((t) => {
      const ip = instanceIp(t.instance);
      return !equipmentIpSet.has(ip);
    })
    .map((t) => ({
      instance: t.instance,
      job: t.job,
      ip: instanceIp(t.instance),
      health: t.health,
    }));

  // ── dbOrphans ──
  // Equipment rows whose ipAddress doesn't appear in any live target's IP set
  const liveIpSet = new Set<string>();
  for (const t of targets) {
    liveIpSet.add(instanceIp(t.instance));
  }
  const dbOrphans = equipmentList
    .filter((eq) => eq.ipAddress && !liveIpSet.has(eq.ipAddress))
    .map((eq) => ({
      id: eq.id,
      hostname: eq.hostname,
      ipAddress: eq.ipAddress,
    }));

  // ── summary ──
  const summary = {
    totalLiveTargets: targets.length,
    totalEquipment: equipmentList.length,
    ipOnlyCount: ipOnlyTargets.length,
    duplicateCount: duplicateScrapes.length,
    promOrphanCount: prometheusOrphans.length,
    dbOrphanCount: dbOrphans.length,
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json({
    ipOnlyTargets,
    duplicateScrapes,
    prometheusOrphans,
    dbOrphans,
    summary,
  });
}
