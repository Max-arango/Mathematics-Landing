/**
 * Feature concepts for the "Built for mathematical exploration" section.
 * Deliberately conceptual, not comparative — no attacks on other products.
 */
export interface FeatureConcept {
  id: string;
  index: string;
  title: string;
  body: string;
  glyph: string;
}

export const featureConcepts: FeatureConcept[] = [
  {
    id: "unified",
    index: "01",
    title: "Unified",
    body: "One mathematical core across different domains. The same engine that plots your function also drives the fractal renderer and the ODE solver.",
    glyph: "∑",
  },
  {
    id: "visual",
    index: "02",
    title: "Visual",
    body: "Mathematics becomes something you can see and manipulate — surfaces, fields, trajectories, and projections instead of walls of notation.",
    glyph: "∂",
  },
  {
    id: "experimental",
    index: "03",
    title: "Experimental",
    body: "Change a parameter and observe the consequence. Every workspace is built around the loop: hypothesize, manipulate, recompute.",
    glyph: "λ",
  },
  {
    id: "open",
    index: "04",
    title: "Open",
    body: "An open-source project, MIT-licensed and under active development, designed to evolve with its community.",
    glyph: "∞",
  },
];
