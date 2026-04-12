import { fetchDashboardMetrics } from "../fetch-metrics";

export const dynamic = "force-dynamic";

const PUSH_INTERVAL_MS = 15_000;

/**
 * Server-Sent Events stream for dashboard metrics.
 *
 * Pushes the full metric snapshot every 15s, plus an initial push on
 * connection. Clients consume via `new EventSource("/api/metrics/dashboard/stream")`.
 *
 * SSE (rather than socket.io) is used because Next.js App Router has no
 * built-in support for socket.io without a custom server — SSE runs on
 * the standard request lifecycle.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let interval: ReturnType<typeof setInterval> | undefined;

      const send = async () => {
        if (closed) return;
        try {
          const metrics = await fetchDashboardMetrics();
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

      // Abort on client disconnect
      request.signal.addEventListener("abort", cleanup);

      // Initial push, then periodic updates
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
