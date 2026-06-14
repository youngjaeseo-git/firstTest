"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, LogOut, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PrometheusStatus } from "@/components/layout/prometheus-status";
import { useT } from "@/lib/i18n/i18n-context";

interface AlertItem {
  id: string;
  severity: string;
  summary: string;
  source: string | null;
  firedAt: string;
}

export function Header() {
  const { data: session } = useSession();
  const t = useT();
  const [bellOpen, setBellOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/alerts?status=FIRING&limit=10&excludeSuppressed=1");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAlerts(data.items || []);
        setAlertCount(data.total ?? (data.items || []).length);
      } catch {
        // ignore
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setBellOpen(false);
      }
    }
    if (bellOpen) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [bellOpen]);

  return (
    <header className="relative z-40 flex h-16 items-center justify-between border-b border-gray-800/80 bg-gray-900/95 px-6 backdrop-blur-sm">
      {/* Command Palette Trigger */}
      <button
        onClick={() => {
          // Dispatch Cmd+K to open the palette
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", metaKey: true }),
          );
        }}
        className="group flex w-96 items-center gap-3 rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm text-gray-500 backdrop-blur-sm transition-all hover:border-gray-600 hover:bg-gray-800 hover:text-gray-400"
      >
        <Search className="h-4 w-4 text-gray-500" />
        <span className="flex-1 text-left">{t("header.searchPlaceholder")}</span>
        <kbd className="hidden rounded-md border border-gray-700 bg-gray-800/80 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:inline-block">
          ⌘K
        </kbd>
      </button>
      <CommandPalette />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <PrometheusStatus />
        <LanguageSwitcher />
        <ThemeToggle />

        {/* Separator */}
        <div className="h-6 w-px bg-gray-800" />

        {/* Alert bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="relative rounded-lg p-2 text-gray-400 transition-all duration-200 hover:bg-gray-800/80 hover:text-gray-200"
            aria-label="Alerts"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/30"
              >
                {alertCount > 99 ? "99+" : alertCount}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-[100] mt-2 w-80 overflow-hidden rounded-xl border border-gray-700/60 bg-gray-900 shadow-2xl shadow-black/40"
              >
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-100">{t("header.alerts")}</p>
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
                    {alertCount} {t("header.alerts.firing")}
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  {alerts.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-500">
                      {t("header.alerts.none")}
                    </p>
                  ) : (
                    alerts.map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Link
                          href="/alerts"
                          onClick={() => setBellOpen(false)}
                          className="block border-b border-gray-800/60 px-4 py-3 last:border-0 hover:bg-gray-800/50 transition-colors"
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                                a.severity === "CRITICAL"
                                  ? "bg-red-500 shadow-sm shadow-red-500/50"
                                  : a.severity === "WARNING"
                                    ? "bg-amber-500 shadow-sm shadow-amber-500/50"
                                    : "bg-blue-500 shadow-sm shadow-blue-500/50"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-gray-200">
                                {a.summary}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {a.source || "-"} ·{" "}
                                {new Date(a.firedAt).toLocaleTimeString("ko-KR")}
                              </p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))
                  )}
                </div>
                <Link
                  href="/alerts"
                  onClick={() => setBellOpen(false)}
                  className="block border-t border-gray-800 px-4 py-2.5 text-center text-xs font-medium text-blue-400 hover:bg-gray-800/50 transition-colors"
                >
                  {t("header.alerts.viewAll")}
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-800" />

        {/* User info */}
        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-xs font-bold text-blue-300 border border-blue-500/20">
              {(session.user.name || session.user.email || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-200 leading-tight">
                {session.user.name || session.user.email}
              </p>
              <Badge variant="info" className="text-[10px] mt-0.5">
                {(session.user as { role?: string }).role || "VIEWER"}
              </Badge>
            </div>
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = "/login?logged_out=1";
              }}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-800/80 hover:text-gray-300 transition-all duration-200"
              title={t("header.logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
