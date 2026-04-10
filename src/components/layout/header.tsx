"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AlertItem {
  id: string;
  severity: string;
  summary: string;
  source: string | null;
  firedAt: string;
}

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch firing alerts for bell dropdown
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/alerts?status=FIRING&limit=10");
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

  // Close dropdown on outside click
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/servers?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-gray-900 px-6">
      {/* Search */}
      <form onSubmit={handleSubmit} className="relative w-96">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="서버 호스트명 / IP 검색..."
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 pl-10 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </form>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Alert bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            aria-label="알림"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {alertCount > 99 ? "99+" : alertCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <p className="text-sm font-semibold text-gray-100">알림</p>
                <span className="text-xs text-gray-500">
                  {alertCount} firing
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    활성 알림이 없습니다.
                  </p>
                ) : (
                  alerts.map((a) => (
                    <Link
                      key={a.id}
                      href="/alerts"
                      onClick={() => setBellOpen(false)}
                      className="block border-b border-gray-800 px-4 py-3 last:border-0 hover:bg-gray-800"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                            a.severity === "CRITICAL"
                              ? "bg-red-500"
                              : a.severity === "WARNING"
                                ? "bg-amber-500"
                                : "bg-blue-500"
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
                  ))
                )}
              </div>
              <Link
                href="/alerts"
                onClick={() => setBellOpen(false)}
                className="block border-t border-gray-800 px-4 py-2 text-center text-xs text-blue-400 hover:bg-gray-800"
              >
                모든 알림 보기 →
              </Link>
            </div>
          )}
        </div>

        {/* User info */}
        {session?.user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-200">
                {session.user.name || session.user.email}
              </p>
              <Badge variant="info" className="text-[10px]">
                {(session.user as { role?: string }).role || "VIEWER"}
              </Badge>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              title="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
