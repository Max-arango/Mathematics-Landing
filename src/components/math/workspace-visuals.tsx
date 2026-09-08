"use client";

import { useEffect, useRef } from "react";
import { useInView } from "@/components/math/hooks";
import type { WorkspaceId } from "@/data/workspaces";

/**
 * Miniature mathematical exhibits for the workspace cards.
 * Each is a small, honest computation — SVG paths are sampled in JS,
 * canvases only where projection/fractals demand it.
 * Hover states are pure CSS (group-hover) — cheap and responsive.
 */

/* ---------- helpers ---------- */

function samplePath(
  x0: number,
  x1: number,
  samples: number,
  f: (x: number) => number,
  scale: (x: number, y: number) => [number, number]
): string {
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const x = x0 + ((x1 - x0) * i) / samples;
    const [px, py] = scale(x, f(x));
    d += `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)} `;
  }
  return d;
}

function spiralPoints(
  cx: number,
  cy: number,
  turns: number,
  growth: number,
  step: number
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let th = 0; th <= turns * Math.PI * 2; th += step) {
    const r = 2.5 * Math.exp(growth * th);
    pts.push([
      cx + r * Math.cos(th + Math.PI / 2),
      cy + r * Math.sin(th + Math.PI / 2),
    ]);
  }
  return pts;
}

/* ---------- canvas minis ---------- */

