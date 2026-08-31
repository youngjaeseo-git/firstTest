import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm", className)}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        return (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-600" />
            )}
            {isLast ? (
              <span className="text-gray-300 font-medium">{item.label}</span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="text-gray-500 hover:text-gray-200 transition-colors"
              >
                {item.label}
              </Link>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="text-gray-500 hover:text-gray-200 transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-gray-500">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
