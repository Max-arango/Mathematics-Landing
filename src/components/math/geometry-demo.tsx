"use client";

import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { InstrumentFrame } from "@/components/landing/instrument-frame";
import { useElementSize, useInView, usePrefersReducedMotion } from "@/components/math/hooks";
import { clamp, fmt } from "@/components/math/lib";
import { cn } from "@/lib/utils";

/**
 * Dimension ladder: sphere → torus → tesseract.
 * A dark viewport inside a light page — the geometry floats in the lab.
 * Drag to orbit; the tesseract exposes its two rotation planes as sliders.
 */

type GeoObject = "sphere" | "torus" | "tesseract";

const OBJECT_INFO: Record<GeoObject, { label: string; dim: string; def: string; stat: string; project: string }> = {
  sphere: {
    label: "Sphere",
    dim: "3D",
    def: "S² = {(x, y, z) : x² + y² + z² = 1}",
    stat: "closed surface · χ = 2",
    project: "3D → 2D",
  },
  torus: {
    label: "Torus",
    dim: "3D",
    def: "S¹ × S¹ ⊂ ℝ³",
    stat: "genus 1 · χ = 0",
    project: "3D → 2D",
  },
  tesseract: {
    label: "Tesseract",
    dim: "4D",
    def: "{−1, 1}⁴ ⊂ ℝ⁴",
    stat: "16 V · 32 E · 24 F · 8 cells",
    project: "4D → 3D → 2D",
  },
};

