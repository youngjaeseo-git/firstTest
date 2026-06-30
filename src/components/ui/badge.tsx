import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-gray-800 text-gray-300",
        active: "bg-green-500/15 text-green-400",
        warning: "bg-amber-500/15 text-amber-400",
        critical: "bg-red-500/15 text-red-400",
        info: "bg-blue-500/15 text-blue-400",
        maintenance: "bg-purple-500/15 text-purple-400",
        repair: "bg-orange-500/15 text-orange-400",
        decommissioned: "bg-gray-600/15 text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    PLANNED: { variant: "info", label: "계획" },
    RECEIVING: { variant: "info", label: "입고" },
    INSTALLED: { variant: "info", label: "설치" },
    ACTIVE: { variant: "active", label: "운영중" },
    MAINTENANCE: { variant: "maintenance", label: "유지보수" },
    REPAIR: { variant: "repair", label: "수리중" },
    FAILED: { variant: "critical", label: "장애" },
    DECOMMISSIONED: { variant: "decommissioned", label: "퇴역" },
    DISPOSED: { variant: "decommissioned", label: "폐기" },
  };
  const { variant, label } = map[status] || { variant: "default" as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    CRITICAL: { variant: "critical", label: "Critical" },
    WARNING: { variant: "warning", label: "Warning" },
    INFO: { variant: "info", label: "Info" },
  };
  const { variant, label } = map[severity] || { variant: "default" as const, label: severity };
  return <Badge variant={variant}>{label}</Badge>;
}
