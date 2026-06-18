"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";
import {
  LayoutDashboard,
  Server,
  Layers,
  Bell,
  Building2,
  BarChart3,
  FileText,
  Settings,
  Search,
  Cpu,
  MemoryStick,
  Boxes,
  History,
  Zap,
  Users,
  Map,
} from "lucide-react";

const navigation = [
  { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { key: "nav.servers", href: "/servers", icon: Server },
  { key: "nav.digitalTwin", href: "/digital-twin", icon: Map },
  { key: "nav.infrastructure", href: "/infrastructure", icon: Building2 },
  { key: "nav.assignments", href: "/assignments", icon: Users },
  { key: "nav.racks", href: "/racks", icon: Layers },
  { key: "nav.search", href: "/search", icon: Search },
  { key: "nav.memory", href: "/memory", icon: MemoryStick },
  { key: "nav.firmware", href: "/firmware", icon: Cpu },
  { key: "nav.workloads", href: "/workloads", icon: Boxes },
  { key: "nav.history", href: "/history", icon: History },
  { key: "nav.alerts", href: "/alerts", icon: Bell },
  { key: "nav.capacity", href: "/capacity", icon: BarChart3 },
  { key: "nav.reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <aside className="flex w-64 flex-col border-r border-gray-800/80 bg-gray-900/95 backdrop-blur-sm">
      {/* Brand */}
      <Link
        href="/"
        className="group flex h-16 items-center gap-3 border-b border-gray-800/80 px-5 transition-colors hover:bg-gray-800/50"
      >
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF8200] via-[#EA002C] to-[#B5008E] shadow-lg shadow-[#EA002C]/30 transition-transform duration-200 group-hover:scale-105">
          <Zap className="h-5 w-5 text-white drop-shadow-sm" fill="white" aria-hidden="true" />
          <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">
            DRAM AE
          </span>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="text-[17px] font-bold tracking-tight text-gray-50">DC</span>
            <span className="text-[17px] font-bold tracking-tight text-[#EA002C]">Express</span>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
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
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                isActive
                  ? "font-semibold text-gray-50"
                  : "font-medium text-gray-400 hover:bg-gray-800/60 hover:text-gray-200",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent shadow-sm shadow-blue-500/5"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                >
                  <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-400 shadow-sm shadow-blue-400/50" />
                </motion.div>
              )}
              <item.icon
                className={cn(
                  "relative h-5 w-5 flex-shrink-0 transition-all duration-200",
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
      <div className="h-[3px] w-full bg-gradient-to-r from-[#FF8200] via-[#EA002C] to-[#B5008E]" />
      <div className="p-3">
        <Link
          href="/settings"
          className={cn(
            "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
            pathname.startsWith("/settings")
              ? "font-semibold text-gray-50"
              : "font-medium text-gray-500 hover:bg-gray-800/60 hover:text-gray-300",
          )}
        >
          {pathname.startsWith("/settings") && (
            <div className="absolute inset-0 rounded-lg border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent shadow-sm shadow-blue-500/5">
              <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-400 shadow-sm shadow-blue-400/50" />
            </div>
          )}
          <Settings
            className={cn(
              "relative h-5 w-5 flex-shrink-0 transition-transform duration-300",
              pathname.startsWith("/settings")
                ? "text-blue-400"
                : "text-gray-500 group-hover:rotate-90",
            )}
          />
          <span className="relative">{t("nav.settings")}</span>
        </Link>
      </div>
    </aside>
  );
}
