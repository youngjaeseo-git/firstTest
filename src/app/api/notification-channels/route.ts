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
  type: z.enum(["EMAIL", "SLACK", "TEAMS", "WEBHOOK"]),
  target: z.string().trim().min(1).max(500),
  minSeverity: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const channels = await prisma.notificationChannel.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(channels);
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

  const channel = await prisma.notificationChannel.create({
    data: {
      name: d.name,
      type: d.type,
      target: d.target,
      minSeverity: d.minSeverity ?? "WARNING",
      enabled: d.enabled !== false,
    },
  });

  await logAudit({
    userId: (session.user as { id: string }).id,
    action: "CREATE",
    entityType: "NotificationChannel",
    entityId: channel.id,
    changes: { name: channel.name, type: channel.type },
  });

  return NextResponse.json(channel, { status: 201 });
}
