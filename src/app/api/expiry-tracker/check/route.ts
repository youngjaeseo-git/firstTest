import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const items = await prisma.expiryTracker.findMany({
    where: { status: "ACTIVE" },
  });

  let alertsCreated = 0;
  let expiredCount = 0;

  for (const item of items) {
    const daysLeft = Math.ceil(
      (item.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft < 0) {
      await prisma.expiryTracker.update({
        where: { id: item.id },
        data: { status: "EXPIRED" },
      });
      expiredCount++;

      const existing = await prisma.alert.findFirst({
        where: {
          source: `expiry:${item.id}`,
          status: "FIRING",
        },
      });

      if (!existing) {
        await prisma.alert.create({
          data: {
            severity: "CRITICAL",
            category: "expiry",
            summary: `[만료] ${item.name} — ${Math.abs(daysLeft)}일 경과`,
            details: `카테고리: ${item.category}, 만기일: ${item.expiresAt.toISOString().slice(0, 10)}, 출처: ${item.source || "-"}`,
            source: `expiry:${item.id}`,
            status: "FIRING",
          },
        });
        alertsCreated++;
      }
    } else if (daysLeft <= item.notifyDays) {
      const existing = await prisma.alert.findFirst({
        where: {
          source: `expiry:${item.id}`,
          status: "FIRING",
        },
      });

      if (!existing) {
        await prisma.alert.create({
          data: {
            severity: daysLeft <= 7 ? "WARNING" : "INFO",
            category: "expiry",
            summary: `[만기 ${daysLeft}일 전] ${item.name}`,
            details: `카테고리: ${item.category}, 만기일: ${item.expiresAt.toISOString().slice(0, 10)}, 출처: ${item.source || "-"}`,
            source: `expiry:${item.id}`,
            status: "FIRING",
          },
        });
        alertsCreated++;
      }
    }
  }

  return NextResponse.json({
    checked: items.length,
    expired: expiredCount,
    alertsCreated,
  });
}
