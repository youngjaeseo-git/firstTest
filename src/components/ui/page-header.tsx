import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const accentStyles = {
  blue:   { bg: "from-blue-500/20 to-blue-600/5",     ring: "ring-blue-500/20",   icon: "text-blue-400" },
  green:  { bg: "from-green-500/20 to-green-600/5",    ring: "ring-green-500/20",  icon: "text-green-400" },
  purple: { bg: "from-purple-500/20 to-purple-600/5",  ring: "ring-purple-500/20", icon: "text-purple-400" },
  red:    { bg: "from-red-500/20 to-red-600/5",        ring: "ring-red-500/20",    icon: "text-red-400" },
  amber:  { bg: "from-amber-500/20 to-amber-600/5",    ring: "ring-amber-500/20",  icon: "text-amber-400" },
  violet: { bg: "from-violet-500/20 to-violet-600/5",  ring: "ring-violet-500/20", icon: "text-violet-400" },
  cyan:   { bg: "from-cyan-500/20 to-cyan-600/5",      ring: "ring-cyan-500/20",   icon: "text-cyan-400" },
  gray:   { bg: "from-gray-500/15 to-gray-600/5",      ring: "ring-gray-500/15",   icon: "text-gray-400" },
};

type Accent = keyof typeof accentStyles;

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  accent = "blue",
  right,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  accent?: Accent;
  right?: React.ReactNode;
}) {
  const s = accentStyles[accent];
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-xl bg-gradient-to-br p-2.5 ring-1", s.bg, s.ring)}>
          <Icon className={cn("h-6 w-6", s.icon)} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
