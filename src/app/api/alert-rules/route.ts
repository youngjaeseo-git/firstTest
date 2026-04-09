export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
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

  const body = await req.json();
  const { name, description, metric, condition, duration, severity, category, enabled } = body;

  if (!name || !metric || !condition || !severity) {
    return NextResponse.json(
      { error: "name, metric, condition, severity는 필수입니다." },
      { status: 400 }
    );
  }

  const rule = await prisma.alertRule.create({
    data: {
      name,
      description: description || null,
      metric,
      condition,
      duration: duration || 60,
      severity,
      category: category || null,
      enabled: enabled !== false,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
