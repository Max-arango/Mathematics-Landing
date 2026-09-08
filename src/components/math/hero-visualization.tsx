"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { InstrumentFrame } from "@/components/landing/instrument-frame";
import { useInView, usePrefersReducedMotion, sizeCanvas } from "@/components/math/hooks";
import { clamp, fmt } from "@/components/math/lib";
import { rgbTripleFromVar } from "@/lib/canvas-theme";

/**
 * Hero exhibit — a live, rotating pseudo-3D surface rendered as a wireframe
 * on a 2D canvas (light, no WebGL required):
 *
 *   z = 2.2·sin(1.4·r − 0.85·t)·e^(−r²/26) + 0.3·cos(1.3x)·sin(1.1y)
 *
 * The pointer tilts the camera; hovering samples the nearest mesh vertex and
 * reads out its coordinates. Auto-rotation and time evolution pause when
 * off-screen, on hidden tabs, and for prefers-reduced-motion.
 */

const DOMAIN = 6.4;
const INK: readonly [number, number, number] = [27, 26, 22];
const VERMILION: readonly [number, number, number] = [194, 69, 29];

function surface(x: number, y: number, t: number): number {
  const r = Math.sqrt(x * x + y * y);
  return (
    2.2 * Math.sin(1.4 * r - 0.85 * t) * Math.exp(-(r * r) / 26) +
    0.3 * Math.cos(1.3 * x) * Math.sin(1.1 * y)
  );
}

