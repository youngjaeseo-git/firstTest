import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Accent = "blue" | "violet" | "cyan" | "green" | "amber" | "red" | "gray";

const ACCENT_BG: Record<Accent, string> = {
  blue: "bg-blue-500/15",
  violet: "bg-violet-500/15",
  cyan: "bg-cyan-500/15",
  green: "bg-green-500/15",
  amber: "bg-amber-500/15",
  red: "bg-red-500/15",
  gray: "bg-gray-700/50",
};

const ACCENT_TEXT: Record<Accent, string> = {
  blue: "text-blue-400",
  violet: "text-violet-400",
  cyan: "text-cyan-400",
  green: "text-green-400",
  amber: "text-amber-400",
  red: "text-red-400",
  gray: "text-gray-400",
};

export function SectionHeading({
  icon: Icon,
  title,
  accent = "gray",
  right,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  accent?: Accent;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={cn("rounded-lg p-1.5", ACCENT_BG[accent])}>
            <Icon className={cn("h-4 w-4", ACCENT_TEXT[accent])} />
          </div>
        )}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
          {title}
        </h3>
      </div>
      {right}
    </div>
  );
}
