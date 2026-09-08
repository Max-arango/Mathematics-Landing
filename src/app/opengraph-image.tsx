import { ImageResponse } from "next/og";

export const alt = "Mathematics Simulator — Explore mathematics beyond the graph.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#faf9f5",
          backgroundImage:
            "linear-gradient(to right, rgba(27,26,22,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(27,26,22,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: "#c2451d",
              borderRadius: 3,
            }}
          />
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              color: "#6e6b60",
              textTransform: "uppercase",
            }}
          >
            Open-source mathematical exploration
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.08,
              color: "#1b1a16",
              fontWeight: 700,
              display: "flex",
            }}
          >
            Explore mathematics
          </div>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.08,
              color: "#c2451d",
              fontWeight: 700,
              display: "flex",
            }}
          >
            beyond the graph.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 30, color: "#1b1a16", fontWeight: 600 }}>
              Mathematics Simulator
            </div>
            <div style={{ fontSize: 22, color: "#6e6b60" }}>
              functions · fractals · dynamics · topology · 4D geometry
            </div>
          </div>
          <svg width="420" height="120" viewBox="0 0 420 120">
            <path
              d="M0 60 C 30 60, 38 8, 70 8 S 105 112, 140 112 S 180 8, 210 8 S 245 112, 280 112 S 320 8, 350 8 S 395 60, 420 60"
              fill="none"
              stroke="#c2451d"
              stroke-width="6"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>
    ),
    size
  );
}
