"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { isChunkLoadError, tryRecoverFromChunkError } from "@/lib/chunk-recovery";

/**
 * Route-level error boundary for the (dashboard) segment.
 * Next.js mounts this automatically when any child server/client
 * component throws during render or data fetching.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 재배포/부분빌드로 청크가 없을 때(ChunkLoadError)는 자동으로 1회 하드 리로드해
  // 최신 청크를 받아온다. 초기화 함수는 첫 렌더에 1회 동기 실행된다.
  const [recovering] = useState(() => tryRecoverFromChunkError(error));

  useEffect(() => {
    if (isChunkLoadError(error)) {
      console.warn("Chunk load error (stale deploy?) — attempting auto-recovery:", error?.message);
    } else {
      console.error("Dashboard error boundary caught:", error);
    }
  }, [error]);

  // 리로드가 곧 일어나므로 깜빡이는 에러 UI 대신 최소 로딩 표시
  if (recovering) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="text-sm text-gray-400">최신 버전으로 업데이트 중…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-100">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          {error.message || "An unexpected error occurred while rendering this page."}
        </p>
        {error.digest && (
          <p className="mt-2 text-[11px] text-gray-600 font-mono">
            digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-700"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
