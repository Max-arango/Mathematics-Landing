/**
 * Local workspace metadata.
 *
 * This mirrors the future `workspace_metadata` table in supabase/schema.sql
 * (workspace · name · description · icon · route · enabled · sort_order).
 * The landing renders entirely from this local data — no backend required.
 * Later, this module can be swapped for a Supabase query without
 * redesigning the components.
 */
export type WorkspaceId =
  | "calculator"
  | "fractal_lab"
  | "bloch_sphere"
  | "four_d"
  | "topology"
  | "dynamics"
  | "inspector"
  | "notebook"
  | "docs";

export interface Workspace {
  id: WorkspaceId;
  workspace: WorkspaceId;
  name: string;
  description: string;
  icon: string;
  route: string;
  enabled: boolean;
  sortOrder: number;
}

export const workspaceMetadata: Workspace[] = [
  {
    id: "calculator",
    workspace: "calculator",
    name: "Calculator",
    description: "2D & 3D graphing",
    icon: "calculator",
    route: "/calculator",
    enabled: true,
    sortOrder: 1,
  },
  {
    id: "fractal_lab",
    workspace: "fractal_lab",
    name: "Fractal Lab",
    description: "GPU fractals and complex dynamics",
    icon: "fractal",
    route: "/fractal-lab",
    enabled: true,
    sortOrder: 2,
  },
  {
    id: "bloch_sphere",
    workspace: "bloch_sphere",
    name: "Bloch Sphere",
    description: "Single-qubit visualization",
    icon: "bloch",
    route: "/bloch-sphere",
    enabled: true,
    sortOrder: 3,
  },
  {
    id: "four_d",
    workspace: "four_d",
    name: "4D",
    description: "Polytopes and higher-dimensional geometry",
    icon: "four-d",
    route: "/4d",
    enabled: true,
    sortOrder: 4,
  },
  {
    id: "topology",
    workspace: "topology",
    name: "Topology",
    description: "Shapes, deformation and homeomorphisms",
    icon: "topology",
    route: "/topology",
    enabled: true,
    sortOrder: 5,
  },
  {
    id: "dynamics",
    workspace: "dynamics",
    name: "Dynamics",
    description: "Dynamical systems and phase portraits",
    icon: "dynamics",
    route: "/dynamics",
    enabled: true,
    sortOrder: 6,
  },
  {
    id: "inspector",
    workspace: "inspector",
    name: "Inspector",
    description: "Mathematical structure analysis",
    icon: "inspector",
    route: "/inspector",
    enabled: true,
    sortOrder: 7,
  },
  {
    id: "notebook",
    workspace: "notebook",
    name: "Notebook",
    description: "Reproducible mathematical experiments",
    icon: "notebook",
    route: "/notebook",
    enabled: true,
    sortOrder: 8,
  },
  {
    id: "docs",
    workspace: "docs",
    name: "Docs",
    description: "Mathematical reference and documentation",
    icon: "docs",
    route: "/docs",
    enabled: true,
    sortOrder: 9,
  },
];

/**
 * Capabilities of the shared mathematical core, taken from the repository
 * README ("one engine, no duplicates, no eval"). Used in the engine section
 * as a specimen-sheet of the core. No invented features.
 */
export const engineCapabilities: string[] = [
  "lexer",
  "parser",
  "AST",
  "evaluator",
  "symbolic differentiation",
  "calculus",
  "gradients",
  "Hessian",
  "Jacobian",
  "Laplacian",
  "numerical methods",
  "roots",
  "integration",
  "linear algebra",
  "SVD",
  "eigenvalues / eigenvectors",
  "ODE solvers",
  "dynamical systems",
  "optimization",
  "probability",
  "statistics",
  "number theory",
  "units",
  "complex numbers",
  "PDE",
  "special functions",
  "AST → GLSL compilation",
];

/** Technology stack (evidence: repository README). */
export const stackChips: string[] = [
  "React 19",
  "TypeScript",
  "Vite",
  "TailwindCSS",
  "Zustand",
  "WebGL",
  "KaTeX",
  "Vitest",
  "Vercel",
];
