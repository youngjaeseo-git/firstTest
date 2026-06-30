"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { HardDrive, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";

interface FsWarning {
  instance: string;
  hostname: string;
  equipmentId: string | null;
  usagePercent: number;
  mountpoint: string;
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.2, duration: 0.35, ease: "easeOut" as const },
  },
};

export function FilesystemWarnings({
  serverMap = {},
}: {
  serverMap?: Record<string, { hostname: string; id: string }>;
}) {
  const t = useT();
  const [warnings, setWarnings] = useState<FsWarning[]>([]);
  const [loading, setLoading] = useState(true);

  const resolveServer = useCallback(
    (instance: string): { hostname: string; equipmentId: string | null } => {
      const ip = instance.replace(/:\d+$/, "");
      const entry = serverMap[ip];
      // Show hostname when registered; fall back to raw IP otherwise.
      return { hostname: entry?.hostname ?? ip, equipmentId: entry?.id ?? null };
    },
    [serverMap],
  );

  const fetchFs = useCallback(async () => {
    try {
      // No job filter: the same node-exporter is scraped under several jobs
      // (node-exporter, kubernetes-pods, server-info) and some servers appear
      // ONLY under non-"node-exporter" jobs — filtering by job would hide them.
      // We include all and dedup per server (by equipmentId) below.
      const query = `(1 - node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"} / node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|devtmpfs|overlay"}) * 100`;
      const res = await fetch(
        `/api/metrics/instant?query=${encodeURIComponent(query)}`,
      );
      if (!res.ok) return;
      const json = await res.json();
      const results = json?.data?.result ?? [];

      // Dedup by server (equipmentId, or hostname when unregistered): if a server
      // is still scraped twice (e.g. IP + hostname instance), keep the higher usage.
      const byServer = new Map<string, FsWarning>();
      for (const r of results) {
        if (!r.value) continue;
        const usage = parseFloat(r.value[1]);
        if (usage < 70) continue;
        const instance = r.metric.instance || "";
        const { hostname, equipmentId } = resolveServer(instance);
        const key = equipmentId ?? hostname;
        const item: FsWarning = {
          instance,
          hostname,
          equipmentId,
          usagePercent: Math.round(usage * 10) / 10,
          mountpoint: r.metric.mountpoint || "/",
        };
        const existing = byServer.get(key);
        if (!existing || item.usagePercent > existing.usagePercent) {
          byServer.set(key, item);
        }
      }
      const items = Array.from(byServer.values()).sort(
        (a, b) => b.usagePercent - a.usagePercent,
      );
      setWarnings(items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [resolveServer]);

  useEffect(() => {
    fetchFs();
    const timer = setInterval(fetchFs, 60_000);
    return () => clearInterval(timer);
  }, [fetchFs]);

  const ROW_CLASS =
    "group flex items-center gap-3 rounded-lg border border-gray-800 px-3 py-2 transition-colors";

  if (loading || warnings.length === 0) return null;

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible">
      <Card>
        <SectionHeading
          icon={HardDrive}
          accent="amber"
          title={
            <>
              {t("dashboard.filesystemWarnings")}{" "}
              <span className="font-normal normal-case text-gray-500">
                ({">"}70%)
              </span>
            </>
          }
          right={
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {warnings.length} server{warnings.length !== 1 ? "s" : ""}
            </span>
          }
        />
        <div className="space-y-2">
          {warnings.map((w) => {
            const color =
              w.usagePercent >= 90
                ? "bg-red-500"
                : w.usagePercent >= 80
                  ? "bg-orange-500"
                  : "bg-amber-500";
            const textColor =
              w.usagePercent >= 90
                ? "text-red-400"
                : w.usagePercent >= 80
                  ? "text-orange-400"
                  : "text-amber-400";

            const inner = (
              <>
                <span className={cn("font-mono text-sm", textColor)}>
                  {w.hostname}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${Math.min(w.usagePercent, 100)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "w-14 text-right font-mono text-xs font-semibold",
                    textColor,
                  )}
                >
                  {w.usagePercent.toFixed(1)}%
                </span>
              </>
            );

            // Link only when the server is registered (route resolves by id, not hostname).
            return w.equipmentId ? (
              <Link
                key={w.instance}
                href={`/servers/${w.equipmentId}`}
                className={cn(ROW_CLASS, "hover:border-amber-500/30")}
              >
                {inner}
              </Link>
            ) : (
              <div key={w.instance} className={ROW_CLASS}>
                {inner}
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
