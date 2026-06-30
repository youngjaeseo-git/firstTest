export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/rbac";
import { parseBody } from "@/lib/api-validation";
import { logAudit } from "@/lib/audit";

const CreateRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  metric: z.string().trim().min(1).max(2000),
  condition: z.string().trim().min(1).max(200),
  duration: z.number().int().min(0).max(86400).optional(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  category: z.string().trim().max(100).optional().nullable(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prisma.alertRule.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { alerts: true } } },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || !["ADMIN", "OPERATOR"].includes(role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseBody(req, CreateRuleSchema);
  if (parsed.response) return parsed.response;
  const { name, description, metric, condition, duration, severity, category, enabled } =
    parsed.data;

  const rule = await prisma.alertRule.create({
    data: {
      name,
      description: description || null,
      metric,
      condition,
      duration: duration ?? 60,
      severity,
      category: category || null,
      enabled: enabled !== false,
    },
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "CREATE",
    entityType: "AlertRule",
    entityId: rule.id,
    changes: { name: rule.name, severity: rule.severity, metric: rule.metric, condition: rule.condition },
  });

  return NextResponse.json(rule, { status: 201 });
}
