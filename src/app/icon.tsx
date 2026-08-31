import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          borderRadius: 6,
        }}
      >
        <svg viewBox="0 0 40 40" width="28" height="28">
          <defs>
            <linearGradient id="r" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF8200" />
              <stop offset="100%" stopColor="#EA002C" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="15" fill="none" stroke="url(#r)" strokeWidth="2.5" />
          {[13, 20, 27].map((cy) =>
            [13, 20, 27].map((cx) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="#C2703D" />
            )),
          )}
        </svg>
      </div>
    ),
    { ...size },
  );
}
