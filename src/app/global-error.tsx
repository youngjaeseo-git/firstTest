"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ background: "#030712", color: "#f3f4f6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>
              {error.message || "An unexpected error occurred."}
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginBottom: 16 }}>
                digest: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "1px solid #374151",
                background: "#1f2937",
                color: "#e5e7eb",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
