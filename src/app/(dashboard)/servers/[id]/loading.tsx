export default function ServerDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb + title */}
      <div>
        <div className="h-4 w-32 rounded bg-gray-800/60 mb-2" />
        <div className="h-8 w-64 rounded bg-gray-800/60" />
      </div>

      {/* Info bar */}
      <div className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 rounded bg-gray-800/60 mb-2" />
              <div className="h-5 w-24 rounded bg-gray-800/60" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-800/80 bg-gray-900/80 p-4"
          >
            <div className="h-4 w-32 rounded bg-gray-800/60 mb-4" />
            <div className="h-[240px] rounded-lg bg-gray-800/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
