"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { InstrumentFrame } from "@/components/landing/instrument-frame";
import { useElementSize, useInView } from "@/components/math/hooks";
import { clamp, hexToRgb, lerp } from "@/components/math/lib";
import { cn } from "@/lib/utils";

/**
 * FRACTAL.LAB — a real escape-time explorer.
 * Mandelbrot · Julia · Burning Ship · Tricorn · Newton(z³−1).
 * Progressive rendering: a draft pass (half resolution, capped iterations)
 * appears within a frame; a full-quality pass follows once input settles.
 * All interaction is user-driven — nothing animates on its own, which keeps
 * the section inherently reduced-motion friendly.
 */

type FractalMode = "mandelbrot" | "julia" | "burning_ship" | "tricorn" | "newton";
type PaletteId = "paper" | "spectrum" | "mono";

interface View {
  cx: number;
  cy: number;
  span: number; // vertical extent in complex units
}

interface ModeSpec {
  id: FractalMode;
  label: string;
  formula: string;
  note: string;
  hint: string;
  view: View;
}

const MODES: ModeSpec[] = [
  {
    id: "mandelbrot",
    label: "Mandelbrot",
    formula: "zₙ₊₁ = zₙ² + c",
    note: "z₀ = 0 · c varies",
    hint: "click to zoom · shift-click to zoom out · scroll to dive",
    view: { cx: -0.6, cy: 0, span: 2.9 },
  },
  {
    id: "julia",
    label: "Julia",
    formula: "zₙ₊₁ = zₙ² + c",
    note: "fixed c · z₀ varies",
    hint: "drag anywhere to set c · scroll to zoom",
    view: { cx: 0, cy: 0, span: 3.0 },
  },
  {
    id: "burning_ship",
    label: "Burning Ship",
    formula: "zₙ₊₁ = (|Re zₙ| + i|Im zₙ|)² + c",
    note: "z₀ = 0 · c varies",
    hint: "click to zoom · shift-click to zoom out · scroll to dive",
    view: { cx: -0.45, cy: -0.5, span: 3.0 },
  },
  {
    id: "tricorn",
    label: "Tricorn",
    formula: "zₙ₊₁ = z̄ₙ² + c",
    note: "z₀ = 0 · c varies",
    hint: "click to zoom · shift-click to zoom out · scroll to dive",
    view: { cx: 0, cy: 0, span: 3.2 },
  },
  {
    id: "newton",
    label: "Newton",
    formula: "zₙ₊₁ = zₙ − (zₙ³ − 1)/(3zₙ²)",
    note: "basins of z³ − 1",
    hint: "click to zoom · shift-click to zoom out · scroll to dive",
    view: { cx: 0, cy: 0, span: 3.4 },
  },
];

const PALETTE_STOPS: Record<PaletteId, string[]> = {
  paper: ["#f2efe2", "#e4cf9f", "#cf9752", "#c2451d", "#7c2410", "#1c1614"],
  spectrum: ["#2e7d6e", "#cfe8de", "#f0eee5", "#eab8a0", "#c2451d", "#5b1a09"],
  mono: ["#f0eee5", "#c9c6ba", "#8a887c", "#4a4941", "#1c1b18"],
};

const PALETTE_LABELS: Record<PaletteId, string> = {
  paper: "Paper",
  spectrum: "Spectrum",
  mono: "Mono",
};

const LUT_SIZE = 512;

function buildLUT(stops: string[]): Uint8Array {
  const lut = new Uint8Array(LUT_SIZE * 3);
  const rgb = stops.map(hexToRgb);
  const seg = LUT_SIZE / (rgb.length - 1);
  for (let i = 0; i < LUT_SIZE; i++) {
    const pos = i / seg;
    const idx = Math.min(Math.floor(pos), rgb.length - 2);
    const f = clamp(pos - idx, 0, 1);
    lut[i * 3] = Math.round(lerp(rgb[idx][0], rgb[idx + 1][0], f));
    lut[i * 3 + 1] = Math.round(lerp(rgb[idx][1], rgb[idx + 1][1], f));
    lut[i * 3 + 2] = Math.round(lerp(rgb[idx][2], rgb[idx + 1][2], f));
  }
  return lut;
}

