import { cn } from "@/lib/utils";

// TODO: Replace with real data from API
const mockAlerts = [
  {
    id: "1",
    severity: "critical" as const,
    summary: "CPU temperature exceeds 90°C",
    source: "server-prod-12",
    time: "2 min ago",
  },
  {
    id: "2",
    severity: "warning" as const,
    summary: "Disk usage above 85%",
    source: "server-db-03",
    time: "15 min ago",
  },
  {
    id: "3",
    severity: "warning" as const,
    summary: "Memory usage above 90%",
    source: "server-app-07",
    time: "32 min ago",
  },
  {
    id: "4",
    severity: "info" as const,
    summary: "Scheduled maintenance starting",
    source: "rack-A04",
    time: "1 hour ago",
  },
  {
    id: "5",
    severity: "warning" as const,
    summary: "Network packet loss detected",
    source: "switch-core-01",
    time: "2 hours ago",
  },
];

const severityStyles = {
  critical: "border-l-red-500 bg-red-500/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  info: "border-l-blue-500 bg-blue-500/5",
};

const severityDot = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

export function AlertFeed() {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Alerts</h2>
        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
          {mockAlerts.length} active
        </span>
      </div>
      <div className="space-y-2">
        {mockAlerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "rounded-r-lg border-l-2 p-3",
              severityStyles[alert.severity],
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                  severityDot[alert.severity],
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-200">
                  {alert.summary}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{alert.source}</span>
                  <span>-</span>
                  <span>{alert.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
