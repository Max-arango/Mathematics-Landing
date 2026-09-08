"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { InstrumentFrame } from "@/components/landing/instrument-frame";
import { useElementSize } from "@/components/math/hooks";
import { clamp, fmt, fmtSigned, niceStep } from "@/components/math/lib";
import { canvasTheme } from "@/lib/canvas-theme";

/**
 * Live parameter manipulation: f(x) = a·sin(bx + c).
 * Sliders re-render the curve, the formula, the derived quantities and the
 * on-canvas tangent probe. Pure canvas 2D — redraws are rAF-coalesced and
 * only happen on actual changes (no idle loop).
 */

const X_MIN = -Math.PI * 2;
const X_MAX = Math.PI * 2;
const Y_RANGE = 3.1;

interface Params {
  a: number;
  b: number;
  c: number;
}

function captionFor({ a, b, c }: Params): string {
  if (b >= 2.6) return "High frequency — the curve compresses; period shrinks toward π/b.";
  if (b <= 0.9) return "Low frequency — a single wave barely completes across the domain.";
  if (Math.abs(c) > 2.2) return "Large phase shift — the wave is translated along x by −c/b.";
  if (a >= 1.9) return "Large amplitude — the oscillation spans nearly the full frame.";
  return "A plain sinusoid: amplitude a, frequency b, phase c. Every value is live.";
}

