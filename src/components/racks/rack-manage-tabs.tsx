"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Settings2, Upload } from "lucide-react";

interface RackManageTabsProps {
  manageTab: React.ReactNode;
  bulkTab: React.ReactNode;
}

export function RackManageTabs({ manageTab, bulkTab }: RackManageTabsProps) {
  const [activeTab, setActiveTab] = useState<"manage" | "bulk">("manage");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-900/50 p-1">
        <button
          onClick={() => setActiveTab("manage")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "manage"
              ? "bg-gray-800 text-gray-100"
              : "text-gray-500 hover:text-gray-300",
          )}
        >
          <Settings2 className="h-4 w-4" />
          Room / Rack 관리
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "bulk"
              ? "bg-gray-800 text-gray-100"
              : "text-gray-500 hover:text-gray-300",
          )}
        >
          <Upload className="h-4 w-4" />
          일괄 배치
        </button>
      </div>

      {activeTab === "manage" ? manageTab : bulkTab}
    </div>
  );
}
