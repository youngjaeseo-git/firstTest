export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { logAudit } from "@/lib/audit";

const CreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    endTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
    targetType: z.enum(["all", "source", "category"]).default("all"),
    targetValue: z.string().trim().max(200).optional().nullable(),
    enabled: z.boolean().optional(),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export async function GET() {
  try {
    const windows = await prisma.maintenanceWindow.findMany({
      orderBy: { startTime: "desc" },
    });
    return NextResponse.json(windows);
  } catch {
    // Table may not exist before migration.
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !["ADMIN", "OPERATOR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, CreateSchema);
  if (parsed.response) return parsed.response;
  const d = parsed.data;

  const win = await prisma.maintenanceWindow.create({
    data: {
      name: d.name,
      description: d.description || null,
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      targetType: d.targetType,
      targetValue: d.targetType === "all" ? null : d.targetValue || null,
      enabled: d.enabled !== false,
      createdBy: (session.user as { id: string }).id,
    },
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "CREATE",
    entityType: "MaintenanceWindow",
    entityId: win.id,
    changes: { name: win.name, targetType: win.targetType, targetValue: win.targetValue },
  });

  return NextResponse.json(win, { status: 201 });
}