function FractalMini() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>({ threshold: 0.2 });

  useEffect(() => {
    if (!inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 128;
    const H = 84;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    const maxIter = 56;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        // seahorse valley crop
        const cRe = -0.7435 + (px / W - 0.5) * 0.0055;
        const cIm = 0.1314 + (py / H - 0.5) * 0.0036;
        let zRe = 0;
        let zIm = 0;
        let i = 0;
        while (i < maxIter && zRe * zRe + zIm * zIm < 4) {
          const t = zRe * zRe - zIm * zIm + cRe;
          zIm = 2 * zRe * zIm + cIm;
          zRe = t;
          i++;
        }
        const o = (py * W + px) * 4;
        if (i >= maxIter) {
          img.data[o] = 16;
          img.data[o + 1] = 16;
          img.data[o + 2] = 15;
          img.data[o + 3] = 255;
        } else {
          // warm ramp: deep void → vermilion → cream
          const t = Math.min(1, i / maxIter);
          const s = Math.pow(t, 0.4);
          img.data[o] = Math.round(19 + (224 - 19) * s * s);
          img.data[o + 1] = Math.round(19 + (69 - 19) * s);
          img.data[o + 2] = Math.round(15 + (29 - 15) * s);
          img.data[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [inView]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-void"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="h-full w-full object-cover opacity-90"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

function TesseractMini() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 150;
    const H = 100;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 4-cube vertices: all ±1 combinations
    const verts: number[][] = [];
    for (let i = 0; i < 16; i++) {
      verts.push([
        i & 1 ? 1 : -1,
        i & 2 ? 1 : -1,
        i & 4 ? 1 : -1,
        i & 8 ? 1 : -1,
      ]);
    }
    // edges: pairs differing in exactly one coordinate
    const edges: Array<[number, number]> = [];
    for (let a = 0; a < 16; a++) {
      for (let b = a + 1; b < 16; b++) {
        const diff = (a ^ b).toString(2).replace(/0/g, "").length;
        if (diff === 1) edges.push([a, b]);
      }
    }

    let raf = 0;
    let t = 0;
    let lastDraw = 0;

    const project = (v: number[], a: number, b: number): [number, number, number] => {
      // rotate XY by a, ZW by b (double rotation)
      const cA = Math.cos(a);
      const sA = Math.sin(a);
      const cB = Math.cos(b);
      const sB = Math.sin(b);
      const [x, y, z, w] = v;
      const x2 = x * cA - y * sA;
      const y2 = x * sA + y * cA;
      const z2 = z * cB - w * sB;
      const w1 = z * sB + w * cB;
      // 4D → 3D perspective
      const p4 = 2.6 / (2.6 - w1);
      const x3 = x2 * p4;
      const y3 = y2 * p4;
      const z3 = z2 * p4;
      // 3D → 2D (slow turn + fixed tilt)
      const yaw = t * 0.3;
      const X = x3 * Math.cos(yaw) - y3 * Math.sin(yaw);
      const Y = x3 * Math.sin(yaw) + y3 * Math.cos(yaw);
      const depth = Y * 0.5 + z3 * 0.85;
      const p3 = 5.5 / (5.5 + depth);
      const sx = W / 2 + X * p3 * 15;
      const sy = H / 2 - (Y * 0.85 - z3 * 0.5) * p3 * 15;
      return [sx, sy, w1];
    };

    const draw = () => {
      ctx.fillStyle = "#131311";
      ctx.fillRect(0, 0, W, H);
      const a = t * 0.7;
      const b = t * 0.42;
      const pts = verts.map((v) => project(v, a, b));
      for (const [i, j] of edges) {
        const wAvg = (pts[i][2] + pts[j][2]) / 2; // -√2..√2
        const near = (wAvg + 1.5) / 3; // 0..1
        const alpha = 0.25 + near * 0.75;
        ctx.strokeStyle =
          near > 0.62
            ? `rgba(224,103,61,${alpha.toFixed(2)})`
            : `rgba(240,238,229,${(alpha * 0.5).toFixed(2)})`;
        ctx.lineWidth = 0.7 + near * 1.1;
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.stroke();
      }
    };

    const tick = (now: number) => {
      if (now - lastDraw > 33) {
        // ~30 fps is plenty for a card exhibit
        lastDraw = now;
        t += 0.016;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };

    draw();
    if (!reduced) raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [inView, reduced]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-void"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />
    </div>
  );
}

/* ---------- SVG minis ---------- */

function CalculatorVisual() {
  const sinD = samplePath(
    0,
    Math.PI * 2,
    70,
    (x) => Math.sin(x),
    (x, y) => [14 + (x / (Math.PI * 2)) * 172, 60 - y * 26]
  );
  const cosD = samplePath(
    0,
    Math.PI * 2,
    70,
    (x) => Math.cos(x) * 0.8,
    (x, y) => [14 + (x / (Math.PI * 2)) * 172, 60 - y * 26]
  );
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <line x1="14" y1="60" x2="186" y2="60" stroke="#1b1a16" strokeOpacity="0.12" strokeWidth="1" />
      <line x1="100" y1="14" x2="100" y2="106" stroke="#1b1a16" strokeOpacity="0.08" strokeWidth="1" />
      <path
        d={cosD}
        fill="none"
        stroke="#2e7d6e"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="1"
        strokeDashoffset="1"
        pathLength={1}
        style={{ transition: "stroke-dashoffset 0.9s ease" }}
        className="group-hover:stroke-dashoffset-0"
      />
      <path
        d={sinD}
        fill="none"
        stroke="#c2451d"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="1"
        strokeDashoffset="1"
        pathLength={1}
        style={{ transition: "stroke-dashoffset 1.1s ease 0.1s" }}
        className="group-hover:stroke-dashoffset-0"
      />
      <circle cx="100" cy="60" r="2" fill="#1b1a16" opacity="0.35" />
    </svg>
  );
}

function BlochVisual() {
  // two states: |+⟩-like point and its flipped partner
  const vec = (deg: number, len = 38): [number, number] => {
    const r = (deg * Math.PI) / 180;
    return [100 + Math.cos(r) * len, 60 - Math.sin(r) * len * 0.92];
  };
  const [ax, ay] = vec(38);
  const [bx, by] = vec(-145);
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <circle cx="100" cy="60" r="42" fill="none" stroke="#1b1a16" strokeOpacity="0.25" strokeWidth="1.2" />
      <ellipse cx="100" cy="60" rx="42" ry="13" fill="none" stroke="#1b1a16" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="3 4" />
      <ellipse cx="100" cy="60" rx="14" ry="42" fill="none" stroke="#1b1a16" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="3 4" />
      <line x1="100" y1="18" x2="100" y2="102" stroke="#1b1a16" strokeOpacity="0.14" strokeWidth="1" />
      <text x="100" y="13" textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#6e6b60">|0⟩</text>
      <text x="100" y="114" textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#6e6b60">|1⟩</text>
      {/* default state */}
      <g className="opacity-100 transition-opacity duration-500 group-hover:opacity-0">
        <line x1="100" y1="60" x2={ax} y2={ay} stroke="#c2451d" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx={ax} cy={ay} r="3.4" fill="#c2451d" />
      </g>
      {/* hover state — the qubit flips */}
      <g className="opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <line x1="100" y1="60" x2={bx} y2={by} stroke="#2e7d6e" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx={bx} cy={by} r="3.4" fill="#2e7d6e" />
      </g>
      <circle cx="100" cy="60" r="2" fill="#1b1a16" opacity="0.4" />
    </svg>
  );
}

function TopologyVisual() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      {/* mug (default) */}
      <g className="opacity-100 transition-opacity duration-500 group-hover:opacity-0">
        <path
          d="M62 42 h44 v34 a10 10 0 0 1 -10 10 h-24 a10 10 0 0 1 -10 -10 z"
          fill="#ffffff"
          stroke="#1b1a16"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M106 48 a12 12 0 1 1 0 22"
          fill="none"
          stroke="#1b1a16"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      {/* torus (hover) — homeomorphic */}
      <g className="opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <ellipse cx="100" cy="66" rx="40" ry="27" fill="none" stroke="#c2451d" strokeWidth="2.2" />
        <ellipse cx="100" cy="64" rx="13" ry="8" fill="#faf9f5" stroke="#c2451d" strokeWidth="2.2" />
      </g>
      <text
        x="100"
        y="112"
        textAnchor="middle"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
        fill="#6e6b60"
        className="transition-opacity duration-500 group-hover:fill-vermilion"
      >
        mug ≅ torus
      </text>
    </svg>
  );
}