export function GeometryDemo() {
  const [object, setObject] = useState<GeoObject>("tesseract");
  const [autoRotate, setAutoRotate] = useState(true);
  const [angleXY, setAngleXY] = useState(0.65);
  const [angleZW, setAngleZW] = useState(0.4);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [inViewRef, inView] = useInView<HTMLDivElement>({ once: false, rootMargin: "60px" });
  const reduced = usePrefersReducedMotion();

  const drag = useRef({ active: false, lastX: 0, lastY: 0, yaw: 0, pitch: 0 });
  const autoYaw = useRef(0);
  const angleRefs = useRef({ xy: angleXY, zw: angleZW });
  const objectRef = useRef(object);
  const autoRef = useRef(autoRotate);
  const syncCount = useRef(0);

  // keep loop-facing refs in sync without restarting the loop
  useEffect(() => {
    objectRef.current = object;
  }, [object]);
  useEffect(() => {
    autoRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    angleRefs.current.xy = angleXY;
    angleRefs.current.zw = angleZW;
  }, [angleXY, angleZW]);

  useEffect(() => {
    if (!inView || width < 10 || height < 10) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let disposed = false;
    let last = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dw = Math.round(width * dpr);
    const dh = Math.round(height * dpr);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ---- geometry builders ----

    const sphereLines = () => {
      const lines: Array<Array<[number, number, number]>> = [];
      const rings = 11;
      const meridians = 12;
      for (let ri = 0; ri < rings; ri++) {
        const theta = (-75 + (150 * ri) / (rings - 1)) * (Math.PI / 180);
        const line: Array<[number, number, number]> = [];
        for (let s = 0; s <= 48; s++) {
          const phi = (s / 48) * Math.PI * 2;
          line.push([
            Math.cos(theta) * Math.cos(phi),
            Math.sin(theta),
            Math.cos(theta) * Math.sin(phi),
          ]);
        }
        lines.push(line);
      }
      for (let mi = 0; mi < meridians; mi++) {
        const phi = (mi / meridians) * Math.PI * 2;
        const line: Array<[number, number, number]> = [];
        for (let s = 0; s <= 48; s++) {
          const theta = (s / 48) * Math.PI * 2;
          line.push([
            Math.cos(theta) * Math.cos(phi),
            Math.sin(theta),
            Math.cos(theta) * Math.sin(phi),
          ]);
        }
        lines.push(line);
      }
      return lines;
    };

    const torusLines = () => {
      const lines: Array<Array<[number, number, number]>> = [];
      const R = 1.05;
      const r = 0.44;
      const us = 28;
      const vs = 13;
      for (let vi = 0; vi < vs; vi++) {
        const v = (vi / vs) * Math.PI * 2;
        const line: Array<[number, number, number]> = [];
        for (let s = 0; s <= us; s++) {
          const u = (s / us) * Math.PI * 2;
          line.push([
            (R + r * Math.cos(v)) * Math.cos(u),
            r * Math.sin(v),
            (R + r * Math.cos(v)) * Math.sin(u),
          ]);
        }
        lines.push(line);
      }
      for (let ui = 0; ui < us; ui += 2) {
        const u = (ui / us) * Math.PI * 2;
        const line: Array<[number, number, number]> = [];
        for (let s = 0; s <= 24; s++) {
          const v = (s / 24) * Math.PI * 2;
          line.push([
            (R + r * Math.cos(v)) * Math.cos(u),
            r * Math.sin(v),
            (R + r * Math.cos(v)) * Math.sin(u),
          ]);
        }
        lines.push(line);
      }
      return lines;
    };

    const tesseractData = () => {
      const verts: number[][] = [];
      for (let i = 0; i < 16; i++) {
        verts.push([
          i & 1 ? 1 : -1,
          i & 2 ? 1 : -1,
          i & 4 ? 1 : -1,
          i & 8 ? 1 : -1,
        ]);
      }
      const edges: Array<[number, number]> = [];
      for (let a = 0; a < 16; a++) {
        for (let b = a + 1; b < 16; b++) {
          const diff = (a ^ b).toString(2).replace(/0/g, "").length;
          if (diff === 1) edges.push([a, b]);
        }
      }
      return { verts, edges };
    };

    const tess = tesseractData();

    const draw = () => {
      const obj = objectRef.current;
      ctx.fillStyle = "#131311";
      ctx.fillRect(0, 0, width, height);

      const yaw = autoYaw.current + drag.current.yaw;
      const pitch = clamp(0.52 + drag.current.pitch, 0.08, 1.45);
      const scaleBase = Math.min(width, height) * 0.34;
      const cx = width / 2;
      const cyy = height / 2;

      const project3 = (
        x: number,
        y: number,
        z: number
      ): [number, number, number] => {
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const X = x * cy - z * sy;
        const Z = x * sy + z * cy;
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        const Y = y * cp - Z * sp;
        const Z2 = y * sp + Z * cp;
        const s = 4.4 / (4.4 + Z2);
        return [cx + X * scaleBase * s, cyy - Y * scaleBase * s, Z2];
      };

      const strokeLine = (
        pts: Array<[number, number, number]>,
        color: string,
        lw: number
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const [px, py] = project3(pts[i][0], pts[i][1], pts[i][2]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };

      if (obj === "sphere") {
        const lines = sphereLines();
        lines.forEach((line, i) => {
          const isEquator = i === 5; // middle ring θ = 0
          strokeLine(
            line,
            isEquator ? "rgba(224,103,61,0.95)" : "rgba(240,238,229,0.28)",
            isEquator ? 2 : 1
          );
        });
      } else if (obj === "torus") {
        const lines = torusLines();
        lines.forEach((line, i) => {
          const highlight = i === 0; // innermost tube ring
          strokeLine(
            line,
            highlight ? "rgba(224,103,61,0.9)" : "rgba(240,238,229,0.26)",
            highlight ? 2 : 1
          );
        });
      } else {
        // tesseract — double rotation in XY and ZW
        const a = angleRefs.current.xy;
        const b = angleRefs.current.zw;
        const cA = Math.cos(a);
        const sA = Math.sin(a);
        const cB = Math.cos(b);
        const sB = Math.sin(b);
        const pts3 = tess.verts.map((v) => {
          const [x, y, z, w] = v;
          const x2 = x * cA - y * sA;
          const y2 = x * sA + y * cA;
          const z2 = z * cB - w * sB;
          const w2 = z * sB + w * cB;
          const p4 = 2.6 / (2.6 - w2);
          return [x2 * p4, y2 * p4, z2 * p4, w2] as [number, number, number, number];
        });
        for (const [i, j] of tess.edges) {
          const wAvg = (pts3[i][3] + pts3[j][3]) / 2;
          const near = clamp((wAvg + 1.5) / 3, 0, 1);
          const p1 = project3(pts3[i][0], pts3[i][1], pts3[i][2]);
          const p2 = project3(pts3[j][0], pts3[j][1], pts3[j][2]);
          ctx.strokeStyle =
            near > 0.6
              ? `rgba(224,103,61,${(0.35 + near * 0.65).toFixed(2)})`
              : `rgba(240,238,229,${(0.12 + near * 0.35).toFixed(2)})`;
          ctx.lineWidth = 0.8 + near * 1.6;
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.stroke();
        }
      }
    };

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const auto = autoRef.current && !reduced;
      if (auto) {
        autoYaw.current += dt * 0.22;
        if (objectRef.current === "tesseract") {
          angleRefs.current.xy += dt * 0.3;
          angleRefs.current.zw += dt * 0.16;
          syncCount.current++;
          if (syncCount.current % 5 === 0) {
            setAngleXY(Math.round((angleRefs.current.xy % (Math.PI * 2)) * 100) / 100);
            setAngleZW(Math.round((angleRefs.current.zw % (Math.PI * 2)) * 100) / 100);
          }
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    draw();
    if (!reduced) raf = requestAnimationFrame(tick);
    else {
      // reduced motion: still redraw on drags (user-initiated)
      const onRedraw = () => draw();
      canvas.addEventListener("labredraw", onRedraw);
      return () => {
        canvas.removeEventListener("labredraw", onRedraw);
        disposed = true;
        if (raf) cancelAnimationFrame(raf);
      };
    }

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [inView, width, height, reduced]);

  /* drag-to-orbit */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic/test events carry non-active pointer ids */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    drag.current.yaw += dx * 0.006;
    drag.current.pitch = clamp(drag.current.pitch + dy * 0.005, -0.75, 0.85);
    if (reduced) {
      canvasRef.current?.dispatchEvent(new Event("labredraw"));
    }
  };
  const onPointerUp = () => {
    drag.current.active = false;
  };

  const info = OBJECT_INFO[object];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <InstrumentFrame
        dark
        label="GEOMETRY.VIEWPORT"
        meta={<span>{info.project}</span>}
        footer={
          <>
            <span>{info.stat}</span>
            <span className="ml-auto hidden sm:inline">drag to orbit</span>
          </>
        }
      >
        <div
          ref={(el) => {
            wrapRef.current = el;
            inViewRef.current = el;
          }}
          role="img"
          aria-label={`Interactive rotating ${info.label} wireframe. Drag horizontally to orbit the view.`}
          className="relative aspect-[16/10] w-full cursor-grab touch-pan-y active:cursor-grabbing"
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
          <h3 className="mono-label text-graphite">Object</h3>
          <div role="group" aria-label="Geometry object" className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(OBJECT_INFO) as GeoObject[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setObject(k)}
                aria-pressed={object === k}
                className={cn(
                  "focusable rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  object === k
                    ? "bg-ink text-paper"
                    : "border border-line text-graphite hover:border-ink/25 hover:text-ink"
                )}
              >
                {OBJECT_INFO[k].label}
                <span className="ml-1.5 font-mono text-[10px] opacity-70">
                  {OBJECT_INFO[k].dim}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-secondary/50 px-4 py-3.5">
          <p className="math text-base leading-snug text-ink">{info.def}</p>
          <p className="mt-1 font-mono text-[11px] text-graphite/70">{info.project} · perspective projection</p>
        </div>

        {object === "tesseract" && (
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="rot-xy" className="mono-label text-graphite">
                  rotate · XY plane
                </label>
                <span className="font-mono text-xs tabular-nums text-ink">{fmt(angleXY, 2)} rad</span>
              </div>
              <Slider
                id="rot-xy"
                value={[angleXY]}
                min={0}
                max={Math.PI * 2}
                step={0.01}
                onValueChange={([v]) => setAngleXY(v)}
                className="mt-3"
                aria-label="Rotation in the XY plane"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="rot-zw" className="mono-label text-graphite">
                  rotate · ZW plane
                </label>
                <span className="font-mono text-xs tabular-nums text-ink">{fmt(angleZW, 2)} rad</span>
              </div>
              <Slider
                id="rot-zw"
                value={[angleZW]}
                min={0}
                max={Math.PI * 2}
                step={0.01}
                onValueChange={([v]) => setAngleZW(v)}
                className="mt-3"
                aria-label="Rotation in the ZW plane"
              />
            </div>
            <p className="rounded-md bg-secondary/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-graphite">
              A double rotation in two orthogonal planes — a rigid motion with
              no 3D equivalent. The near (vermilion) cell and far cell trade
              places continuously.
            </p>
          </div>
        )}

        {object !== "tesseract" && (
          <p className="rounded-md bg-secondary/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-graphite">
            {object === "sphere"
              ? "The sphere is the closed 2-manifold with no handles — every loop can be shrunk to a point."
              : "The torus is S¹ × S¹: its surface has one handle, and loops come in two independent classes."}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
          <div>
            <label htmlFor="geo-auto" className="text-sm font-medium text-ink">
              Auto-rotate
            </label>
            <p className="mt-0.5 text-xs text-graphite">Disabled under reduced motion.</p>
          </div>
          <Switch
            id="geo-auto"
            checked={autoRotate}
            onCheckedChange={setAutoRotate}
            aria-label="Toggle auto rotation"
          />
        </div>
      </div>
    </div>
  );
}
