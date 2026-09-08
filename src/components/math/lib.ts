/** Small, dependency-free math helpers shared by the landing's demos. */

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Nice axis step (1·2·5 progression) for graph-paper style plots. */
export function niceStep(range: number, target: number): number {
  const rough = range / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return step * pow;
}

/** Compact number formatting for readouts: trims trailing zeros. */
export function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  const s = v.toFixed(digits);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Signed fixed format, e.g. "+1.20" / "−0.35" (proper minus sign). */
export function fmtSigned(v: number, digits = 2): string {
  const s = fmt(Math.abs(v), digits);
  return (v < 0 ? "−" : "+") + s;
}

export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

/** Map t∈[0,1] onto a hex color ramp (arrays of hex strings). */
export function rampColor(stops: string[], t: number): string {
  const clamped = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(Math.floor(clamped), stops.length - 2);
  const f = clamped - i;
  return mixHex(stops[i], stops[i + 1] ?? stops[i], f);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const bl = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

/** One classic RK4 step for a 2D autonomous system. */
export function rk4Step(
  x: number,
  y: number,
  h: number,
  f: (x: number, y: number) => [number, number]
): [number, number] {
  const k1 = f(x, y);
  const k2 = f(x + (h / 2) * k1[0], y + (h / 2) * k1[1]);
  const k3 = f(x + (h / 2) * k2[0], y + (h / 2) * k2[1]);
  const k4 = f(x + h * k3[0], y + h * k3[1]);
  return [
    x + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    y + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
  ];
}

/** Numerical derivative (central difference). */
export function numDeriv(f: (x: number) => number, x: number, h = 1e-4): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

/** Find sign changes of g on [a,b] and refine by bisection. */
export function findRoots(
  g: (x: number) => number,
  a: number,
  b: number,
  samples = 2000
): number[] {
  const roots: number[] = [];
  const dx = (b - a) / samples;
  let prevX = a;
  let prevY = g(a);
  for (let i = 1; i <= samples; i++) {
    const x = a + i * dx;
    const y = g(x);
    if (prevY === 0 && Number.isFinite(prevY)) {
      roots.push(prevX);
    } else if (prevY * y < 0) {
      let lo = prevX;
      let hi = x;
      let flo = prevY;
      for (let k = 0; k < 48; k++) {
        const mid = (lo + hi) / 2;
        const fmid = g(mid);
        if (flo * fmid <= 0) {
          hi = mid;
        } else {
          lo = mid;
          flo = fmid;
        }
      }
      roots.push((lo + hi) / 2);
    }
    prevX = x;
    prevY = y;
  }
  return roots;
}

/** Trapezoid rule — used by the notebook's integral readout. */
export function integrate(
  f: (x: number) => number,
  a: number,
  b: number,
  n = 600
): number {
  const h = (b - a) / n;
  let sum = 0.5 * (f(a) + f(b));
  for (let i = 1; i < n; i++) sum += f(a + i * h);
  return sum * h;
}