export function FractalDemo() {
  const [mode, setMode] = useState<FractalMode>("mandelbrot");
  const [iterations, setIterations] = useState(220);
  const [palette, setPalette] = useState<PaletteId>("paper");
  const [view, setView] = useState<View>(MODES[0].view);
  const [juliaC, setJuliaC] = useState({ re: -0.7, im: 0.27 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inViewRef, inView] = useInView<HTMLDivElement>({ once: false, rootMargin: "60px" });
  const [sizeRef, { width, height }] = useElementSize<HTMLDivElement>();

  const statusRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  const tokenRef = useRef(0);
  const rafRef = useRef(0);
  const osRef = useRef<HTMLCanvasElement | null>(null);
  const juliaDragging = useRef(false);
  const luts = useRef<Record<PaletteId, Uint8Array | null>>({ paper: null, spectrum: null, mono: null });

  const spec = MODES.find((m) => m.id === mode)!;

  /* ---------- rendering ---------- */

  useEffect(() => {
    if (!inView || width < 10 || height < 10) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const displayCtx = canvas.getContext("2d");
    if (!displayCtx) return;

    if (!luts.current[palette]) {
      luts.current[palette] = buildLUT(PALETTE_STOPS[palette]);
    }
    const lut = luts.current[palette]!;

    const startRender = (draft: boolean) => {
      // internal resolution: fraction of CSS size, capped
      const iw = clamp(Math.round(width * 0.62), 200, 560);
      const ih = Math.max(120, Math.round((iw * height) / width));

      let os = osRef.current;
      if (!os) {
        os = document.createElement("canvas");
        osRef.current = os;
      }
      if (os.width !== iw || os.height !== ih) {
        os.width = iw;
        os.height = ih;
      }
      const osCtx = os.getContext("2d");
      if (!osCtx) return;
      const img = osCtx.createImageData(iw, ih);

      // hi-dpi display canvas
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const dw = Math.round(width * dpr);
      const dh = Math.round(height * dpr);
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }
      displayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      displayCtx.imageSmoothingEnabled = true;

      const scale = view.span / ih;
      const x0 = view.cx - (iw / 2) * scale;
      const y0 = view.cy + (ih / 2) * scale;

      const maxIter = draft ? Math.min(iterations, 110) : iterations;
      const step = draft ? 2 : 1;
      const token = ++tokenRef.current;

      const newtonRoots = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];

      const pixel = (re: number, im: number): [number, number, number] => {
        // returns RGB
        let zr: number;
        let zi: number;
        let cr: number;
        let ci: number;
        if (mode === "julia") {
          zr = re;
          zi = im;
          cr = juliaC.re;
          ci = juliaC.im;
        } else {
          zr = 0;
          zi = 0;
          cr = re;
          ci = im;
        }

        if (mode === "newton") {
          zr = re;
          zi = im;
          let i = 0;
          for (; i < maxIter; i++) {
            const r2 = zr * zr;
            const i2 = zi * zi;
            if (r2 + i2 > 100) return [16, 16, 14]; // diverged
            // z³ − 1
            const z3r = zr * (r2 - 3 * i2);
            const z3i = zi * (3 * r2 - i2);
            const A = z3r - 1;
            const B = z3i;
            if (A * A + B * B < 1e-12) {
              // converged — classify the root
              const ang = Math.atan2(zi, zr);
              let best = 0;
              let bestD = Infinity;
              for (let r = 0; r < 3; r++) {
                let d = Math.abs(ang - newtonRoots[r]);
                if (d > Math.PI) d = Math.PI * 2 - d;
                if (d < bestD) {
                  bestD = d;
                  best = r;
                }
              }
              const shade = 0.3 + 0.7 * (1 - i / maxIter);
              const rootCols: Array<[number, number, number]> = [
                [224, 103, 61],
                [46, 125, 110],
                [205, 200, 185],
              ];
              const rc = rootCols[best];
              return [
                Math.round(rc[0] * shade),
                Math.round(rc[1] * shade),
                Math.round(rc[2] * shade),
              ];
            }
            // Newton step: z ← z − (z³−1)/(3z²)
            const d = 3 * (r2 + i2) * (r2 + i2); // |3z²|²
            if (d < 1e-24) break;
            const mr = r2 - i2;
            const mi = -2 * zr * zi; // conj(z²)
            const qr = (A * mr - B * mi) / d;
            const qi = (A * mi + B * mr) / d;
            zr -= qr;
            zi -= qi;
          }
          return [16, 16, 14];
        }

        let i = 0;
        for (; i < maxIter; i++) {
          const r2 = zr * zr;
          const i2 = zi * zi;
          if (r2 + i2 > 16) break;
          let tr: number;
          let ti: number;
          if (mode === "burning_ship") {
            const ar = Math.abs(zr);
            const ai = Math.abs(zi);
            tr = ar * ar - ai * ai;
            ti = 2 * ar * ai;
          } else if (mode === "tricorn") {
            tr = zr * zr - zi * zi;
            ti = -2 * zr * zi;
          } else {
            tr = r2 - i2;
            ti = 2 * zr * zi;
          }
          zr = tr + cr;
          zi = ti + ci;
        }
        if (i >= maxIter) return [16, 16, 14];

        // smooth iteration count
        const mag = Math.sqrt(zr * zr + zi * zi);
        const mu =
          i + 1 - Math.log(Math.log(Math.max(mag, Math.E)) / Math.LN2) / Math.LN2;
        const t = clamp(Math.sqrt(Math.max(0, mu) / maxIter) * 2.1, 0, 0.999);
        const li = (t * (LUT_SIZE - 1)) | 0;
        return [lut[li * 3], lut[li * 3 + 1], lut[li * 3 + 2]];
      };

      let row = 0;
      const loop = () => {
        if (tokenRef.current !== token) return;
        const deadline = performance.now() + 11;
        while (row < ih && performance.now() < deadline) {
          const py = row;
          const imC = y0 - py * scale;
          for (let px = 0; px < iw; px += step) {
            const [r, g, b] = pixel(x0 + px * scale, imC);
            for (let dy = 0; dy < step && py + dy < ih; dy++) {
              for (let dx = 0; dx < step && px + dx < iw; dx++) {
                const o = ((py + dy) * iw + (px + dx)) * 4;
                img.data[o] = r;
                img.data[o + 1] = g;
                img.data[o + 2] = b;
                img.data[o + 3] = 255;
              }
            }
          }
          row += step;
        }
        osCtx.putImageData(img, 0, 0);
        displayCtx.drawImage(os, 0, 0, width, height);
        if (statusRef.current) {
          statusRef.current.textContent =
            row < ih
              ? `rendering ${Math.round((row / ih) * 100)}%`
              : draft
                ? "draft ✓ refining…"
                : "idle";
        }
        if (row < ih) {
          rafRef.current = requestAnimationFrame(loop);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    };

    startRender(true);
    const finalTimer = window.setTimeout(() => startRender(false), 260);

    return () => {
      window.clearTimeout(finalTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      tokenRef.current++; // invalidate in-flight passes
    };
  }, [mode, iterations, palette, view, juliaC, width, height, inView]);

  /* ---------- interaction ---------- */

  const complexAt = (px: number, py: number) => {
    const scale = view.span / Math.max(1, height);
    return {
      re: view.cx + (px - width / 2) * scale,
      im: view.cy - (py - height / 2) * scale,
    };
  };

  const zoomAt = (px: number, py: number, factor: number) => {
    const p = complexAt(px, py);
    setView((v) => {
      const span = clamp(v.span * factor, 8e-13, 6);
      const f = span / v.span;
      return {
        span,
        cx: p.re - (p.re - v.cx) * f,
        cy: p.im - (p.im - v.cy) * f,
      };
    });
  };

  // wheel zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const factor = clamp(Math.exp(e.deltaY * 0.0012), 0.6, 1.6);
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [view, width, height]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const p = complexAt(px, py);
    if (cursorRef.current) {
      cursorRef.current.textContent = `${fmtC(p.re)} ${p.im >= 0 ? "+" : "−"} ${fmtC(Math.abs(p.im))}i`;
    }
    if (mode === "julia" && juliaDragging.current) {
      setJuliaC({ re: clamp(p.re, -2, 2), im: clamp(p.im, -2, 2) });
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode === "julia") {
      juliaDragging.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic/test events carry non-active pointer ids */
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const p = complexAt(e.clientX - rect.left, e.clientY - rect.top);
      setJuliaC({ re: clamp(p.re, -2, 2), im: clamp(p.im, -2, 2) });
    }
  };
  const onPointerUp = () => {
    juliaDragging.current = false;
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === "julia") return; // clicks set c instead
    const rect = e.currentTarget.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey ? 2 : 0.5);
  };

  const resetView = () => setView(spec.view);
  const zoomCenter = (factor: number) => setView((v) => ({ ...v, span: clamp(v.span * factor, 8e-13, 6) }));

  const switchMode = (id: FractalMode) => {
    setMode(id);
    setView(MODES.find((m) => m.id === id)!.view);
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <InstrumentFrame
        dark
        label="FRACTAL.LAB"
        meta={
          <span>
            <span ref={statusRef}>idle</span>
          </span>
        }
        footer={
          <>
            <span>
              center {fmtC(view.cx)} {view.cy >= 0 ? "+" : "−"} {fmtC(Math.abs(view.cy))}i
            </span>
            <span>Δ {view.span.toExponential(1)}</span>
            {mode === "julia" ? (
              <span>
                c = {fmtC(juliaC.re)} {juliaC.im >= 0 ? "+" : "−"} {fmtC(Math.abs(juliaC.im))}i
              </span>
            ) : null}
            <span className="ml-auto hidden sm:inline">
              cursor <span ref={cursorRef}>—</span>
            </span>
          </>
        }
      >
        <div
          ref={(el) => {
            wrapRef.current = el;
            inViewRef.current = el;
            sizeRef.current = el;
          }}
          role="img"
          aria-label={`Interactive ${spec.label} fractal explorer. ${spec.hint}.`}
          className={cn(
            "relative aspect-[3/2] w-full cursor-crosshair select-none",
            mode === "julia" && "cursor-grab active:cursor-grabbing"
          )}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={onClick}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        </div>
      </InstrumentFrame>

      {/* Control panel */}
      <div className="flex flex-col gap-5 rounded-xl border border-cream/15 bg-void-soft p-4 sm:p-5">
        <div>
          <h3 className="mono-label text-cream/60">Fractal</h3>
          <div role="group" aria-label="Fractal type" className="mt-3 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id)}
                aria-pressed={mode === m.id}
                className={cn(
                  "focusable rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  mode === m.id
                    ? "bg-vermilion text-[#fdf9f4]"
                    : "border border-cream/20 text-cream/70 hover:bg-cream/10 hover:text-cream"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-cream/10 bg-void/60 px-4 py-3.5">
          <p className="math text-lg leading-snug text-cream">{spec.formula}</p>
          <p className="mt-1 font-mono text-[11px] text-cream/50">{spec.note}</p>
          {mode === "julia" && (
            <p className="math mt-2 text-sm text-[#e0673d]">
              c = {fmtC(juliaC.re)} {juliaC.im >= 0 ? "+" : "−"} {fmtC(Math.abs(juliaC.im))}i
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="fractal-iters" className="mono-label text-cream/60">
              Iterations
            </label>
            <span className="font-mono text-xs tabular-nums text-cream">{iterations}</span>
          </div>
          <input
            id="fractal-iters"
            type="range"
            min={48}
            max={640}
            step={16}
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            className="lab-range mt-2"
            aria-label="Maximum iterations"
          />
        </div>

        <div>
          <h3 className="mono-label text-cream/60">Palette</h3>
          <div role="group" aria-label="Color palette" className="mt-3 flex gap-2">
            {(Object.keys(PALETTE_STOPS) as PaletteId[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPalette(p)}
                aria-pressed={palette === p}
                title={PALETTE_LABELS[p]}
                className={cn(
                  "focusable group flex-1 rounded-md border p-1 transition-all",
                  palette === p
                    ? "border-[#e0673d]"
                    : "border-cream/20 hover:border-cream/40"
                )}
              >
                <span
                  aria-hidden="true"
                  className="block h-3 w-full rounded-sm"
                  style={{
                    background: `linear-gradient(to right, ${PALETTE_STOPS[p].join(", ")})`,
                  }}
                />
                <span className="mt-1.5 block text-center font-mono text-[10px] text-cream/60">
                  {PALETTE_LABELS[p]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => zoomCenter(0.5)}
            className="focusable inline-flex size-9 items-center justify-center rounded-md border border-cream/20 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
            aria-label="Zoom in"
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => zoomCenter(2)}
            className="focusable inline-flex size-9 items-center justify-center rounded-md border border-cream/20 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
            aria-label="Zoom out"
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="focusable inline-flex size-9 items-center justify-center rounded-md border border-cream/20 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
            aria-label="Reset view"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
          <p className="ml-1 flex-1 font-mono text-[10px] leading-snug text-cream/45">
            {spec.hint}
          </p>
        </div>
      </div>
    </div>
  );
}

function fmtC(v: number): string {
  const s = v.toFixed(4);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
