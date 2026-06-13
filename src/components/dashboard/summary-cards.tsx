"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Server, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";

interface EquipmentRef {
  id: string;
  hostname: string | null;
  status: string;
  ipAddress: string | null;
}

interface SummaryCardsProps {
  totalEquipment: number;
  activeCount: number;
  activeList: EquipmentRef[];
  maintenanceCount: number;
  maintenanceList: EquipmentRef[];
  failedCount: number;
  failedList: EquipmentRef[];
  totalRacks: number;
  totalRooms: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: "easeOut" as const },
  }),
};

export function DashboardSummaryCards({
  totalEquipment,
  activeCount,
  activeList,
  maintenanceCount,
  maintenanceList,
  failedCount,
  failedList,
  totalRacks,
  totalRooms,
}: SummaryCardsProps) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Total Equipment */}
      <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
        <Card className="relative overflow-visible border-blue-500/30 bg-gradient-to-br from-blue-600/10 via-blue-600/5 to-transparent hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">
              {t("dashboard.totalEquipment")}
            </h3>
            <div className="rounded-xl bg-blue-500/15 p-2">
              <Server className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-100">
            {activeCount}
            <span className="text-lg text-gray-500">/{totalEquipment}</span>
          </p>
          <div className="mt-3 flex gap-2">
            <HoverStat label={t("dashboard.fleet.active")} count={activeCount} color="green" items={activeList} t={t} />
            <HoverStat label={t("common.maint")} count={maintenanceCount} color="amber" items={maintenanceList} t={t} />
            <HoverStat label={t("dashboard.fleet.failed")} count={failedCount} color="red" items={failedList} t={t} />
          </div>
        </Card>
      </motion.div>

      {/* Infrastructure */}
      <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-600/10 via-purple-600/5 to-transparent hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">{t("nav.infrastructure")}</h3>
            <div className="rounded-xl bg-purple-500/15 p-2">
              <Building2 className="h-5 w-5 text-purple-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-100">{totalRacks}</p>
          <p className="mt-1 text-sm text-gray-400">
            {t("nav.racks")}{" "}
            <span className="font-semibold text-purple-300">{totalRooms}</span>{" "}
            {t("dashboard.rooms")}
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

function HoverStat({
  label,
  count,
  color,
  items,
  t,
}: {
  label: string;
  count: number;
  color: "green" | "amber" | "red";
  items: EquipmentRef[];
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const textColor = {
    green: "text-green-400",
    amber: "text-amber-400",
    red: "text-red-400",
  }[color];
  const borderColor = {
    green: "border-green-500/30",
    amber: "border-amber-500/30",
    red: "border-red-500/30",
  }[color];

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className={cn("cursor-help text-xs font-medium", textColor)}>
        {count} {label}
      </span>
      <AnimatePresence>
        {open && items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border bg-gray-900/95 p-3 shadow-2xl backdrop-blur-md",
              borderColor,
            )}
          >
            <p className={cn("mb-2 text-xs font-semibold", textColor)}>
              {label} ({count})
            </p>
            <div className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-thin">
              {items.map((eq) => (
                <Link
                  key={eq.id}
                  href={`/servers/${eq.id}`}
                  className="block rounded-lg px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-800/60 hover:text-gray-100 transition-colors"
                >
                  <span className="font-mono">
                    {eq.hostname || t("common.unnamed")}
                  </span>
                  {eq.ipAddress && (
                    <span className="ml-2 text-gray-500">{eq.ipAddress}</span>
                  )}
                </Link>
              ))}
              {items.length === 10 && (
                <p className="mt-2 text-center text-[10px] text-gray-600">
                  {t("common.showingFirst10")}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
