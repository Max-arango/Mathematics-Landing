"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useTheme } from "next-themes";
import { Slider } from "@/components/ui/slider";
import { useElementSize, usePrefersReducedMotion } from "@/components/math/hooks";
import { fmt, integrate } from "@/components/math/lib";
import { cn } from "@/lib/utils";
import { canvasTheme } from "@/lib/canvas-theme";

/**
 * NOTEBOOK — a reproducible experiment.
 * Sliders edit *draft* parameters; a run commits them and the pipeline
 * recomputes in dependency order (parameters → expression → graph →
 * analysis). Auto-runs shortly after you stop moving a slider, exactly
 * like a reactive notebook. Instant under reduced motion.
 */

type Params = { a: number; mu: number; sigma: number };

const INITIAL: Params = { a: 1.2, mu: 0.4, sigma: 0.9 };

const F = (x: number, p: Params) =>
  p.a * Math.exp(-((x - p.mu) ** 2) / (2 * p.sigma * p.sigma));

function Cell({
  title,
  kind,
  stale,
  seq,
  children,
  className,
}: {
  title: string;
  kind: string;
  stale: boolean;
  seq: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-xs transition-colors duration-300",
        stale ? "border-amber/50" : "border-line",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-line/70 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              "size-[7px] rounded-full transition-colors duration-300",
              stale ? "bg-amber" : "bg-vermilion"
            )}
          />
          <h3 className="mono-label text-graphite">{title}</h3>
        </div>
        <span className="font-mono text-[10px] text-graphite/60">{kind}</span>
      </div>
      {/* pulse bar: replays on each run */}
      <div key={seq} className="h-0.5 w-full overflow-hidden">
        <div className="h-full w-full origin-left animate-[notebook-run_0.7s_ease-out] bg-vermilion/70 motion-reduce:hidden" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-5" aria-hidden="true">
      <svg viewBox="0 0 10 16" className="h-4 w-2.5">
        <line x1="5" y1="0" x2="5" y2="10" stroke="#c8c5b8" strokeWidth="1.4" />
        <path d="M1 9 L5 15 L9 9" fill="none" stroke="#c8c5b8" strokeWidth="1.4" />
      </svg>
      <span className="mono-label text-graphite/50 [font-size:9px]">{label}</span>
    </div>
  );
}

