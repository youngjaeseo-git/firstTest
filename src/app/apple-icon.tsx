import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)",
          borderRadius: 40,
        }}
      >
        <svg viewBox="0 0 40 40" width="120" height="120">
          <defs>
            <linearGradient id="r" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF8200" />
              <stop offset="100%" stopColor="#EA002C" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="15" fill="none" stroke="url(#r)" strokeWidth="2" />
          {[13, 20, 27].map((cy) =>
            [13, 20, 27].map((cx) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.7" fill="#C2703D" />
            )),
          )}
        </svg>
      </div>
    ),
    { ...size },
  );
}
