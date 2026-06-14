import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveMaintenanceWindows, isAlertSuppressed } from "@/lib/alert-suppression";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");
  const category = searchParams.get("category");
  const excludeSuppressed = searchParams.get("excludeSuppressed") === "1";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100") || 100));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (category) where.category = category;

  const [rawItems, total, windows] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: { rule: true, acknowledgement: { include: { user: true } } },
      orderBy: { firedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.alert.count({ where }),
    getActiveMaintenanceWindows(),
  ]);

  let items = rawItems.map((a) => ({
    ...a,
    suppressed: isAlertSuppressed(a, windows),
  }));
  const suppressedCount = items.filter((a) => a.suppressed).length;
  if (excludeSuppressed) {
    items = items.filter((a) => !a.suppressed);
  }

  return NextResponse.json({
    items,
    total,
    suppressedCount,
    maintenanceActive: windows.length > 0,
    page,
    limit,
  });
}
