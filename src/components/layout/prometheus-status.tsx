"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "loading" | "ok" | "unreachable";

/**
 * Compact connection indicator for the Prometheus backend.
 * Polls /api/health/prometheus every 30s. Shown in the header so
 * users always know whether live metrics are flowing.
 */
export function PrometheusStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      try {
        const res = await fetch("/api/health/prometheus");
        if (!res.ok) throw new Error("probe failed");
        const json = await res.json();
        if (cancelled) return;
        setStatus(json.status === "ok" ? "ok" : "unreachable");
        setNodeCount(json.nodeCount ?? 0);
      } catch {
        if (!cancelled) setStatus("unreachable");
      }
    }
    probe();
    const id = setInterval(probe, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const ok = status === "ok";
  const Icon = ok ? Activity : AlertTriangle;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium",
        ok
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : status === "loading"
            ? "border-gray-700/60 bg-gray-800/60 text-gray-500"
            : "border-amber-500/30 bg-amber-500/10 text-amber-400",
      )}
      title={
        ok
          ? `Prometheus connected (${nodeCount} targets)`
          : status === "loading"
            ? "Checking Prometheus..."
            : "Prometheus unreachable"
      }
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          ok
            ? "bg-green-400 shadow-sm shadow-green-400/60 animate-pulse"
            : status === "loading"
              ? "bg-gray-500"
              : "bg-amber-400",
        )}
      />
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">
        {ok ? "Prometheus" : status === "loading" ? "..." : "Offline"}
      </span>
    </div>
  );
}
