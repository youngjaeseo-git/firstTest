export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { logAudit } from "@/lib/audit";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  afterMinutes: z.number().int().min(1).max(10080),
  channelId: z.string().trim().min(1).optional().nullable(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const policies = await prisma.escalationPolicy.findMany({
      orderBy: [{ severity: "asc" }, { afterMinutes: "asc" }],
      include: { channel: { select: { id: true, name: true, type: true } } },
    });
    return NextResponse.json(policies);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, CreateSchema);
  if (parsed.response) return parsed.response;
  const d = parsed.data;

  const policy = await prisma.escalationPolicy.create({
    data: {
      name: d.name,
      description: d.description || null,
      severity: d.severity,
      afterMinutes: d.afterMinutes,
      channelId: d.channelId || null,
      enabled: d.enabled !== false,
    },
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "CREATE",
    entityType: "EscalationPolicy",
    entityId: policy.id,
    changes: { name: policy.name, severity: policy.severity, afterMinutes: policy.afterMinutes },
  });

  return NextResponse.json(policy, { status: 201 });
}