export function FunctionDemo() {
  const [a, setA] = useState(1.4);
  const [b, setB] = useState(2.0);
  const [c, setC] = useState(0.0);
  const [showDeriv, setShowDeriv] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();
  const hoverX = useRef<number | null>(null);
  const pending = useRef(false);
  const { resolvedTheme } = useTheme();

  const period = (2 * Math.PI) / b;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 2 || height < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = canvasTheme();

    const f = (x: number) => a * Math.sin(b * x + c);
    const df = (x: number) => a * b * Math.cos(b * x + c);

    const toPx = (x: number, y: number): [number, number] => [
      ((x - X_MIN) / (X_MAX - X_MIN)) * width,
      (0.5 - y / (Y_RANGE * 2)) * height,
    ];

    ctx.clearRect(0, 0, width, height);

    // graph paper
    const stepX = niceStep(X_MAX - X_MIN, 8);
    const stepY = niceStep(Y_RANGE * 2, 6);
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(X_MIN / stepX) * stepX; gx <= X_MAX + 1e-9; gx += stepX) {
      const [px] = toPx(gx, 0);
      const major = Math.abs(gx) < 1e-9;
      ctx.strokeStyle = major ? th.inkSoft(0.22) : th.inkSoft(0.06);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    for (let gy = Math.ceil(-Y_RANGE / stepY) * stepY; gy <= Y_RANGE + 1e-9; gy += stepY) {
      const [, py] = toPx(0, gy);
      const major = Math.abs(gy) < 1e-9;
      ctx.strokeStyle = major ? "rgba(27,26,22,0.22)" : "rgba(27,26,22,0.06)";
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // tick labels
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = th.muted;
    for (let gx = Math.ceil(X_MIN / stepX) * stepX; gx <= X_MAX + 1e-9; gx += stepX) {
      if (Math.abs(gx) < 1e-9) continue;
      const [px, py] = toPx(gx, 0);
      const label =
        Math.abs(gx / Math.PI) < 10 && Math.abs((gx / Math.PI) % 1) < 1e-9
          ? `${gx > 0 ? "" : "−"}${fmt(Math.abs(gx / Math.PI), 1)}π`
          : fmt(gx, 0);
      ctx.textAlign = "center";
      ctx.fillText(label, px, Math.min(height - 4, py + 13));
    }

    // amplitude guides at ±a
    ctx.strokeStyle = "rgba(194,69,29,0.35)";
    ctx.setLineDash([4, 5]);
    for (const ay of [a, -a]) {
      const [, py] = toPx(0, ay);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(194,69,29,0.8)";
    ctx.textAlign = "left";
    ctx.fillText("a", 8, toPx(0, a)[1] - 5);
    ctx.fillText("−a", 8, toPx(0, -a)[1] + 12);

    // derivative ghost
    if (showDeriv) {
      ctx.strokeStyle = "rgba(46,125,110,0.75)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      const samples = 420;
      for (let i = 0; i <= samples; i++) {
        const x = X_MIN + ((X_MAX - X_MIN) * i) / samples;
        const [px, py] = toPx(x, clamp(df(x), -Y_RANGE, Y_RANGE));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // main curve
    ctx.strokeStyle = "#c2451d";
    ctx.lineWidth = 2.6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    const samples = 520;
    for (let i = 0; i <= samples; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / samples;
      const [px, py] = toPx(x, f(x));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // tangent probe
    const hx = hoverX.current;
    if (hx !== null) {
      const x0 = clamp(hx, X_MIN, X_MAX);
      const y0 = f(x0);
      const m = df(x0);
      // tangent segment
      const dxT = 1.4;
      ctx.strokeStyle = th.inkSoft(0.65);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      const [p1x, p1y] = toPx(x0 - dxT, y0 - m * dxT);
      const [p2x, p2y] = toPx(x0 + dxT, y0 + m * dxT);
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();
      ctx.setLineDash([]);
      // point
      const [hpx, hpy] = toPx(x0, y0);
      ctx.fillStyle = "#c2451d";
      ctx.beginPath();
      ctx.arc(hpx, hpy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = th.halo;
      ctx.lineWidth = 2;
      ctx.stroke();
      // readout chip
      const label = `(${fmt(x0, 2)}, ${fmt(y0, 2)})  slope ${fmt(m, 2)}`;
      ctx.font = "11px ui-monospace, monospace";
      const tw = ctx.measureText(label).width;
      const lx = clamp(hpx + 12, 6, width - tw - 10);
      const ly = clamp(hpy - 34, 8, height - 26);
      ctx.fillStyle = th.chipBg;
      ctx.strokeStyle = th.chipStroke;
      ctx.beginPath();
      ctx.roundRect(lx - 5, ly - 3, tw + 10, 20, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = th.ink;
      ctx.textAlign = "left";
      ctx.fillText(label, lx, ly + 11);
    }
  }, [a, b, c, showDeriv, width, height, resolvedTheme]);

  const requestRender = () => {
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => {
      pending.current = false;
      draw();
    });
  };

  useEffect(() => {
    draw();
  }, [draw]);

  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    hoverX.current = X_MIN + (px / rect.width) * (X_MAX - X_MIN);
    requestRender();
  };
  const onLeave = () => {
    hoverX.current = null;
    requestRender();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,360px)_1fr]">
      {/* Parameter panel */}
      <div className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="mono-label text-graphite">Experiment parameters</h3>
          <span className="font-mono text-[10px] text-graphite/60">sin-lab</span>
        </div>

        <p className="math mt-5 text-xl text-ink">
          f(x) = {fmt(a, 2)}·sin({fmt(b, 2)}x {c >= 0 ? "+" : "−"} {fmt(Math.abs(c), 2)})
        </p>
        {showDeriv && (
          <p className="math mt-1.5 text-base text-teal">
            f′(x) = {fmt(a * b, 2)}·cos({fmt(b, 2)}x {c >= 0 ? "+" : "−"} {fmt(Math.abs(c), 2)})
          </p>
        )}

        <div className="mt-7 space-y-6">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="param-a" className="mono-label text-graphite">
                a · amplitude
              </label>
              <span className="font-mono text-xs tabular-nums text-ink">{fmt(a, 2)}</span>
            </div>
            <Slider
              id="param-a"
              value={[a]}
              min={0.25}
              max={2.5}
              step={0.05}
              onValueChange={([v]) => setA(v)}
              className="mt-3"
              aria-label="Amplitude a"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="param-b" className="mono-label text-graphite">
                b · frequency
              </label>
              <span className="font-mono text-xs tabular-nums text-ink">{fmt(b, 2)}</span>
            </div>
            <Slider
              id="param-b"
              value={[b]}
              min={0.5}
              max={4}
              step={0.05}
              onValueChange={([v]) => setB(v)}
              className="mt-3"
              aria-label="Frequency b"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="param-c" className="mono-label text-graphite">
                c · phase
              </label>
              <span className="font-mono text-xs tabular-nums text-ink">
                {fmtSigned(c, 2)} rad
              </span>
            </div>
            <Slider
              id="param-c"
              value={[c]}
              min={-Math.PI}
              max={Math.PI}
              step={0.02}
              onValueChange={([v]) => setC(v)}
              className="mt-3"
              aria-label="Phase c in radians"
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
            <div>
              <label
                htmlFor="deriv-toggle"
                className="text-sm font-medium text-ink"
              >
                Show derivative
              </label>
              <p className="mt-0.5 text-xs text-graphite">
                Tangent slope at the cursor is always live.
              </p>
            </div>
            <Switch
              id="deriv-toggle"
              checked={showDeriv}
              onCheckedChange={setShowDeriv}
              aria-label="Toggle derivative overlay"
            />
          </div>
        </div>

        <dl className="mt-7 space-y-2.5 border-t border-line pt-5 font-mono text-xs tabular-nums">
          <div className="flex justify-between">
            <dt className="text-graphite">period T = 2π/b</dt>
            <dd className="text-ink">{fmt(period, 3)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-graphite">zeros xₖ = (kπ − c)/b</dt>
            <dd className="text-ink">k ∈ ℤ</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-graphite">max |f′| = a·b</dt>
            <dd className="text-ink">{fmt(a * b, 2)}</dd>
          </div>
        </dl>

        <p className="mt-5 rounded-md bg-secondary/70 px-3.5 py-3 text-[13px] leading-relaxed text-graphite">
          {captionFor({ a, b, c })}
        </p>
      </div>

      {/* Live plot */}
      <InstrumentFrame
        label="GRAPH.2D"
        meta={<span className="math text-[13px] normal-case tracking-normal text-ink">f: ℝ → ℝ</span>}
        footer={
          <>
            <span>domain [−2π, 2π]</span>
            <span>samples 520</span>
            <span className="ml-auto hidden sm:inline">hover for the tangent probe</span>
          </>
        }
      >
        <div
          ref={wrapRef}
          className="relative h-[300px] w-full cursor-crosshair touch-pan-y sm:h-[380px] lg:h-[440px]"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={onLeave}
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Live plot of f of x equals ${fmt(a, 2)} times sine of ${fmt(b, 2)} x plus ${fmt(c, 2)}, with a tangent probe following the pointer.`}
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </InstrumentFrame>
    </div>
  );
}
