export function TemperatureOverview() {
  // TODO: Fetch from Prometheus
  const temp = {
    avg: 34.2,
    max: 72.8,
    maxServer: "server-gpu-01",
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">Temperature</h3>
        <svg
          className="h-5 w-5 text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
        </svg>
      </div>
      <p className="mt-2 text-3xl font-bold">
        {temp.avg}
        <span className="text-lg text-gray-500">°C</span>
      </p>
      <p className="mt-1 text-xs text-gray-500">Average across all servers</p>
      <div className="mt-3 rounded bg-gray-800 px-3 py-2">
        <p className="text-xs text-amber-400">
          Peak: {temp.max}°C on {temp.maxServer}
        </p>
      </div>
    </div>
  );
}
