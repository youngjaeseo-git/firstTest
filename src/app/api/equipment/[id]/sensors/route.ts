import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import {
  getBmcCredentials,
  bmcCredentialsConfigured,
  MissingBmcCredentialsError,
} from "@/lib/bmc-credentials";
import { getSensorsData, RedfishError } from "@/lib/redfish";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: { rack: { include: { room: { select: { bmcProxyUrl: true } } } } },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Org-based access check
  if (
    user.role !== "ADMIN" &&
    (!equipment.organizationId || !user.orgIds.includes(equipment.organizationId))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!equipment.bmcIpAddress) {
    return NextResponse.json(
      { error: "No BMC IP configured" },
      { status: 400 },
    );
  }
  if (!bmcCredentialsConfigured()) {
    return NextResponse.json(
      { error: "BMC credentials not configured" },
      { status: 503 },
    );
  }

  let creds;
  try {
    creds = getBmcCredentials(equipment);
  } catch (err) {
    if (err instanceof MissingBmcCredentialsError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  try {
    const sensors = await getSensorsData({
      host: equipment.bmcIpAddress,
      username: creds.username,
      password: creds.password,
      timeoutMs: 10_000,
      proxyUrl: equipment.rack?.room?.bmcProxyUrl ?? undefined,
    });

    return NextResponse.json({
      ...sensors,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message =
      err instanceof RedfishError
        ? err.message
        : "Failed to fetch sensors from BMC";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
