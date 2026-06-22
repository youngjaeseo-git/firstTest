import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bmcCredentialsConfigured } from "@/lib/bmc-credentials";
import { getSensorsData } from "@/lib/redfish";

export const dynamic = "force-dynamic";

const INLET_KEYWORDS = ["INLET", "AMBIENT", "INTAKE", "FRONT"];

function isInletSensor(name: string): boolean {
  const upper = name.toUpperCase();
  return INLET_KEYWORDS.some((kw) => upper.includes(kw));
}

export async function GET() {
  if (!bmcCredentialsConfigured()) {
    return NextResponse.json({ avgInletTemp: null, serverCount: 0, sensorCount: 0 });
  }

  const username = process.env.BMC_USERNAME!;
  const password = process.env.BMC_PASSWORD!;

  const equipments = await prisma.equipment.findMany({
    where: { bmcIpAddress: { not: null } },
    select: { bmcIpAddress: true },
  });

  if (equipments.length === 0) {
    return NextResponse.json({ avgInletTemp: null, serverCount: 0, sensorCount: 0 });
  }

  const allTemps: number[] = [];
  let queriedServers = 0;

  const results = await Promise.allSettled(
    equipments.map(async (eq) => {
      if (!eq.bmcIpAddress) return null;
      try {
        const sensors = await getSensorsData({
          host: eq.bmcIpAddress,
          username,
          password,
          timeoutMs: 8_000,
        });
        return sensors.temperatures
          .filter((t) => t.readingCelsius !== null && isInletSensor(t.name))
          .map((t) => t.readingCelsius as number);
      } catch {
        return null;
      }
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value && r.value.length > 0) {
      queriedServers++;
      allTemps.push(...r.value);
    }
  }

  const avgInletTemp =
    allTemps.length > 0
      ? Math.round((allTemps.reduce((a, b) => a + b, 0) / allTemps.length) * 10) / 10
      : null;

  return NextResponse.json({
    avgInletTemp,
    serverCount: queriedServers,
    sensorCount: allTemps.length,
  });
}
