// 재배포/부분빌드 후 브라우저가 옛(또는 없는) JS 청크를 요청하면 webpack이
// ChunkLoadError("Loading chunk N failed")를 던지고 error boundary가 "Something
// went wrong"을 띄운다. reset()으로는 같은 청크를 다시 요청해 복구가 안 되므로,
// 청크 에러일 때만 1회 하드 리로드로 최신 HTML/청크 매니페스트를 다시 받는다.

const RELOAD_KEY = "dcx:chunk-reload-at";
const RELOAD_WINDOW_MS = 15_000; // 이 창 안에서 이미 리로드했으면 재리로드 금지(루프 방지)

/** webpack 청크/CSS 청크 또는 dynamic import 로드 실패인지 판별 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string };
  const name = e.name ?? "";
  const msg = e.message ?? "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

/**
 * 청크 에러면 1회 하드 리로드를 시도한다.
 * @returns true = 리로드를 트리거함(호출부는 로딩 표시), false = 리로드 안 함(정상 에러 UI 노출)
 */
export function tryRecoverFromChunkError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadError(error)) return false;

  // 오프라인이면 리로드해도 소용없음 → 루프 방지
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  const now = Date.now();
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) → 안전하게 복구 포기
    return false;
  }

  // 최근에 이미 리로드했는데 또 청크 에러 = 리로드로 안 고쳐지는 상황 → 루프 중단, 에러 UI 노출
  if (now - last < RELOAD_WINDOW_MS) {
    return false;
  }

  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }

  // 하드 리로드: 최신 HTML/청크 매니페스트를 새로 받음
  window.location.reload();
  return true;
}
