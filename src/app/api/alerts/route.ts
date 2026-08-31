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
  // Date range (server-side so count/pagination match the filtered set).
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (category) where.category = category;
  if (from || to) {
    const firedAt: Record<string, Date> = {};
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && !isNaN(fromDate.getTime())) firedAt.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) firedAt.lte = toDate;
    if (Object.keys(firedAt).length > 0) where.firedAt = firedAt;
  }

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
