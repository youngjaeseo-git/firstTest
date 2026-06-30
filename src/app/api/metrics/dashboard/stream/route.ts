import { NextResponse } from "next/server";
import { fetchDashboardMetrics } from "../fetch-metrics";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/rbac";
import type { Cluster } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

const PUSH_INTERVAL_MS = 15_000;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cluster = (url.searchParams.get("cluster") || "all") as Cluster;
  const encoder = new TextEncoder();

  const equipment = await prisma.equipment.findMany({
    where: { ipAddress: { not: null } },
    select: { ipAddress: true },
  });
  const registeredIps = new Set(
    equipment.map((e) => e.ipAddress!).filter(Boolean),
  );

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | undefined;

      const send = async () => {
        if (closed) return;
        try {
          const metrics = await fetchDashboardMetrics(cluster, registeredIps);
          const payload = `data: ${JSON.stringify(metrics)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Swallow — next tick will retry
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);

      await send();
      interval = setInterval(send, PUSH_INTERVAL_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
