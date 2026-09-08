"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { InstrumentFrame } from "@/components/landing/instrument-frame";
import { useElementSize } from "@/components/math/hooks";
import { clamp, findRoots, fmt, niceStep, numDeriv } from "@/components/math/lib";
import { cn } from "@/lib/utils";
import { canvasTheme } from "@/lib/canvas-theme";

/**
 * INSPECTOR — expression → AST → symbolic derivative → critical points.
 * Three real expressions; the AST is hand-built to mirror what the engine's
 * parser would produce, the derivative is the true symbolic derivative, and
 * critical points are found numerically (root-finding on f′ + classification
 * by f″) exactly like the engine's numerical layer.
 */

interface AstSpec {
  label: string;
  kind: "op" | "atom";
  children: AstSpec[];
}

interface ExpressionSpec {
  id: string;
  label: string;
  display: React.ReactNode;
  fn: (x: number) => number;
  derivDisplay: React.ReactNode;
  domain: [number, number];
  yRange: number;
  ast: AstSpec;
}

const EXPRESSIONS: ExpressionSpec[] = [
  {
    id: "cubic",
    label: "x³ − 3x",
    display: (
      <>
        f(x) = x<sup>3</sup> − 3x
      </>
    ),
    fn: (x) => x * x * x - 3 * x,
    derivDisplay: (
      <>
        f′(x) = 3x<sup>2</sup> − 3
      </>
    ),
    domain: [-2.6, 2.6],
    yRange: 9,
    ast: {
      label: "−",
      kind: "op",
      children: [
        {
          label: "^",
          kind: "op",
          children: [
            { label: "x", kind: "atom", children: [] },
            { label: "3", kind: "atom", children: [] },
          ],
        },
        {
          label: "·",
          kind: "op",
          children: [
            { label: "−3", kind: "atom", children: [] },
            { label: "x", kind: "atom", children: [] },
          ],
        },
      ],
    },
  },
  {
    id: "damped",
    label: "sin(x)·e^(−x²/8)",
    display: (
      <>
        f(x) = sin(x)·e<sup>−x²/8</sup>
      </>
    ),
    fn: (x) => Math.sin(x) * Math.exp((-x * x) / 8),
    derivDisplay: (
      <>
        f′(x) = e<sup>−x²/8</sup>(cos x − <span className="math">(x/4)</span>·sin x)
      </>
    ),
    domain: [-8, 8],
    yRange: 1.4,
    ast: {
      label: "·",
      kind: "op",
      children: [
        {
          label: "sin",
          kind: "op",
          children: [{ label: "x", kind: "atom", children: [] }],
        },
        {
          label: "exp",
          kind: "op",
          children: [
            {
              label: "·",
              kind: "op",
              children: [
                { label: "−⅛", kind: "atom", children: [] },
                {
                  label: "^",
                  kind: "op",
                  children: [
                    { label: "x", kind: "atom", children: [] },
                    { label: "2", kind: "atom", children: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "quartic",
    label: "x⁴ − 4x²",
    display: (
      <>
        f(x) = x<sup>4</sup> − 4x<sup>2</sup>
      </>
    ),
    fn: (x) => x * x * x * x - 4 * x * x,
    derivDisplay: (
      <>
        f′(x) = 4x(x<sup>2</sup> − 2)
      </>
    ),
    domain: [-2.4, 2.4],
    yRange: 9,
    ast: {
      label: "−",
      kind: "op",
      children: [
        {
          label: "^",
          kind: "op",
          children: [
            { label: "x", kind: "atom", children: [] },
            { label: "4", kind: "atom", children: [] },
          ],
        },
        {
          label: "·",
          kind: "op",
          children: [
            { label: "−4", kind: "atom", children: [] },
            {
              label: "^",
              kind: "op",
              children: [
                { label: "x", kind: "atom", children: [] },
                { label: "2", kind: "atom", children: [] },
              ],
            },
          ],
        },
      ],
    },
  },
];

/* ---- AST layout ---- */

const NODE_W = 38;
const NODE_H = 22;
const H_GAP = 48;
const V_GAP = 46;

interface LaidNode {
  label: string;
  kind: "op" | "atom";
  cx: number;
  cy: number;
  key: string;
}

function layoutAst(root: AstSpec) {
  const nodes: LaidNode[] = [];
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let nextX = 0;

  const walk = (n: AstSpec, depth: number, key: string): number => {
    const childXs = n.children.map((c, i) => walk(c, depth + 1, `${key}-${i}`));
    const x =
      childXs.length > 0
        ? (Math.min(...childXs) + Math.max(...childXs)) / 2
        : nextX++;
    const y = depth;
    nodes.push({ label: n.label, kind: n.kind, cx: x * H_GAP, cy: y * V_GAP, key });
    childXs.forEach((cx) => {
      edges.push({ x1: x * H_GAP, y1: y * V_GAP, x2: cx * H_GAP, y2: (y + 1) * V_GAP });
    });
    return x;
  };

  walk(root, 0, "n");
  return { nodes, edges };
}

export function InspectorDemo() {
  const [exprId, setExprId] = useState("cubic");
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const spec = EXPRESSIONS.find((e) => e.id === exprId)!;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();

  const critical = useMemo(() => {
    const roots = findRoots(
      (x) => numDeriv(spec.fn, x),
      spec.domain[0],
      spec.domain[1]
    ).slice(0, 6);
    return roots.map((x) => {
      const d2 = numDeriv((t) => numDeriv(spec.fn, t), x);
      const type: "max" | "min" | "flat" =
        d2 < -1e-3 ? "max" : d2 > 1e-3 ? "min" : "flat";
      return { x, y: spec.fn(x), d2, type };
    });
  }, [spec]);

  const ast = useMemo(() => layoutAst(spec.ast), [spec]);
  const astWidth = (Math.max(...ast.nodes.map((n) => n.cx)) + 1) * H_GAP + 40;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 10 || height < 10) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = canvasTheme();

    const [x0, x1] = spec.domain;
    const yr = spec.yRange;
    const toPx = (x: number, y: number): [number, number] => [
      ((x - x0) / (x1 - x0)) * width,
      (0.5 - y / (yr * 2)) * height,
    ];

    ctx.clearRect(0, 0, width, height);

    // grid
    const stepX = niceStep(x1 - x0, 8);
    const stepY = niceStep(yr * 2, 5);
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(x0 / stepX) * stepX; gx <= x1; gx += stepX) {
      const [px] = toPx(gx, 0);
      ctx.strokeStyle = Math.abs(gx) < 1e-9 ? th.inkSoft(0.2) : th.inkSoft(0.05);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    for (let gy = Math.ceil(-yr / stepY) * stepY; gy <= yr; gy += stepY) {
      const [, py] = toPx(0, gy);
      ctx.strokeStyle = Math.abs(gy) < 1e-9 ? th.inkSoft(0.2) : th.inkSoft(0.05);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // curve (clipped softly)
    ctx.strokeStyle = "#c2451d";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let drawing = false;
    const samples = 500;
    for (let i = 0; i <= samples; i++) {
      const x = x0 + ((x1 - x0) * i) / samples;
      const y = spec.fn(x);
      if (Math.abs(y) > yr * 1.08) {
        drawing = false;
        continue;
      }
      const [px, py] = toPx(x, y);
      if (!drawing) {
        ctx.moveTo(px, py);
        drawing = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // critical points
    ctx.font = "10px ui-monospace, monospace";
    for (const cp of critical) {
      const [px, py] = toPx(cp.x, cp.y);
      // vertical guide
      ctx.strokeStyle = th.inkSoft(0.18);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = cp.type === "max" ? "#c2451d" : cp.type === "min" ? "#2e7d6e" : "#6e6b60";
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = th.halo;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      const label = `${cp.type} (${fmt(cp.x, 2)})`;
      const tw = ctx.measureText(label).width;
      const lx = clamp(px + 8, 4, width - tw - 6);
      const ly = clamp(py - 10, 12, height - 6);
      ctx.fillStyle = th.inkSoft(0.75);
      ctx.fillText(label, lx, ly);
    }
  }, [spec, critical, width, height, resolvedTheme]);

  return (
    <div className="space-y-5">
      {/* Expression selector */}
      <div role="group" aria-label="Expression" className="flex flex-wrap gap-2">
        {EXPRESSIONS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setExprId(e.id)}
            aria-pressed={exprId === e.id}
            className={cn(
              "focusable rounded-md px-3 py-1.5 font-mono text-[13px] transition-colors",
              exprId === e.id
                ? "bg-ink text-paper"
                : "border border-line text-graphite hover:border-ink/25 hover:text-ink"
            )}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: expression → derivative → critical points */}
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-card p-5 shadow-sm">
            <h3 className="mono-label text-graphite">Expression · derivative</h3>
            <p className="math mt-3 text-2xl text-ink">{spec.display}</p>
            <p className="math mt-2 text-lg text-vermilion">{spec.derivDisplay}</p>
          </div>

          <div className="overflow-hidden rounded-lg border border-line bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 className="mono-label text-graphite">Critical points · f′(x) = 0</h3>
              <span className="font-mono text-[10px] text-graphite/60">
                classified by f″
              </span>
            </div>
            {critical.length === 0 ? (
              <p className="px-5 py-4 text-sm text-graphite">
                No stationary points in the visible domain.
              </p>
            ) : (
              <table className="w-full text-left font-mono text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-line/70 text-graphite">
                    <th scope="col" className="px-5 py-2 font-normal">x</th>
                    <th scope="col" className="px-3 py-2 font-normal">f(x)</th>
                    <th scope="col" className="px-3 py-2 font-normal">f″(x)</th>
                    <th scope="col" className="px-5 py-2 font-normal">type</th>
                  </tr>
                </thead>
                <tbody>
                  {critical.map((cp) => (
                    <tr key={cp.x} className="border-b border-line/40 last:border-0">
                      <td className="px-5 py-2 text-ink">{fmt(cp.x, 3)}</td>
                      <td className="px-3 py-2 text-ink">{fmt(cp.y, 3)}</td>
                      <td className="px-3 py-2 text-graphite">{fmt(cp.d2, 3)}</td>
                      <td className="px-5 py-2">
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            cp.type === "max" && "bg-vermilion-soft text-vermilion",
                            cp.type === "min" && "bg-teal-soft text-teal",
                            cp.type === "flat" && "bg-secondary text-graphite"
                          )}
                        >
                          {cp.type === "flat" ? "stationary" : `local ${cp.type}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: AST */}
        <div className="rounded-lg border border-line bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="mono-label text-graphite">Syntax tree</h3>
            <span className="font-mono text-[10px] text-graphite/60">hover to inspect</span>
          </div>
          <svg
            viewBox={`0 0 ${astWidth} 160`}
            className="mt-4 h-auto w-full"
            role="img"
            aria-label={`Syntax tree of ${spec.label}. Hovering a node highlights its subtree.`}
            onMouseLeave={() => setHoverKey(null)}
          >
            {ast.edges.map((e, i) => (
              <line
                key={i}
                x1={e.x1 + 20}
                y1={e.y1 + 24}
                x2={e.x2 + 20}
                y2={e.y2 + 24}
                stroke="#c8c5b8"
                strokeWidth="1.4"
              />
            ))}
            {ast.nodes.map((n) => {
              const active =
                hoverKey !== null &&
                (n.key === hoverKey || n.key.startsWith(`${hoverKey}-`));
              return (
                <g
                  key={n.key}
                  transform={`translate(${n.cx + 20 - NODE_W / 2}, ${n.cy + 24 - NODE_H / 2})`}
                  onMouseEnter={() => setHoverKey(n.key)}
                  className="cursor-default"
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    fill={
                      active
                        ? "#c2451d"
                        : n.kind === "op"
                          ? "#fdf4ef"
                          : "#ffffff"
                    }
                    stroke={n.kind === "op" ? "#c2451d55" : "#e5e2d6"}
                    strokeWidth={active ? 1.5 : 1}
                  />
                  <text
                    x={NODE_W / 2}
                    y={15}
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                    fill={active ? "#fdf9f4" : n.kind === "op" ? "#c2451d" : "#1b1a16"}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-graphite/70">
            the same tree the engine evaluates, differentiates, and compiles —
            one structure, every downstream operation
          </p>
        </div>
      </div>

      {/* Graph */}
      <InstrumentFrame
        label="INSPECT.PLOT"
        meta={<span>f · f′ roots marked</span>}
        footer={
          <>
            <span>domain [{spec.domain[0]}, {spec.domain[1]}]</span>
            <span>roots via bisection on f′</span>
          </>
        }
      >
        <div ref={wrapRef} className="relative h-[260px] w-full sm:h-[300px]">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Plot of ${spec.label} with critical points marked in vermilion (maxima) and teal (minima).`}
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </InstrumentFrame>
    </div>
  );
}
