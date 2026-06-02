import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import { instantQuery } from "@/lib/prometheus";

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await instantQuery("node_uname_info");

    if (result.status !== "success" || !result.data?.result) {
      return NextResponse.json(
        { error: "Prometheus query failed", updated: 0 },
        { status: 502 },
      );
    }

    const equipment = await prisma.equipment.findMany({
      select: {
        id: true,
        ipAddress: true,
        hostname: true,
        osType: true,
        osVersion: true,
        prometheusInstance: true,
        prometheusTarget: { select: { instance: true } },
      },
    });

    const ipToEquipment = new Map<string, (typeof equipment)[0]>();
    for (const eq of equipment) {
      if (eq.ipAddress) ipToEquipment.set(eq.ipAddress, eq);
    }

    let updated = 0;
    const details: { hostname: string | null; ip: string; osType: string; osVersion: string }[] = [];

    for (const entry of result.data.result) {
      const labels = entry.metric;
      const instance = labels.instance || "";
      const ip = instance.split(":")[0];

      if (!ip) continue;

      const eq = ipToEquipment.get(ip);
      if (!eq) continue;

      const sysname = labels.sysname || "";
      const release = labels.release || "";
      const version = labels.version || "";
      const machine = labels.machine || "";
      const nodename = labels.nodename || "";

      const osType = sysname || "Linux";
      const osVersion = [release, machine].filter(Boolean).join(" ");

      if (eq.osType === osType && eq.osVersion === osVersion) continue;

      await prisma.equipment.update({
        where: { id: eq.id },
        data: {
          osType,
          osVersion: osVersion || null,
          ...(nodename && !eq.hostname ? { hostname: nodename } : {}),
        },
      });

      updated++;
      details.push({
        hostname: eq.hostname || nodename,
        ip,
        osType,
        osVersion,
      });
    }

    return NextResponse.json({
      updated,
      total: result.data.result.length,
      details,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
        updated: 0,
      },
      { status: 502 },
    );
  }
}
