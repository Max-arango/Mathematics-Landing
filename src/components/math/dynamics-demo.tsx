"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Slider } from "@/components/ui/slider";
import { InstrumentFrame } from "@/components/landing/instrument-frame";
import { useElementSize, useInView, usePrefersReducedMotion } from "@/components/math/hooks";
import { clamp, fmt, rk4Step } from "@/components/math/lib";
import { canvasTheme } from "@/lib/canvas-theme";

/**
 * Phase portrait of the Van der Pol oscillator:
 *
 *   ẋ = y        ẏ = μ(1 − x²)y − x
 *
 * (μ = 0 reduces to the harmonic oscillator ẋ = y, ẏ = −x.)
 * Vector field + RK4 trajectories are real computations. Click to drop a
 * seed, drag to move it. Particles flow along the computed trajectories
 * (paused under reduced motion).
 */

const X_SPAN = 8; // [-4, 4]
const H = 0.045;
const MAX_STEPS = 1500;

const PRESET_SEEDS: Array<[number, number]> = [
  [2.3, 1.5],
  [-2.5, 0.7],
  [0.4, 2.7],
];

interface Seed {
  x: number;
  y: number;
}

export function DynamicsDemo() {
  const [mu, setMu] = useState(1.2);
  const [seeds, setSeeds] = useState<Seed[]>([{ x: -1.1, y: -2.2 }]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [inViewRef, inView] = useInView<HTMLDivElement>({ once: false, rootMargin: "60px" });
  const reduced = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();

  const field = (x: number, y: number): [number, number] => [
    y,
    mu * (1 - x * x) * y - x,
  ];

  /* Trajectories: presets + user seeds, RK4-integrated (recomputed on change). */
  const trajectories = useMemo(() => {
    const f = (x: number, y: number): [number, number] => [
      y,
      mu * (1 - x * x) * y - x,
    ];
    const all: Array<{ pts: Array<[number, number]>; kind: "preset" | "user" }> = [];
    const integrate = (x0: number, y0: number) => {
      const pts: Array<[number, number]> = [[x0, y0]];
      let x = x0;
      let y = y0;
      for (let s = 0; s < MAX_STEPS; s++) {
        [x, y] = rk4Step(x, y, H, f);
        pts.push([x, y]);
        if (s > 80 && (Math.abs(x) > 6 || Math.abs(y) > 6)) break;
      }
      return pts;
    };
    for (const [x, y] of PRESET_SEEDS) {
      all.push({ pts: integrate(x, y), kind: "preset" });
    }
    for (const s of seeds) {
      all.push({ pts: integrate(s.x, s.y), kind: "user" });
    }
    return all;
  }, [mu, seeds]);

  useEffect(() => {
    if (!inView || width < 10 || height < 10) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dw = Math.round(width * dpr);
    const dh = Math.round(height * dpr);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = canvasTheme();

    const toPx = (x: number, y: number): [number, number] => [
      ((x + X_SPAN / 2) / X_SPAN) * width,
      (0.5 - y / X_SPAN) * height,
    ];

    /* --- static layer (offscreen) --- */
    const base = document.createElement("canvas");
    base.width = dw;
    base.height = dh;
    const bctx = base.getContext("2d");
    if (!bctx) return;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // graph paper
    const step = 1;
    bctx.lineWidth = 1;
    for (let gx = -4; gx <= 4; gx += step) {
      const [px] = toPx(gx, 0);
      const major = Math.abs(gx) < 1e-9;
      bctx.strokeStyle = major ? th.inkSoft(0.2) : th.inkSoft(0.05);
      bctx.beginPath();
      bctx.moveTo(px, 0);
      bctx.lineTo(px, height);
      bctx.stroke();
    }
    for (let gy = -4; gy <= 4; gy += step) {
      const [, py] = toPx(0, gy);
      const major = Math.abs(gy) < 1e-9;
      bctx.strokeStyle = major ? th.inkSoft(0.2) : th.inkSoft(0.05);
      bctx.beginPath();
      bctx.moveTo(0, py);
      bctx.lineTo(width, py);
      bctx.stroke();
    }

    // vector field
    const cols = 22;
    const rows = 14;
    for (let i = 0; i <= cols; i++) {
      const x = -X_SPAN / 2 + (X_SPAN / 2) * (i / cols) * 2;
      for (let j = 0; j <= rows; j++) {
        const y = -X_SPAN / 2 + (X_SPAN / 2) * (j / rows) * 2;
        const [dx, dy] = field(x, y);
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag < 1e-6) continue;
        const [px, py] = toPx(x, y);
        const L = 9;
        const ux = (dx / mag) * L;
        const uy = (-dy / mag) * L;
        const alpha = 0.16 + 0.3 * Math.min(1, mag / 8);
        bctx.strokeStyle = th.inkSoft(Number(alpha.toFixed(2)));
        bctx.lineWidth = 1.2;
        bctx.beginPath();
        bctx.moveTo(px, py);
        bctx.lineTo(px + ux, py + uy);
        bctx.stroke();
        // arrowhead
        const ang = Math.atan2(uy, ux);
        bctx.beginPath();
        bctx.moveTo(px + ux, py + uy);
        bctx.lineTo(px + ux - 4.5 * Math.cos(ang - 0.42), py + uy - 4.5 * Math.sin(ang - 0.42));
        bctx.moveTo(px + ux, py + uy);
        bctx.lineTo(px + ux - 4.5 * Math.cos(ang + 0.42), py + uy - 4.5 * Math.sin(ang + 0.42));
        bctx.stroke();
      }
    }

    // trajectories
    for (const traj of trajectories) {
      bctx.strokeStyle =
        traj.kind === "user" ? "rgba(194,69,29,0.85)" : "rgba(46,125,110,0.55)";
      bctx.lineWidth = traj.kind === "user" ? 2.2 : 1.6;
      bctx.lineJoin = "round";
      bctx.beginPath();
      traj.pts.forEach((p, i) => {
        const [px, py] = toPx(p[0], p[1]);
        if (i === 0) bctx.moveTo(px, py);
        else bctx.lineTo(px, py);
      });
      bctx.stroke();
      // seed marker
      const [sx, sy] = toPx(traj.pts[0][0], traj.pts[0][1]);
      bctx.fillStyle = traj.kind === "user" ? "#c2451d" : "#2e7d6e";
      bctx.beginPath();
      bctx.arc(sx, sy, traj.kind === "user" ? 4 : 3, 0, Math.PI * 2);
      bctx.fill();
    }

    // equilibrium at origin
    const [ox, oy] = toPx(0, 0);
    bctx.strokeStyle = th.inkSoft(0.8);
    bctx.lineWidth = 1.6;
    bctx.beginPath();
    bctx.arc(ox, oy, 5, 0, Math.PI * 2);
    bctx.stroke();
    bctx.fillStyle = th.halo;
    bctx.beginPath();
    bctx.arc(ox, oy, 3.4, 0, Math.PI * 2);
    bctx.fill();
    bctx.font = "10px ui-monospace, monospace";
    bctx.fillStyle = th.muted;
    bctx.textAlign = "left";
    bctx.fillText("eq. (0, 0)", ox + 9, oy - 7);

    /* --- animation layer --- */
    let raf = 0;
    let disposed = false;
    let t = 0;
    let last = performance.now();

    const drawFrame = (now: number) => {
      if (disposed) return;
      // clamp both ways: rAF timestamps can regress briefly during rapid
      // re-renders (drags), and a negative dt would corrupt particle indices
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      t += dt;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(base, 0, 0, width, height);

      if (!reduced) {
        // particles flowing along each trajectory
        trajectories.forEach((traj, idx) => {
          const len = traj.pts.length;
          if (len < 2) return;
          const phase = ((t * 0.045 + idx * 0.19) % 1 + 1) % 1;
          const i = Math.min(len - 1, Math.max(0, Math.floor(phase * (len - 1))));
          const p = traj.pts[i];
          if (!p) return;
          const [px, py] = toPx(p[0], p[1]);
          ctx.fillStyle = traj.kind === "user" ? "#c2451d" : "#2e7d6e";
          ctx.beginPath();
          ctx.arc(px, py, traj.kind === "user" ? 4 : 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = th.halo;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        });
      }
      raf = requestAnimationFrame(drawFrame);
    };

    if (reduced) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(base, 0, 0, width, height);
      return () => {
        disposed = true;
      };
    }
    raf = requestAnimationFrame(drawFrame);
    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [inView, width, height, trajectories, reduced, resolvedTheme]);

  /* --- pointer: drop / drag seeds --- */

  const complexAt = (px: number, py: number): [number, number] => [
    (px / width - 0.5) * X_SPAN,
    (0.5 - py / height) * X_SPAN,
  ];

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const [wx, wy] = complexAt(px, py);
    // near an existing user seed?
    let near = -1;
    let bestD = 22 * 22;
    seeds.forEach((s, i) => {
      const [sx, sy] = [
        ((s.x + X_SPAN / 2) / X_SPAN) * width,
        (0.5 - s.y / X_SPAN) * height,
      ];
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      if (d < bestD) {
        bestD = d;
        near = i;
      }
    });
    if (near >= 0) {
      setDragIdx(near);
    } else {
      setSeeds((prev) => {
        const next = [...prev, { x: wx, y: wy }];
        return next.length > 4 ? next.slice(next.length - 4) : next;
      });
      setDragIdx(null);
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic/test events carry non-active pointer ids */
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragIdx === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const [wx, wy] = complexAt(e.clientX - rect.left, e.clientY - rect.top);
    setSeeds((prev) =>
      prev.map((s, i) =>
        i === dragIdx ? { x: clamp(wx, -3.9, 3.9), y: clamp(wy, -3.9, 3.9) } : s
      )
    );
  };

  const onPointerUp = () => setDragIdx(null);

  const muNote =
    mu < 0.02
      ? "μ = 0 — the linear center ẍ + x = 0. Every orbit closes on itself."
      : mu < 0.8
        ? "Weak nonlinearity: orbits wind slowly onto a closed attracting cycle."
        : "Relaxation regime: one stable limit cycle attracts every trajectory in the plane.";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <InstrumentFrame
        label="PHASE.PORTRAIT"
        meta={<span>van der pol</span>}
        footer={
          <>
            <span>domain [−4, 4]²</span>
            <span>RK4 · h = {H}</span>
            <span>seeds {PRESET_SEEDS.length + seeds.length}</span>
            <span className="ml-auto hidden sm:inline">click to drop a seed · drag to move</span>
          </>
        }
      >
        <div
          ref={(el) => {
            wrapRef.current = el;
            inViewRef.current = el;
          }}
          role="img"
          aria-label={`Phase portrait of the Van der Pol oscillator with mu ${fmt(mu, 2)}. Vector field with trajectories; click to add a seed and drag to move it.`}
          className="relative aspect-[4/3] w-full cursor-crosshair touch-pan-y"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        </div>
      </InstrumentFrame>

      {/* Control panel */}
      <div className="flex flex-col gap-5 rounded-xl border border-line bg-card p-4 shadow-sm sm:p-5">
        <div>
          <h3 className="mono-label text-graphite">System</h3>
          <div className="mt-3 rounded-lg border border-line bg-secondary/50 px-4 py-3.5">
            <p className="math text-lg leading-relaxed text-ink">
              ẋ = y
              <br />
              ẏ = <span className="text-vermilion">{fmt(mu, 2)}</span>(1 − x²)y − x
            </p>
            <p className="mt-2 font-mono text-[11px] text-graphite/70">
              autonomous planar flow · ℝ² → ℝ²
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="mu-slider" className="mono-label text-graphite">
              μ · nonlinearity
            </label>
            <span className="font-mono text-xs tabular-nums text-ink">{fmt(mu, 2)}</span>
          </div>
          <Slider
            id="mu-slider"
            value={[mu]}
            min={0}
            max={3}
            step={0.02}
            onValueChange={([v]) => setMu(v)}
            className="mt-3"
            aria-label="Nonlinearity parameter mu"
          />
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-graphite/60">
            <span>0 · harmonic</span>
            <span>3 · relaxation</span>
          </div>
        </div>

        <p className="rounded-md bg-secondary/70 px-3.5 py-3 text-[13px] leading-relaxed text-graphite">
          {muNote}
        </p>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs leading-snug text-graphite">
            User seeds persist while parameters change —
            <span className="text-ink"> recompute is live.</span>
          </p>
          <button
            type="button"
            onClick={() => setSeeds([])}
            className="focusable inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-graphite transition-colors hover:border-vermilion/40 hover:text-vermilion"
            aria-label="Clear user seeds"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Clear seeds
          </button>
        </div>
      </div>
    </div>
  );
}
