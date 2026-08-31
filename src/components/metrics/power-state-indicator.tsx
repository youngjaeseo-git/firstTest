"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { queries } from "@/lib/prometheus";

type PowerState = "running" | "idle" | "off" | "unknown";

export function PowerStateIndicator({
  hostname,
  ipAddress,
}: {
  hostname?: string | null;
  ipAddress?: string | null;
}) {
  const [state, setState] = useState<PowerState>("unknown");

  useEffect(() => {
    async function check() {
      try {
        const upQuery = queries.allNodesUp();
        const cpuQuery = queries.fleetCpuPerInstance();

        const [upRes, cpuRes] = await Promise.all([
          fetch(`/api/metrics/instant?query=${encodeURIComponent(upQuery)}`).then((r) => r.json()),
          fetch(`/api/metrics/instant?query=${encodeURIComponent(cpuQuery)}`).then((r) => r.json()),
        ]);

        const keys: string[] = [];
        if (hostname) keys.push(hostname);
        if (ipAddress) {
          keys.push(ipAddress);
          keys.push(`${ipAddress}:9100`);
          keys.push(`${ipAddress}:10250`);
        }

        let isUp = false;
        for (const r of upRes?.data?.result ?? []) {
          const inst = (r.metric?.instance || "").replace(/:\d+$/, "");
          if (keys.some((k) => k === inst || k === r.metric?.instance)) {
            if (parseFloat(r.value?.[1] || "0") >= 1) {
              isUp = true;
              break;
            }
          }
        }

        if (!isUp) {
          setState("off");
          return;
        }

        let maxCpu = 0;
        for (const r of cpuRes?.data?.result ?? []) {
          const inst = (r.metric?.instance || "").replace(/:\d+$/, "");
          if (keys.some((k) => k === inst || k === r.metric?.instance)) {
            const cpu = parseFloat(r.value?.[1] || "0");
            if (cpu > maxCpu) maxCpu = cpu;
          }
        }

        setState(maxCpu > 5 ? "running" : "idle");
      } catch {
        setState("unknown");
      }
    }

    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [hostname, ipAddress]);

  const styles: Record<PowerState, { bg: string; dot: string; label: string }> = {
    running: { bg: "bg-green-500/15 text-green-400", dot: "bg-green-400", label: "Running" },
    idle: { bg: "bg-yellow-500/15 text-yellow-400", dot: "bg-yellow-400", label: "Idle" },
    off: { bg: "bg-gray-500/15 text-gray-500", dot: "bg-gray-500", label: "OFF" },
    unknown: { bg: "bg-gray-800/50 text-gray-600", dot: "bg-gray-600", label: "..." },
  };
  const s = styles[state];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", s.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot, state === "running" && "animate-pulse")} />
      {s.label}
    </span>
  );
}
