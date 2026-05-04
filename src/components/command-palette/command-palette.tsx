"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Server,
  Building2,
  AlertTriangle,
  LayoutDashboard,
  Settings,
  BarChart3,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/i18n-context";

interface SearchResults {
  servers: Array<{ id: string; hostname: string; ipAddress: string | null; type: string; status: string }>;
  rooms: Array<{ id: string; name: string }>;
  racks: Array<{ id: string; name: string; roomName: string }>;
  alerts: Array<{ id: string; summary: string; severity: string; source: string | null }>;
}

const QUICK_LINK_KEYS = [
  { labelKey: "nav.dashboard", href: "/", icon: LayoutDashboard, descKey: "dashboard.avgCpu" },
  { labelKey: "nav.servers", href: "/servers", icon: Server, descKey: "server.cpu" },
  { labelKey: "nav.infrastructure", href: "/infrastructure", icon: Wrench, descKey: "infra.title" },
  { labelKey: "nav.alerts", href: "/alerts", icon: AlertTriangle, descKey: "alerts.title" },
  { labelKey: "nav.capacity", href: "/capacity", icon: BarChart3, descKey: "capacity.title" },
  { labelKey: "nav.settings", href: "/settings", icon: Settings, descKey: "settings.title" },
];

export function CommandPalette() {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Global shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q || q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setActiveIndex(0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Build flat list of navigable items
  const items = buildItems(query, results, t);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) navigate(item.href);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content
                asChild
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-700/60 bg-gray-900/95 shadow-2xl shadow-black/50 backdrop-blur-md"
                >
                  {/* Search input */}
                  <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
                    <Search className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t("header.searchPlaceholder")}
                      className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none"
                    />
                    {loading && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
                    )}
                    <kbd className="hidden rounded-md border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:inline-block">
                      ESC
                    </kbd>
                  </div>

                  {/* Results */}
                  <div
                    ref={listRef}
                    className="max-h-80 overflow-y-auto scrollbar-thin p-2"
                  >
                    {items.length === 0 && query.length >= 2 && !loading ? (
                      <p className="px-3 py-8 text-center text-sm text-gray-500">
                        {t("cmd.noResults")} &quot;{query}&quot;
                      </p>
                    ) : (
                      items.map((item, idx) => {
                        if (item.type === "header") {
                          return (
                            <p
                              key={item.key}
                              className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 first:pt-1"
                            >
                              {item.label}
                            </p>
                          );
                        }

                        const isActive = idx === activeIndex;
                        return (
                          <button
                            key={item.key}
                            data-index={idx}
                            onClick={() => navigate(item.href)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                              isActive
                                ? "bg-blue-600/15 text-gray-100"
                                : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                                isActive
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-gray-800 text-gray-500",
                              )}
                            >
                              {item.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{item.label}</p>
                              {item.description && (
                                <p className="truncate text-xs text-gray-500">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 flex-shrink-0 transition-opacity",
                                isActive
                                  ? "text-blue-400 opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-gray-800 px-4 py-2 text-[11px] text-gray-600">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-[10px]">
                          ↑↓
                        </kbd>
                        {t("cmd.navigate")}
                      </span>
                      <span className="flex items-center gap-1">
                        <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-[10px]">
                          ↵
                        </kbd>
                        {t("cmd.open")}
                      </span>
                    </div>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-[10px]">
                        ESC
                      </kbd>
                      {t("common.close")}
                    </span>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---

interface FlatItem {
  type: "header" | "item";
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
}

function buildItems(query: string, results: SearchResults | null, t: (k: string) => string): FlatItem[] {
  const q = query.trim();

  // No query → show quick links
  if (!q || q.length < 2 || !results) {
    const items: FlatItem[] = [
      { type: "header", key: "h-quick", label: t("cmd.quickLinks"), href: "", icon: null },
    ];
    QUICK_LINK_KEYS.forEach((link) =>
      items.push({
        type: "item",
        key: `ql-${link.href}`,
        label: t(link.labelKey),
        href: link.href,
        icon: <link.icon className="h-4 w-4" />,
      }),
    );
    return items;
  }

  const items: FlatItem[] = [];

  if (results.servers.length > 0) {
    items.push({ type: "header", key: "h-servers", label: t("nav.servers"), href: "", icon: null });
    results.servers.forEach((s) =>
      items.push({
        type: "item",
        key: `srv-${s.id}`,
        label: s.hostname,
        href: `/servers/${s.id}`,
        icon: <Server className="h-4 w-4" />,
        description: [s.ipAddress, s.type, s.status].filter(Boolean).join(" · "),
      }),
    );
  }

  if (results.rooms.length > 0) {
    items.push({ type: "header", key: "h-rooms", label: t("nav.racks"), href: "", icon: null });
    results.rooms.forEach((r) =>
      items.push({
        type: "item",
        key: `room-${r.id}`,
        label: r.name,
        href: "/servers",
        icon: <Building2 className="h-4 w-4" />,
      }),
    );
  }

  if (results.racks.length > 0) {
    items.push({ type: "header", key: "h-racks", label: t("nav.racks"), href: "", icon: null });
    results.racks.forEach((r) =>
      items.push({
        type: "item",
        key: `rack-${r.id}`,
        label: r.name,
        href: "/servers",
        icon: <Building2 className="h-4 w-4" />,
        description: r.roomName,
      }),
    );
  }

  if (results.alerts.length > 0) {
    items.push({ type: "header", key: "h-alerts", label: t("nav.alerts"), href: "", icon: null });
    results.alerts.forEach((a) =>
      items.push({
        type: "item",
        key: `alert-${a.id}`,
        label: a.summary,
        href: "/alerts",
        icon: <AlertTriangle className="h-4 w-4" />,
        description: [a.severity, a.source].filter(Boolean).join(" · "),
      }),
    );
  }

  return items;
}