export function NotebookDemo() {
  const [draft, setDraft] = useState<Params>(INITIAL);
  const [committed, setCommitted] = useState<Params>(INITIAL);
  const [stale, setStale] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [seq, setSeq] = useState(0);
  const reduced = usePrefersReducedMotion();
  const { resolvedTheme } = useTheme();

  const timers = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const run = (p: Params) => {
    clearTimers();
    setCommitted(p);
    if (reduced) {
      setStale([false, false, false]);
      setSeq((s) => s + 1);
      return;
    }
    setStale([false, true, true]);
    timers.current.push(
      window.setTimeout(() => setStale([false, false, true]), 170),
      window.setTimeout(() => setStale([false, false, false]), 340),
      window.setTimeout(() => setSeq((s) => s + 1), 60)
    );
  };

  const onParam = (key: keyof Params, v: number) => {
    const next = { ...draft, [key]: v };
    setDraft(next);
    setStale([true, true, true]);
    clearTimers();
    // reactive auto-run shortly after the last change
    timers.current.push(window.setTimeout(() => run(next), 650));
  };

  useEffect(() => () => clearTimers(), []);

  const analysis = useMemo(() => {
    const analytic = committed.a * committed.sigma * Math.sqrt(2 * Math.PI);
    const numeric = integrate(
      (x) => F(x, committed),
      committed.mu - 5 * committed.sigma,
      committed.mu + 5 * committed.sigma,
      400
    );
    const fwhm = 2 * Math.sqrt(2 * Math.LN2) * committed.sigma;
    return { analytic, numeric, fwhm, peak: committed.a };
  }, [committed]);

  /* graph */
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

    const x0 = committed.mu - 4.2 * committed.sigma;
    const x1 = committed.mu + 4.2 * committed.sigma;
    const yr = committed.a * 1.25 + 0.05;
    const toPx = (x: number, y: number): [number, number] => [
      ((x - x0) / (x1 - x0)) * width,
      (1 - y / yr) * (height - 14) + 7,
    ];

    ctx.clearRect(0, 0, width, height);

    // baseline
    const [, baseY] = toPx(0, 0);
    ctx.strokeStyle = th.inkSoft(0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(width, baseY);
    ctx.stroke();

    // filled area
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let i = 0; i <= 260; i++) {
      const x = x0 + ((x1 - x0) * i) / 260;
      const [px, py] = toPx(x, F(x, committed));
      ctx.lineTo(px, py);
    }
    ctx.lineTo(width, baseY);
    ctx.closePath();
    ctx.fillStyle = "rgba(194,69,29,0.1)";
    ctx.fill();

    // curve
    ctx.strokeStyle = "#c2451d";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= 260; i++) {
      const x = x0 + ((x1 - x0) * i) / 260;
      const [px, py] = toPx(x, F(x, committed));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // FWHM bracket
    const halfY = committed.a / 2;
    const dx = committed.sigma * Math.sqrt(2 * Math.LN2);
    const [lx, ly] = toPx(committed.mu - dx, halfY);
    const [rx] = toPx(committed.mu + dx, halfY);
    ctx.strokeStyle = "rgba(46,125,110,0.85)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "#2e7d6e";
    ctx.textAlign = "center";
    ctx.fillText("FWHM", (lx + rx) / 2, ly - 6);

    // peak marker
    const [px, py] = toPx(committed.mu, committed.a);
    ctx.fillStyle = "#c2451d";
    ctx.beginPath();
    ctx.arc(px, py, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = th.halo;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }, [committed, width, height, resolvedTheme]);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* Notebook */}
      <div className="rounded-xl border border-line bg-paper p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="mono-label text-graphite">
            gaussian-family · notebook
          </h3>
          <span className="mono-label text-graphite/50 [font-size:9px]">
            4 cells · deterministic
          </span>
        </div>

        <div className="mt-4">
          <Cell title="01 · parameters" kind="input" stale={stale[0]} seq={seq}>
            <dl className="grid grid-cols-3 gap-3 font-mono text-xs tabular-nums">
              <div className="rounded-md border border-line bg-secondary/50 px-3 py-2">
                <dt className="text-[10px] text-graphite">a</dt>
                <dd className="mt-0.5 text-sm text-ink">{fmt(committed.a, 2)}</dd>
              </div>
              <div className="rounded-md border border-line bg-secondary/50 px-3 py-2">
                <dt className="text-[10px] text-graphite">μ</dt>
                <dd className="mt-0.5 text-sm text-ink">{fmt(committed.mu, 2)}</dd>
              </div>
              <div className="rounded-md border border-line bg-secondary/50 px-3 py-2">
                <dt className="text-[10px] text-graphite">σ</dt>
                <dd className="mt-0.5 text-sm text-ink">{fmt(committed.sigma, 2)}</dd>
              </div>
            </dl>
          </Cell>

          <Connector label="defines" />

          <Cell title="02 · expression" kind="math" stale={stale[1]} seq={seq}>
            <p className="math text-lg text-ink">
              f(x) = {fmt(committed.a, 2)}·exp(−(x − {fmt(committed.mu, 2)})² /{" "}
              {fmt(2 * committed.sigma * committed.sigma, 2)})<span className="caret" aria-hidden="true" />
            </p>
          </Cell>

          <Connector label="plots" />

          <Cell title="03 · graph" kind="canvas" stale={stale[2]} seq={seq}>
            <div ref={wrapRef} className="relative h-40 w-full sm:h-44">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Plot of a Gaussian with amplitude ${fmt(committed.a, 2)}, center ${fmt(committed.mu, 2)}, and width ${fmt(committed.sigma, 2)}, with the full width at half maximum marked.`}
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </Cell>

          <Connector label="analyzes" />

          <Cell title="04 · analysis" kind="output" stale={stale[2]} seq={seq}>
            <dl className="space-y-2 font-mono text-xs tabular-nums">
              <div className="flex justify-between border-b border-line/50 pb-2">
                <dt className="text-graphite">peak f(μ)</dt>
                <dd className="text-ink">{fmt(analysis.peak, 3)}</dd>
              </div>
              <div className="flex justify-between border-b border-line/50 pb-2">
                <dt className="text-graphite">∫f dx (trapezoid)</dt>
                <dd className="text-ink">{fmt(analysis.numeric, 4)}</dd>
              </div>
              <div className="flex justify-between border-b border-line/50 pb-2">
                <dt className="text-graphite">a·σ·√(2π) analytic</dt>
                <dd className="text-vermilion">{fmt(analysis.analytic, 4)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-graphite">FWHM = 2√(2 ln 2)·σ</dt>
                <dd className="text-teal">{fmt(analysis.fwhm, 3)}</dd>
              </div>
            </dl>
          </Cell>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-6 rounded-xl border border-line bg-card p-4 shadow-sm sm:p-5 lg:sticky lg:top-24">
        <div>
          <h3 className="mono-label text-graphite">Experiment parameters</h3>
          <div className="mt-5 space-y-6">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="nb-a" className="mono-label text-graphite">a · amplitude</label>
                <span className="font-mono text-xs tabular-nums text-ink">{fmt(draft.a, 2)}</span>
              </div>
              <Slider id="nb-a" value={[draft.a]} min={0.2} max={2} step={0.05} onValueChange={([v]) => onParam("a", v)} className="mt-3" aria-label="Amplitude a" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="nb-mu" className="mono-label text-graphite">μ · center</label>
                <span className="font-mono text-xs tabular-nums text-ink">{fmt(draft.mu, 2)}</span>
              </div>
              <Slider id="nb-mu" value={[draft.mu]} min={-2} max={2} step={0.05} onValueChange={([v]) => onParam("mu", v)} className="mt-3" aria-label="Center mu" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="nb-sigma" className="mono-label text-graphite">σ · width</label>
                <span className="font-mono text-xs tabular-nums text-ink">{fmt(draft.sigma, 2)}</span>
              </div>
              <Slider id="nb-sigma" value={[draft.sigma]} min={0.3} max={1.6} step={0.02} onValueChange={([v]) => onParam("sigma", v)} className="mt-3" aria-label="Width sigma" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => run(draft)}
            className="focusable inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink/85"
          >
            <Play className="size-3.5" aria-hidden="true" />
            Run all
          </button>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "size-[7px] rounded-full transition-colors duration-300",
                stale.some(Boolean) ? "bg-amber" : "bg-vermilion"
              )}
            />
            <span className="font-mono text-[10px] text-graphite">
              {stale.some(Boolean) ? "stale · pending run" : "up to date"}
            </span>
          </div>
        </div>

        <p className="rounded-md bg-secondary/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-graphite">
          Runs are parameter snapshots — the same numbers always produce the
          same notebook. Cells recompute in dependency order
          <span className="text-ink"> parameters → expression → graph → analysis.</span>
        </p>
      </div>
    </div>
  );
}
