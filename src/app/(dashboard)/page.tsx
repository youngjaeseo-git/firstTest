import { ServerStatusCard } from "@/components/dashboard/server-status-card";
import { PowerGauge } from "@/components/dashboard/power-gauge";
import { AlertFeed } from "@/components/dashboard/alert-feed";
import { TemperatureOverview } from "@/components/dashboard/temperature-overview";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ServerStatusCard />
        <PowerGauge />
        <TemperatureOverview />
        {/* Additional summary cards */}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Charts and visualizations will go here */}
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-lg font-semibold">Infrastructure Overview</h2>
            <p className="text-gray-400">
              Charts and metrics will be displayed here once connected to Prometheus.
            </p>
          </div>
        </div>
        <div>
          <AlertFeed />
        </div>
      </div>
    </div>
  );
}
