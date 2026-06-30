import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  const status = searchParams.get("status");
  const before = searchParams.get("before");

  if (id) {
    await prisma.alert.delete({ where: { id } });
    return NextResponse.json({ deleted: 1 });
  }

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (before) {
    const beforeDate = new Date(before);
    if (isNaN(beforeDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'before' date parameter" },
        { status: 400 },
      );
    }
    where.firedAt = { lt: beforeDate };
  }

  if (Object.keys(where).length === 0) {
    return NextResponse.json(
      { error: "Specify id, status, or before parameter" },
      { status: 400 },
    );
  }

  const result = await prisma.alert.deleteMany({ where });
  return NextResponse.json({ deleted: result.count });
}
