"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import {
  LayoutDashboard,
  Server,
  HardDrive,
  Bell,
  Building2,
  BarChart3,
  FileText,
  Settings,
  Search,
  Cpu,
  FlaskConical,
  MemoryStick,
  Activity,
} from "lucide-react";

const navigation = [
  { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { key: "nav.servers", href: "/servers", icon: Server },
  { key: "nav.infrastructure", href: "/infrastructure", icon: Building2 },
  { key: "nav.racks", href: "/racks", icon: HardDrive },
  { key: "nav.search", href: "/search", icon: Search },
  { key: "nav.memory", href: "/memory", icon: MemoryStick },
  { key: "nav.firmware", href: "/firmware", icon: Cpu },
  { key: "nav.workloads", href: "/workloads", icon: Activity },
  { key: "nav.evaluations", href: "/evaluations", icon: FlaskConical },
  { key: "nav.alerts", href: "/alerts", icon: Bell },
  { key: "nav.capacity", href: "/capacity", icon: BarChart3 },
  { key: "nav.reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <aside className="flex w-64 flex-col border-r border-gray-800/80 bg-gray-900/95 backdrop-blur-sm">
      {/* Logo */}
      <Link
        href="/"
        className="group flex h-16 items-center gap-3 border-b border-gray-800/80 px-6 transition-colors hover:bg-gray-800/50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold shadow-lg shadow-blue-600/20 transition-transform duration-200 group-hover:scale-105">
          DC
        </div>
        <div>
          <span className="text-base font-semibold tracking-tight">DCIM</span>
          <span className="ml-1 text-xs font-medium text-gray-500">Manager</span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "text-blue-400"
                  : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-blue-600/15 border border-blue-500/20"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon
                className={cn(
                  "relative h-[18px] w-[18px] transition-transform duration-200",
                  isActive
                    ? "text-blue-400"
                    : "text-gray-500 group-hover:text-gray-300 group-hover:scale-110",
                )}
              />
              <span className="relative">{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800/80 p-3">
        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            pathname.startsWith("/settings")
              ? "bg-gray-800/60 text-gray-200"
              : "text-gray-500 hover:bg-gray-800/60 hover:text-gray-300",
          )}
        >
          <Settings
            className={cn(
              "h-[18px] w-[18px] transition-transform duration-300",
              "group-hover:rotate-90",
            )}
          />
          {t("nav.settings")}
        </Link>
      </div>
    </aside>
  );
}