function DynamicsVisual() {
  const pts = spiralPoints(100, 62, 2.6, 0.16, 0.14);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 6];
  const ang = (Math.atan2(end[1] - prev[1], end[0] - prev[0]) * 180) / Math.PI;
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <g className="transition-transform duration-700 group-hover:rotate-12" style={{ transformOrigin: "100px 62px" }}>
        <path
          d={d}
          fill="none"
          stroke="#c2451d"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="transition-[stroke] duration-500"
        />
        <g transform={`translate(${end[0]}, ${end[1]}) rotate(${ang})`}>
          <path d="M0 0 L-7 -3.2 L-7 3.2 z" fill="#c2451d" />
        </g>
      </g>
      <circle cx="100" cy="62" r="2.6" fill="none" stroke="#1b1a16" strokeWidth="1.4" />
      <text x="100" y="80" textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#6e6b60" className="opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        unstable eq.
      </text>
    </svg>
  );
}

function InspectorVisual() {
  const nodes = [
    { x: 100, y: 22, label: "sin", op: true },
    { x: 62, y: 60, label: "·", op: true },
    { x: 138, y: 60, label: "^", op: true },
    { x: 62, y: 96, label: "x", op: false },
    { x: 138, y: 96, label: "2", op: false },
    { x: 100, y: 96, label: "x", op: false },
  ];
  const edges: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [0, 5],
  ];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="#c8c5b8"
          strokeWidth="1.4"
        />
      ))}
      {nodes.map((n, i) => (
        <g
          key={n.label + i}
          style={{ transitionDelay: `${i * 70}ms` }}
          className="transition-all duration-300"
        >
          <rect
            x={n.x - 16}
            y={n.y - 11}
            width="32"
            height="22"
            rx="6"
            fill={n.op ? "#fdf4ef" : "#ffffff"}
            stroke={n.op ? "#c2451d55" : "#e5e2d6"}
            className="group-hover:fill-vermilion-soft"
          />
          <text
            x={n.x}
            y={n.y + 4}
            textAnchor="middle"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill={n.op ? "#c2451d" : "#1b1a16"}
            className="group-hover:fill-vermilion"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function NotebookVisual() {
  const cells = [0, 1, 2];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      {cells.map((i) => (
        <g key={i} style={{ transitionDelay: `${i * 90}ms` }} className="transition-all duration-300">
          <rect
            x="38"
            y={20 + i * 32}
            width="124"
            height="24"
            rx="4"
            fill="#ffffff"
            stroke="#e5e2d6"
            className="group-hover:stroke-vermilion/50"
          />
          <circle
            cx="46"
            cy={32 + i * 32}
            r="2.4"
            fill="#c8c5b8"
            className="group-hover:fill-vermilion"
          />
          {/* code lines */}
          <rect
            x={56}
            y={28 + i * 32}
            width={i === 1 ? 34 : 52}
            height="3"
            rx="1.5"
            fill="#d8d5c9"
            className="group-hover:fill-vermilion/40"
          />
          <rect
            x={56 + (i === 1 ? 40 : 58)}
            y={28 + i * 32}
            width={i === 1 ? 26 : 14}
            height="3"
            rx="1.5"
            fill="#e8e5db"
          />
        </g>
      ))}
      {/* output sparkline in the last cell */}
      <path
        d={samplePath(
          0,
          Math.PI * 3,
          40,
          (x) => Math.sin(x) * Math.exp(-x / 7),
          (x, y) => [110 + (x / (Math.PI * 3)) * 46, 78 - y * 7]
        )}
        fill="none"
        stroke="#c2451d"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocsVisual() {
  const symbols = ["Σ", "∫", "∇", "∂", "π", "ℝ"];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      {symbols.map((s, i) => {
        const cx = 54 + (i % 3) * 46;
        const cy = 34 + Math.floor(i / 3) * 46;
        return (
          <g key={s} style={{ transitionDelay: `${i * 60}ms` }} className="transition-all duration-300">
            <rect
              x={cx - 17}
              y={cy - 17}
              width="34"
              height="34"
              rx="6"
              fill="#ffffff"
              stroke="#e5e2d6"
              className="group-hover:fill-ink"
            />
            <text
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              fontSize="16"
              fontFamily="Georgia, serif"
              fontStyle="italic"
              fill="#1b1a16"
              className="group-hover:fill-cream"
            >
              {s}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- dispatcher ---------- */

export function WorkspaceVisual({ id }: { id: WorkspaceId }) {
  switch (id) {
    case "calculator":
      return <CalculatorVisual />;
    case "fractal_lab":
      return <FractalMini />;
    case "bloch_sphere":
      return <BlochVisual />;
    case "four_d":
      return <TesseractMini />;
    case "topology":
      return <TopologyVisual />;
    case "dynamics":
      return <DynamicsVisual />;
    case "inspector":
      return <InspectorVisual />;
    case "notebook":
      return <NotebookVisual />;
    case "docs":
      return <DocsVisual />;
  }
}
