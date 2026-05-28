import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user as unknown as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const header = "Date,User,Action,Entity Type,Entity ID,Changes,Reason";
  const rows = logs.map((log) => {
    const date = log.createdAt.toISOString();
    const userName = log.user?.name || log.user?.email || log.userId;
    const changes = log.changes ? JSON.stringify(log.changes).replace(/"/g, '""') : "";
    const reason = (log.reason || "").replace(/"/g, '""');
    return `${date},"${userName}",${log.action},${log.entityType},${log.entityId},"${changes}","${reason}"`;
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
