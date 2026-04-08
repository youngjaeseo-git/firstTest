"use client";

import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-gray-900 px-6">
      {/* Search */}
      <div className="relative w-96">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search servers, racks, assets..."
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 pl-10 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Alert indicator */}
        <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            3
          </span>
        </button>

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
