import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/equipment/[id]/history
 * Returns audit log entries for this equipment, newest first.
 * Available to any authenticated user (read-only).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = parseInt(
    req.nextUrl.searchParams.get("limit") || "50",
    10,
  );
  const limit = Math.min(Math.max(limitParam || 50, 1), 200);

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "Equipment", entityId: params.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ items: entries });
}
