import { PrismaClient, AlertSeverity, AlertStatus } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Helper: return a Date that is `daysAgo` days before now, at a given hour/minute.
 */
function daysAgoAt(daysAgo: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding alert data...");

  // -------------------------------------------------------
  // 0. Find the first user in the DB for acknowledgements
  // -------------------------------------------------------
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!firstUser) {
    throw new Error("No users found in the database. Run the main seed first: npx tsx prisma/seed.ts");
  }
  console.log(`Using user "${firstUser.name}" (${firstUser.email}) for acknowledgements`);

  // -------------------------------------------------------
  // 1. AlertRules
  // -------------------------------------------------------
  const ruleHighCpu = await prisma.alertRule.upsert({
    where: { id: "rule-high-cpu" },
    update: {},
    create: {
      id: "rule-high-cpu",
      name: "High CPU Usage",
      description: "Fires when any server CPU utilization exceeds 90% for 5 minutes",
      metric: '100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
      condition: "> 90",
      duration: 300,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      enabled: true,
    },
  });

  const ruleDiskCritical = await prisma.alertRule.upsert({
    where: { id: "rule-disk-critical" },
    update: {},
    create: {
      id: "rule-disk-critical",
      name: "Disk Space Critical",
      description: "Fires when filesystem usage exceeds 95%",
      metric: '(1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes) * 100',
      condition: "> 95",
      duration: 60,
      severity: AlertSeverity.CRITICAL,
      category: "Storage",
      enabled: true,
    },
  });

  const ruleMemoryPressure = await prisma.alertRule.upsert({
    where: { id: "rule-memory-pressure" },
    update: {},
    create: {
      id: "rule-memory-pressure",
      name: "Memory Pressure",
      description: "Fires when available memory drops below 15% of total",
      metric: "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
      condition: "> 85",
      duration: 300,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      enabled: true,
    },
  });

  const ruleNetDown = await prisma.alertRule.upsert({
    where: { id: "rule-net-interface-down" },
    update: {},
    create: {
      id: "rule-net-interface-down",
      name: "Network Interface Down",
      description: "Fires when a network interface operstate is not up",
      metric: "node_network_up",
      condition: "== 0",
      duration: 120,
      severity: AlertSeverity.CRITICAL,
      category: "Network",
      enabled: true,
    },
  });

  console.log("Created 4 alert rules");

  // -------------------------------------------------------
  // 2. Alerts (18 total)
  //    FIRING: 6, ACKNOWLEDGED: 4, RESOLVED: 8
  //    CRITICAL: 5, WARNING: 6, INFO: 4, + mix to reach 18
  // -------------------------------------------------------
  const alertDefs: {
    id: string;
    ruleId: string | null;
    status: AlertStatus;
    severity: AlertSeverity;
    category: string;
    summary: string;
    details: string | null;
    source: string | null;
    firedAt: Date;
    resolvedAt: Date | null;
  }[] = [
    // --- FIRING (6) ---
    {
      id: "alert-001",
      ruleId: ruleHighCpu.id,
      status: AlertStatus.FIRING,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      summary: "CPU usage at 95% on svr-a001",
      details: "Sustained high CPU utilization detected across all cores. Top process: java (PID 4521) consuming 82% CPU.",
      source: "prometheus",
      firedAt: daysAgoAt(0, 9, 15),
      resolvedAt: null,
    },
    {
      id: "alert-002",
      ruleId: ruleDiskCritical.id,
      status: AlertStatus.FIRING,
      severity: AlertSeverity.CRITICAL,
      category: "Storage",
      summary: "Disk /data at 98% on svr-b003",
      details: "Filesystem /data has only 41 GB remaining out of 2 TB. Growth rate: 15 GB/day.",
      source: "prometheus",
      firedAt: daysAgoAt(0, 8, 42),
      resolvedAt: null,
    },
    {
      id: "alert-003",
      ruleId: ruleNetDown.id,
      status: AlertStatus.FIRING,
      severity: AlertSeverity.CRITICAL,
      category: "Network",
      summary: "Network interface eth1 down on svr-a007",
      details: "Interface eth1 (25GbE) has been in operstate=down for 15 minutes. Last seen up at 08:25.",
      source: "prometheus",
      firedAt: daysAgoAt(0, 8, 40),
      resolvedAt: null,
    },
    {
      id: "alert-004",
      ruleId: ruleMemoryPressure.id,
      status: AlertStatus.FIRING,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      summary: "Memory usage at 91% on svr-b005",
      details: "Available memory: 46 GB out of 512 GB. OOM killer has not triggered yet.",
      source: "prometheus",
      firedAt: daysAgoAt(1, 14, 30),
      resolvedAt: null,
    },
    {
      id: "alert-005",
      ruleId: ruleHighCpu.id,
      status: AlertStatus.FIRING,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      summary: "CPU usage at 93% on svr-a012",
      details: null,
      source: "prometheus",
      firedAt: daysAgoAt(1, 11, 5),
      resolvedAt: null,
    },
    {
      id: "alert-006",
      ruleId: null,
      status: AlertStatus.FIRING,
      severity: AlertSeverity.INFO,
      category: "Performance",
      summary: "GPU temperature at 78C on svr-a004",
      details: "NVIDIA A100 GPU0 temperature approaching thermal throttle threshold (83C).",
      source: null,
      firedAt: daysAgoAt(0, 10, 20),
      resolvedAt: null,
    },

    // --- ACKNOWLEDGED (4) ---
    {
      id: "alert-007",
      ruleId: ruleDiskCritical.id,
      status: AlertStatus.ACKNOWLEDGED,
      severity: AlertSeverity.CRITICAL,
      category: "Storage",
      summary: "Disk /var/log at 96% on svr-a002",
      details: "Log rotation may have failed. Largest file: /var/log/syslog (120 GB).",
      source: "prometheus",
      firedAt: daysAgoAt(2, 6, 15),
      resolvedAt: null,
    },
    {
      id: "alert-008",
      ruleId: ruleHighCpu.id,
      status: AlertStatus.ACKNOWLEDGED,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      summary: "CPU usage at 92% on svr-b010",
      details: "High CPU due to scheduled batch processing job. Expected to complete by 18:00.",
      source: "prometheus",
      firedAt: daysAgoAt(2, 13, 45),
      resolvedAt: null,
    },
    {
      id: "alert-009",
      ruleId: ruleNetDown.id,
      status: AlertStatus.ACKNOWLEDGED,
      severity: AlertSeverity.CRITICAL,
      category: "Network",
      summary: "Network interface bond0 degraded on svr-a009",
      details: "bond0 running on single slave (eth0). eth1 is down. Redundancy lost.",
      source: "prometheus",
      firedAt: daysAgoAt(3, 22, 10),
      resolvedAt: null,
    },
    {
      id: "alert-010",
      ruleId: ruleMemoryPressure.id,
      status: AlertStatus.ACKNOWLEDGED,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      summary: "Memory usage at 88% on svr-a005",
      details: null,
      source: "prometheus",
      firedAt: daysAgoAt(3, 16, 0),
      resolvedAt: null,
    },

    // --- RESOLVED (8) ---
    {
      id: "alert-011",
      ruleId: ruleHighCpu.id,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      summary: "CPU usage at 94% on svr-b002",
      details: "Spike caused by unoptimized cron job. Job has been fixed and redeployed.",
      source: "prometheus",
      firedAt: daysAgoAt(3, 2, 30),
      resolvedAt: daysAgoAt(3, 4, 15),
    },
    {
      id: "alert-012",
      ruleId: ruleDiskCritical.id,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.CRITICAL,
      category: "Storage",
      summary: "Disk /data at 97% on svr-a003",
      details: "Old backup files cleaned up. Current usage: 72%.",
      source: "prometheus",
      firedAt: daysAgoAt(4, 9, 0),
      resolvedAt: daysAgoAt(4, 11, 30),
    },
    {
      id: "alert-013",
      ruleId: ruleMemoryPressure.id,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.WARNING,
      category: "Performance",
      summary: "Memory usage at 89% on svr-b008",
      details: "Memory leak in application container fixed after restart.",
      source: "prometheus",
      firedAt: daysAgoAt(4, 15, 20),
      resolvedAt: daysAgoAt(4, 16, 45),
    },
    {
      id: "alert-014",
      ruleId: null,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.INFO,
      category: "maintenance",
      summary: "Scheduled maintenance completed on rack-a-a-02",
      details: "Firmware update applied to all servers in rack A02. No issues found.",
      source: null,
      firedAt: daysAgoAt(5, 22, 0),
      resolvedAt: daysAgoAt(6, 6, 0),
    },
    {
      id: "alert-015",
      ruleId: ruleNetDown.id,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.CRITICAL,
      category: "Network",
      summary: "Network interface eth0 down on svr-b006",
      details: "Cable reseated. Interface came back up after physical inspection.",
      source: "prometheus",
      firedAt: daysAgoAt(5, 3, 10),
      resolvedAt: daysAgoAt(5, 3, 55),
    },
    {
      id: "alert-016",
      ruleId: null,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.INFO,
      category: "Performance",
      summary: "High load average (12.5) on svr-a006",
      details: "Transient spike during deployment. Returned to normal within 10 minutes.",
      source: null,
      firedAt: daysAgoAt(6, 14, 0),
      resolvedAt: daysAgoAt(6, 14, 10),
    },
    {
      id: "alert-017",
      ruleId: ruleDiskCritical.id,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.WARNING,
      category: "Storage",
      summary: "Disk /tmp at 90% on svr-a010",
      details: "Temporary build artifacts cleaned. Automated cleanup cron added.",
      source: "prometheus",
      firedAt: daysAgoAt(6, 8, 30),
      resolvedAt: daysAgoAt(6, 9, 0),
    },
    {
      id: "alert-018",
      ruleId: null,
      status: AlertStatus.RESOLVED,
      severity: AlertSeverity.INFO,
      category: "memory",
      summary: "ECC correctable error detected on svr-a002 DIMM_B1",
      details: "Single-bit ECC error corrected. Total correctable errors: 3 in 24h. Below threshold.",
      source: null,
      firedAt: daysAgoAt(7, 5, 45),
      resolvedAt: daysAgoAt(7, 5, 45),
    },
  ];

  for (const def of alertDefs) {
    await prisma.alert.upsert({
      where: { id: def.id },
      update: {
        ruleId: def.ruleId,
        status: def.status,
        severity: def.severity,
        category: def.category,
        summary: def.summary,
        details: def.details,
        source: def.source,
        firedAt: def.firedAt,
        resolvedAt: def.resolvedAt,
      },
      create: {
        id: def.id,
        ruleId: def.ruleId,
        status: def.status,
        severity: def.severity,
        category: def.category,
        summary: def.summary,
        details: def.details,
        source: def.source,
        firedAt: def.firedAt,
        resolvedAt: def.resolvedAt,
      },
    });
  }

  console.log(`Created ${alertDefs.length} alerts (FIRING: 6, ACKNOWLEDGED: 4, RESOLVED: 8)`);

  // -------------------------------------------------------
  // 3. AlertAcknowledgements (linked to ACKNOWLEDGED alerts)
  // -------------------------------------------------------
  const ackDefs: { id: string; alertId: string; note: string }[] = [
    {
      id: "ack-001",
      alertId: "alert-007",
      note: "Investigating log rotation failure. Ticket INFRA-2341 created.",
    },
    {
      id: "ack-002",
      alertId: "alert-008",
      note: "Expected behavior - scheduled batch job. Will auto-resolve by 18:00.",
    },
    {
      id: "ack-003",
      alertId: "alert-009",
      note: "Scheduled maintenance for cable replacement tomorrow. Redundancy temporarily lost.",
    },
    {
      id: "ack-004",
      alertId: "alert-010",
      note: "Team notified. Monitoring for further increase before taking action.",
    },
  ];

  for (const ack of ackDefs) {
    await prisma.alertAcknowledgement.upsert({
      where: { id: ack.id },
      update: {
        note: ack.note,
      },
      create: {
        id: ack.id,
        alertId: ack.alertId,
        userId: firstUser.id,
        note: ack.note,
        ackedAt: new Date(),
      },
    });
  }

  console.log(`Created ${ackDefs.length} acknowledgements (user: ${firstUser.email})`);

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------
  const counts = await Promise.all([
    prisma.alertRule.count(),
    prisma.alert.count(),
    prisma.alertAcknowledgement.count(),
  ]);
  console.log(`\nDatabase totals: ${counts[0]} rules, ${counts[1]} alerts, ${counts[2]} acknowledgements`);
  console.log("Alert seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
