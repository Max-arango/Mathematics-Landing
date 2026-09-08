/**
 * Canvas theme resolution.
 *
 * The math demos draw on <canvas>, where CSS can't restyle pixels. These
 * helpers read the live CSS variables (theme-aware: light/dark) so every
 * draw pass can use the current paper/ink palette. Components add
 * `resolvedTheme` from next-themes to their draw dependencies so a theme
 * switch triggers a redraw.
 */

export interface CanvasTheme {
  /** Page background ("paper") — canvas backdrop + light halos. */
  paper: string;
  /** Foreground ("ink") — text and solid ink strokes. */
  ink: string;
  /** Halo stroke drawn around colored markers. */
  halo: string;
  /** Tooltip chip background (translucent paper). */
  chipBg: string;
  /** Tooltip chip border (faint ink). */
  chipStroke: string;
  /** Muted label color (matches --muted-foreground). */
  muted: string;
  /** Ink at a given alpha (grid lines, leaders, dashed curves). */
  inkSoft: (alpha: number) => string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** "#rrggbb" / "#rgb" / "rgb()" / "rgba()" → "r,g,b" (or null). */
function toRgbTriple(color: string): string | null {
  const c = color.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) {
    const [r, g, b] = m[1].split("").map((h) => parseInt(h + h, 16));
    return `${r},${g},${b}`;
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const parts = m[1].split(",").map((s) => Number.parseFloat(s));
    if (parts.length >= 3) return `${parts[0]},${parts[1]},${parts[2]}`;
  }
  return null;
}

export function canvasTheme(): CanvasTheme {
  const paper = cssVar("--background", "#faf9f5");
  const ink = cssVar("--foreground", "#1b1a16");
  const muted = cssVar("--muted-foreground", "#6e6b60");
  const paperRgb = toRgbTriple(paper) ?? "250,249,245";
  const inkRgb = toRgbTriple(ink) ?? "27,26,22";
  return {
    paper,
    ink,
    halo: paper,
    chipBg: `rgba(${paperRgb},0.92)`,
    chipStroke: `rgba(${inkRgb},0.15)`,
    muted,
    inkSoft: (alpha: number) => `rgba(${inkRgb},${alpha})`,
  };
}

/** Read a CSS color variable as an [r,g,b] triple (for template-built rgba). */
export function rgbTripleFromVar(varName: string, fallback: readonly [number, number, number]): [number, number, number] {
  const triple = toRgbTriple(cssVar(varName, `rgb(${fallback.join(",")})`));
  if (!triple) return [fallback[0], fallback[1], fallback[2]];
  const parts = triple.split(",").map((s) => Number.parseFloat(s));
  return [parts[0], parts[1], parts[2]];
}
