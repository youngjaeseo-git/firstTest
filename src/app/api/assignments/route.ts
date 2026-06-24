import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showHistory = req.nextUrl.searchParams.get("history") === "true";
  const search = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

  const orgFilter = user.role !== "ADMIN"
    ? { equipment: { organizationId: { in: user.orgIds } } }
    : {};

  const assignmentWhere = showHistory
    ? { ...orgFilter }
    : { releasedAt: null, ...orgFilter };

  const assignments = await prisma.equipmentAssignment.findMany({
    where: assignmentWhere,
    orderBy: showHistory
      ? { assignedAt: "desc" }
      : [{ assignedAt: "desc" }],
    include: {
      equipment: {
        select: {
          id: true,
          hostname: true,
          ipAddress: true,
          model: true,
          status: true,
          type: true,
          rack: {
            select: {
              name: true,
              room: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  let result = assignments;
  if (search) {
    result = assignments.filter((a) => {
      const fields = [
        a.assignedTo,
        a.purpose,
        a.equipment.hostname,
        a.equipment.ipAddress,
        a.equipment.model,
        a.equipment.rack?.name,
        a.equipment.rack?.room?.name,
      ];
      return fields.some((f) => f?.toLowerCase().includes(search));
    });
  }

  return NextResponse.json({ items: result });
}
