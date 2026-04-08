import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "100");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (category) where.category = category;

  const [items, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: { rule: true, acknowledgement: { include: { user: true } } },
      orderBy: { firedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.alert.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, limit });
}
