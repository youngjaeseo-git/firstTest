"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Server, Wrench, AlertTriangle, Bell, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  firingAlerts: number;
}

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
  firingAlerts,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Equipment - with hoverable sub-stats */}
      <Card className="relative overflow-visible border-blue-500/30 bg-gradient-to-br from-blue-600/10 via-blue-600/5 to-transparent">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">
            Total Equipment
          </h3>
          <div className="rounded-lg bg-blue-500/20 p-2">
            <Server className="h-5 w-5 text-blue-400" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-gray-100">
          {activeCount}
          <span className="text-lg text-gray-500">/{totalEquipment}</span>
        </p>
        <div className="mt-3 flex gap-2">
          <HoverStat
            label="Active"
            count={activeCount}
            color="green"
            items={activeList}
          />
          <HoverStat
            label="Maint."
            count={maintenanceCount}
            color="amber"
            items={maintenanceList}
          />
          <HoverStat
            label="Failed"
            count={failedCount}
            color="red"
            items={failedList}
          />
        </div>
      </Card>

      {/* Infrastructure */}
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-600/10 via-purple-600/5 to-transparent">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Infrastructure</h3>
          <div className="rounded-lg bg-purple-500/20 p-2">
            <Building2 className="h-5 w-5 text-purple-400" />
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold text-gray-100">{totalRacks}</p>
        <p className="mt-1 text-sm text-gray-400">
          Racks across{" "}
          <span className="font-semibold text-purple-300">{totalRooms}</span>{" "}
          rooms
        </p>
      </Card>

      {/* Active Alerts */}
      <Card
        className={cn(
          "border bg-gradient-to-br transition-colors",
          firingAlerts > 0
            ? "border-red-500/40 from-red-600/10 via-red-600/5 to-transparent"
            : "border-green-500/30 from-green-600/10 via-green-600/5 to-transparent",
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Active Alerts</h3>
          <div
            className={cn(
              "rounded-lg p-2",
              firingAlerts > 0 ? "bg-red-500/20" : "bg-green-500/20",
            )}
          >
            <Bell
              className={cn(
                "h-5 w-5",
                firingAlerts > 0 ? "text-red-400" : "text-green-400",
              )}
            />
          </div>
        </div>
        <p
          className={cn(
            "mt-3 text-3xl font-bold",
            firingAlerts > 0 ? "text-red-400" : "text-green-400",
          )}
        >
          {firingAlerts}
        </p>
        <Link
          href="/alerts"
          className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
        >
          View all alerts →
        </Link>
      </Card>

      {/* Health Summary */}
      <Card
        className={cn(
          "border bg-gradient-to-br",
          failedCount > 0
            ? "border-red-500/30 from-red-600/10 via-red-600/5 to-transparent"
            : maintenanceCount > 0
              ? "border-amber-500/30 from-amber-600/10 via-amber-600/5 to-transparent"
              : "border-green-500/30 from-green-600/10 via-green-600/5 to-transparent",
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Health Status</h3>
          <div
            className={cn(
              "rounded-lg p-2",
              failedCount > 0
                ? "bg-red-500/20"
                : maintenanceCount > 0
                  ? "bg-amber-500/20"
                  : "bg-green-500/20",
            )}
          >
            {failedCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-red-400" />
            ) : maintenanceCount > 0 ? (
              <Wrench className="h-5 w-5 text-amber-400" />
            ) : (
              <Server className="h-5 w-5 text-green-400" />
            )}
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold text-gray-100">
          {totalEquipment > 0
            ? Math.round((activeCount / totalEquipment) * 100)
            : 0}
          <span className="text-lg text-gray-500">%</span>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Active ratio · {failedCount} failed, {maintenanceCount} in maint.
        </p>
      </Card>
    </div>
  );
}

function HoverStat({
  label,
  count,
  color,
  items,
}: {
  label: string;
  count: number;
  color: "green" | "amber" | "red";
  items: EquipmentRef[];
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
      {open && items.length > 0 && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border bg-gray-900 p-3 shadow-xl",
            borderColor,
          )}
        >
          <p className={cn("mb-2 text-xs font-semibold", textColor)}>
            {label} ({count})
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {items.map((eq) => (
              <Link
                key={eq.id}
                href={`/servers/${eq.id}`}
                className="block rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 hover:text-gray-100"
              >
                <span className="font-mono">
                  {eq.hostname || "(unnamed)"}
                </span>
                {eq.ipAddress && (
                  <span className="ml-2 text-gray-500">{eq.ipAddress}</span>
                )}
              </Link>
            ))}
            {items.length === 10 && (
              <p className="mt-2 text-center text-[10px] text-gray-500">
                최대 10개 표시
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
