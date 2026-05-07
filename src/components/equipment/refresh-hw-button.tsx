"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function RefreshHwButton({ equipmentId }: { equipmentId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/refresh-hw`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        toast({
          type: "success",
          title: "Hardware info updated",
          message: `${json.hw?.manufacturer || ""} ${json.hw?.model || ""} — ${json.hw?.cpuCount || 0} CPUs, ${json.hw?.totalMemoryGiB || 0} GB`,
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({
          type: "error",
          title: "Refresh failed",
          message: json.error || "Unknown error",
        });
      }
    } catch {
      toast({ type: "error", title: "Refresh failed", message: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={refresh}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-gray-700/60 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800/80 hover:border-gray-600 transition-all disabled:opacity-40"
      title="Refresh hardware info from BMC (Redfish)"
    >
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      Refresh HW
    </button>
  );
}
