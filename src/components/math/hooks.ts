"use client";

import { useEffect, useRef, useState } from "react";

/** True when the user prefers reduced motion (live-updating). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Observe when an element scrolls into view.
 * Paired with in-view–gated rendering so heavy canvases only run while visible.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  opts?: { rootMargin?: string; threshold?: number; once?: boolean }
) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { rootMargin = "0px 0px -5% 0px", threshold = 0.05, once = true } =
    opts ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin, threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold, once]);

  return [ref, inView] as const;
}

/** Track an element's content-box size (ResizeObserver, cleaned up). */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * Sizing helper for hi-DPI canvases. Sizes the backing store from a CSS size
 * and returns the pixel dimensions. Cap DPR to keep fill-rate affordable.
 */
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dprCap = 2
): { width: number; height: number; dpr: number } | null {
  const dpr = Math.min(
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    dprCap
  );
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  if (
    canvas.width !== width ||
    canvas.height !== height ||
    canvas.dataset.dpr !== String(dpr)
  ) {
    canvas.width = width;
    canvas.height = height;
    canvas.dataset.dpr = String(dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}
