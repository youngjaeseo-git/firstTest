export function PowerGauge() {
  // TODO: Fetch from API / Prometheus
  const power = {
    currentKw: 186.4,
    maxKw: 300,
    pue: 1.42,
  };

  const percentage = (power.currentKw / power.maxKw) * 100;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">Power Usage</h3>
        <span className="text-xs text-gray-500">PUE: {power.pue}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">
        {power.currentKw}
        <span className="text-lg text-gray-500"> kW</span>
      </p>
      {/* Simple progress bar */}
      <div className="mt-3">
        <div className="h-2 w-full rounded-full bg-gray-800">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {percentage.toFixed(0)}% of {power.maxKw} kW capacity
        </p>
      </div>
    </div>
  );
}