export function HeroVisualization({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [inViewRef, inView] = useInView<HTMLDivElement>({
    once: false,
    rootMargin: "80px",
  });
  const reduced = usePrefersReducedMotion();

  const yawOut = useRef<HTMLSpanElement>(null);
  const pitchOut = useRef<HTMLSpanElement>(null);
  const timeOut = useRef<HTMLSpanElement>(null);
  const fpsOut = useRef<HTMLSpanElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let N = 44;

    // reusable vertex buffers (reallocated only when the grid resolution changes)
    let pts = new Float32Array(0);
    let zs = new Float32Array(0);
    let bufN = -1;

    // camera & animation state
    let yaw = -0.65;
    let pitch = 0.62;
    let t = 0;
    let yawOff = 0;
    let pitchOff = 0;
    let targetYawOff = 0;
    let targetPitchOff = 0;
    let last = performance.now();
    let fps = 60;
    let frames = 0;

    let pointer: { x: number; y: number } | null = null;
    let scheduled = false; // single-shot render for reduced motion

    // Theme-aware palette (re-resolved when resolvedTheme changes).
    const INK_TRIPLE = rgbTripleFromVar("--foreground", [27, 26, 22]);
    const PAPER_TRIPLE = rgbTripleFromVar("--background", [250, 249, 245]);
    const MUTED_TRIPLE = rgbTripleFromVar("--muted-foreground", [110, 107, 96]);
    const ink = INK_TRIPLE;
    const inkSoft = (a: number) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`;
    const mutedSoft = (a: number) => `rgba(${MUTED_TRIPLE[0]},${MUTED_TRIPLE[1]},${MUTED_TRIPLE[2]},${a})`;
    const halo = `rgb(${PAPER_TRIPLE.join(",")})`;

    const resize = () => {
      cssW = wrap.clientWidth;
      cssH = wrap.clientHeight;
      if (cssW < 2 || cssH < 2) return;
      sizeCanvas(canvas, cssW, cssH, 1.75);
      N = cssW > 620 ? 52 : cssW > 380 ? 42 : 34;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const project = (
      x: number,
      y: number,
      z: number,
      cy: number,
      sp: number,
      scale: number,
      cx: number,
      cyy: number
    ): [number, number, number] => {
      const cosY = Math.cos(cy);
      const sinY = Math.sin(cy);
      const X = x * cosY - y * sinY;
      const Y = x * sinY + y * cosY;
      const sinP = Math.sin(sp);
      const cosP = Math.cos(sp);
      const depth = Y * sinP + z * cosP;
      const Y2 = Y * cosP - z * sinP;
      const persp = 26 / (26 + depth);
      return [cx + X * scale * persp, cyy - Y2 * scale * persp, depth];
    };

    const render = (now: number) => {
      if (cssW < 2 || cssH < 2) return;
      last = now;

      if (bufN !== N) {
        pts = new Float32Array((N + 1) * (N + 1) * 3);
        zs = new Float32Array((N + 1) * (N + 1));
        bufN = N;
      }

      // smooth pointer-driven camera
      yawOff += (targetYawOff - yawOff) * 0.07;
      pitchOff += (targetPitchOff - pitchOff) * 0.07;

      const cy = yaw + yawOff;
      const sp = clamp(pitch + pitchOff, 0.15, 1.35);
      const scale = (Math.min(cssW, cssH * 1.15) / (DOMAIN * 2)) * 1.12;
      const cx = cssW / 2;
      const cyy = cssH / 2 + cssH * 0.06;

      ctx.clearRect(0, 0, cssW, cssH);

      for (let i = 0; i <= N; i++) {
        const x = -DOMAIN + (2 * DOMAIN * i) / N;
        for (let j = 0; j <= N; j++) {
          const y = -DOMAIN + (2 * DOMAIN * j) / N;
          const z = surface(x, y, t);
          const idx = i * (N + 1) + j;
          const [px, py, depth] = project(x, y, z, cy, sp, scale, cx, cyy);
          pts[idx * 3] = px;
          pts[idx * 3 + 1] = py;
          pts[idx * 3 + 2] = depth;
          zs[idx] = z;
        }
      }

      // depth range for alpha modulation
      let dMin = Infinity;
      let dMax = -Infinity;
      for (let k = 2; k < pts.length; k += 3) {
        if (pts[k] < dMin) dMin = pts[k];
        if (pts[k] > dMax) dMax = pts[k];
      }
      const dRange = Math.max(1e-6, dMax - dMin);

      const drawSegment = (i0: number, j0: number, i1: number, j1: number) => {
        const a = i0 * (N + 1) + j0;
        const b = i1 * (N + 1) + j1;
        const depth = (pts[a * 3 + 2] + pts[b * 3 + 2]) / 2;
        const d01 = (depth - dMin) / dRange;
        const alpha = clamp(0.85 - d01 * 0.55, 0.18, 0.85);
        const zAvg = (zs[a] + zs[b]) / 2;
        const col = zAvg >= 0 ? VERMILION : ink;
        const strength = zAvg >= 0 ? alpha : alpha * 0.6;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${strength.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(pts[a * 3], pts[a * 3 + 1]);
        ctx.lineTo(pts[b * 3], pts[b * 3 + 1]);
        ctx.stroke();
      };

      ctx.lineWidth = 1;
      ctx.lineJoin = "round";

      for (let i = 0; i <= N; i++) {
        for (let j = 0; j < N; j++) drawSegment(i, j, i, j + 1);
      }
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i < N; i++) drawSegment(i, j, i + 1, j);
      }

      // axis tripod at the mesh corner
      ctx.font = "10px ui-monospace, monospace";
      ctx.strokeStyle = mutedSoft(0.5);
      ctx.lineWidth = 1;
      const OX = -DOMAIN;
      const OY = -DOMAIN;
      const origin = project(OX, OY, 0, cy, sp, scale, cx, cyy);
      const axes: Array<[number, number, number, string]> = [
        [OX + 7.4, OY, 0, "x"],
        [OX, OY + 7.4, 0, "y"],
        [OX, OY, 3.3, "z"],
      ];
      for (const [ax, ay, az, label] of axes) {
        const p = project(ax, ay, az, cy, sp, scale, cx, cyy);
        ctx.beginPath();
        ctx.moveTo(origin[0], origin[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
        ctx.fillStyle = mutedSoft(0.95);
        ctx.fillText(label, p[0] + 4, p[1] + 3);
      }

      // hover sampling: nearest projected vertex to the pointer
      if (pointer) {
        let best = -1;
        let bestD = Infinity;
        const vertexCount = (N + 1) * (N + 1);
        for (let idx = 0; idx < vertexCount; idx++) {
          const dx = pts[idx * 3] - pointer.x;
          const dy = pts[idx * 3 + 1] - pointer.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = idx;
          }
        }
        if (best >= 0 && bestD < 26 * 26) {
          const i = Math.floor(best / (N + 1));
          const j = best % (N + 1);
          const wx = -DOMAIN + (2 * DOMAIN * i) / N;
          const wy = -DOMAIN + (2 * DOMAIN * j) / N;
          const wz = zs[best];
          const px = pts[best * 3];
          const py = pts[best * 3 + 1];
          ctx.strokeStyle = inkSoft(0.5);
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + (18 + wz * 4));
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#c2451d";
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = halo;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          const label = `(${fmt(wx, 1)}, ${fmt(wy, 1)}) → z = ${fmt(wz, 2)}`;
          ctx.font = "11px ui-monospace, monospace";
          const tw = ctx.measureText(label).width;
          const lx = clamp(px + 10, 6, Math.max(6, cssW - tw - 8));
          const ly = clamp(py + 26, 14, cssH - 8);
          ctx.fillStyle = `rgba(${PAPER_TRIPLE.join(",")},0.92)`;
          ctx.strokeStyle = inkSoft(0.14);
          ctx.beginPath();
          ctx.roundRect(lx - 5, ly - 12, tw + 10, 18, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = `rgb(${ink.join(",")})`;
          ctx.fillText(label, lx, ly);
        }
      }

      // readouts (imperative — no react re-render)
      frames++;
      if (frames % 12 === 0) {
        const deg = ((((cy * 180) / Math.PI) % 360) + 360) % 360;
        if (yawOut.current) yawOut.current.textContent = `${deg.toFixed(0)}°`;
        if (pitchOut.current)
          pitchOut.current.textContent = `${((sp * 180) / Math.PI).toFixed(0)}°`;
        if (timeOut.current) timeOut.current.textContent = `${t.toFixed(1)}s`;
        if (fpsOut.current) fpsOut.current.textContent = `${fps.toFixed(0)}`;
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      fps = fps * 0.9 + (1 / Math.max(dt, 1e-3)) * 0.1;
      if (!reduced) {
        yaw += dt * 0.1;
        t += dt * 0.5;
      }
      render(now);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (disposed || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (px < 0 || py < 0 || px > rect.width || py > rect.height) return;
      pointer = { x: px, y: py };
      targetYawOff = (px / rect.width - 0.5) * 0.55;
      targetPitchOff = (0.5 - py / rect.height) * 0.22;
      if (reduced && !raf && !scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          render(performance.now());
        });
      }
    };
    const onPointerLeave = () => {
      pointer = null;
      targetYawOff = 0;
      targetPitchOff = 0;
    };
    const onVisibility = () => {
      if (document.hidden || !inView) stop();
      else if (!reduced) start();
    };

    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    render(performance.now()); // first frame immediately (also the reduced-motion still)
    if (inView && !reduced) start();

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [inView, reduced, resolvedTheme]);

  return (
    <InstrumentFrame
      label="SURFACE.PLOT"
      className={className}
      meta={
        <span className="math text-[13px] normal-case tracking-normal text-ink">
          z = 2.2·sin(1.4r − 0.85t)·e<sup>−r²/26</sup>
        </span>
      }
      footer={
        <>
          <span>
            θ <span ref={yawOut} className="text-ink">—</span>
          </span>
          <span>
            φ <span ref={pitchOut} className="text-ink">—</span>
          </span>
          <span>
            t <span ref={timeOut} className="text-ink">—</span>
          </span>
          <span className="hidden sm:inline">
            <span ref={fpsOut} className="text-ink">—</span> fps
          </span>
          <span className="ml-auto hidden text-graphite/60 md:inline">
            move the pointer to tilt · hover to sample
          </span>
        </>
      }
    >
      <div
        ref={(el) => {
          wrapRef.current = el;
          inViewRef.current = el;
        }}
        className="relative aspect-[4/3.1] w-full cursor-crosshair touch-pan-y sm:aspect-[4/2.9]"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Interactive rotating 3D surface plot: z equals 2.2 times sine of 1.4r minus 0.85t, multiplied by e to the power of minus r squared over 26. Moving the pointer tilts the view."
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </InstrumentFrame>
  );
}
