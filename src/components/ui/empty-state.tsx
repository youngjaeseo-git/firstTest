"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900/50 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-gray-700/20 blur-xl" />
        <div className="relative rounded-2xl bg-gradient-to-br from-gray-700/30 to-gray-800/30 p-4">
          <Icon className="h-10 w-10 text-gray-500" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-base font-semibold text-gray-300">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
