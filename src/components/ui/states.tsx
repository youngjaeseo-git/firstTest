"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import { Inbox, AlertTriangle } from "lucide-react";

export function EmptyState({
  message,
  className,
  height,
  icon = true,
}: {
  message?: string;
  className?: string;
  height?: number;
  icon?: boolean;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-6 text-center text-gray-600",
        className,
      )}
      style={height ? { height } : undefined}
    >
      {icon && <Inbox className="h-5 w-5 text-gray-700" />}
      <p className="text-sm">{message || t("common.noData")}</p>
    </div>
  );
}

export function MetricError({
  message,
  hint,
  height,
}: {
  message?: string;
  hint?: string;
  height?: number;
}) {
  const t = useT();
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-sm text-gray-500"
      style={height ? { height } : undefined}
    >
      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
        <p className="text-xs font-medium text-red-400">
          {message || t("common.error")}
        </p>
      </div>
      {hint && <p className="text-[11px] text-gray-600">{hint}</p>}
    </div>
  );
}
