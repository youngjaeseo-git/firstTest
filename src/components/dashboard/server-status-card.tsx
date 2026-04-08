export function ServerStatusCard() {
  // TODO: Fetch from API once connected to Prometheus
  const stats = {
    total: 48,
    active: 42,
    warning: 4,
    critical: 1,
    maintenance: 1,
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">Server Status</h3>
        <svg
          className="h-5 w-5 text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" />
        </svg>
      </div>
      <p className="mt-2 text-3xl font-bold">
        {stats.active}
        <span className="text-lg text-gray-500">/{stats.total}</span>
      </p>
      <div className="mt-3 flex gap-3 text-xs">
        <span className="text-green-400">{stats.active} Active</span>
        <span className="text-amber-400">{stats.warning} Warning</span>
        <span className="text-red-400">{stats.critical} Critical</span>
      </div>
    </div>
  );
}
