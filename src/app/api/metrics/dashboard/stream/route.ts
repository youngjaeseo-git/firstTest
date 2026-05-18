import { fetchDashboardMetrics } from "../fetch-metrics";
import type { Cluster } from "@/lib/prometheus";

export const dynamic = "force-dynamic";

const PUSH_INTERVAL_MS = 15_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cluster = (url.searchParams.get("cluster") || "all") as Cluster;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | undefined;

      const send = async () => {
        if (closed) return;
        try {
          const metrics = await fetchDashboardMetrics(cluster);
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
