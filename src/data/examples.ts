/**
 * Featured examples — local demo data.
 *
 * Mirrors the future `examples` table in supabase/schema.sql
 * (title · slug · description · workspace · configuration · featured).
 * These correspond to real mathematical content rendered by the landing's
 * standalone demo components; they also seed the future gallery.
 */
import type { WorkspaceId } from "./workspaces";

export interface ExampleConfig {
  [key: string]: string | number | boolean | string[];
}

export interface FeaturedExample {
  id: string;
  title: string;
  slug: string;
  description: string;
  workspace: WorkspaceId;
  configuration: ExampleConfig;
  featured: boolean;
}

export const featuredExamples: FeaturedExample[] = [
  {
    id: "ex-damped-harmonic-oscillator",
    title: "Damped harmonic oscillator",
    slug: "damped-harmonic-oscillator",
    description:
      "Trajectories of a lightly damped oscillator settling onto its equilibrium.",
    workspace: "dynamics",
    configuration: { system: "van_der_pol", mu: 0.0, method: "rk4" },
    featured: true,
  },
  {
    id: "ex-mandelbrot-deep-zoom",
    title: "Mandelbrot deep zoom",
    slug: "mandelbrot-deep-zoom",
    description: "Iteration z ← z² + c, resolved at thousands of iterations.",
    workspace: "fractal_lab",
    configuration: { fractal: "mandelbrot", iterations: 1024, palette: "paper" },
    featured: true,
  },
  {
    id: "ex-tesseract-double-rotation",
    title: "Tesseract double rotation",
    slug: "tesseract-double-rotation",
    description: "A 4-cube rotating simultaneously in the XY and ZW planes.",
    workspace: "four_d",
    configuration: { polytope: "tesseract", rotation_planes: ["xy", "zw"] },
    featured: true,
  },
  {
    id: "ex-gaussian-surface",
    title: "Gaussian family",
    slug: "gaussian-family",
    description: "The normal curve as a live, parameterized object.",
    workspace: "calculator",
    configuration: { expression: "a*exp(-(x-mu)^2/(2*sigma^2))", a: 1, mu: 0, sigma: 1 },
    featured: false,
  },
  {
    id: "ex-critical-points-cubic",
    title: "Critical points of a cubic",
    slug: "critical-points-cubic",
    description: "Symbolic derivative and classified stationary points of x³ − 3x.",
    workspace: "inspector",
    configuration: { expression: "x^3-3x" },
    featured: false,
  },
  {
    id: "ex-van-der-pol-limit-cycle",
    title: "Van der Pol limit cycle",
    slug: "van-der-pol-limit-cycle",
    description: "Every trajectory converges to one closed orbit.",
    workspace: "dynamics",
    configuration: { system: "van_der_pol", mu: 1.5 },
    featured: false,
  },
];
