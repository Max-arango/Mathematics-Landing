import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { engineCapabilities, workspaceMetadata } from "@/data/workspaces";
import { cn } from "@/lib/utils";

/**
 * "One engine" — the conceptual heart of the project.
 * Expression → Lexer → Parser → AST → Engine → every workspace.
 * Rendered as a vertical instrument pipeline with staged reveals.
 */

function Connector({ label }: { label?: string }) {
  return (
    <div
      className="relative flex h-12 w-full flex-col items-center justify-center"
      aria-hidden="true"
    >
      <div className="h-full w-px bg-line" />
      <span className="absolute left-1/2 top-0 size-[5px] -translate-x-1/2 rounded-full bg-vermilion motion-safe:animate-[engine-pulse_3s_ease-in-out_infinite]" />
      <svg viewBox="0 0 8 6" className="absolute bottom-0 h-[6px] w-2 -translate-x-1/2">
        <path d="M0 0 L4 6 L8 0" fill="none" stroke="#c8c5b8" strokeWidth="1.5" />
      </svg>
      {label ? (
        <span className="mono-label absolute left-1/2 top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap text-graphite/60 [font-size:9px]">
          {label}
        </span>
      ) : null}
    </div>
  );
}

function StageCard({
  step,
  title,
  note,
  children,
  delay,
  strong = false,
}: {
  step: string;
  title: string;
  note: string;
  children: React.ReactNode;
  delay: number;
  strong?: boolean;
}) {
  return (
    <Reveal delay={delay}>
      <div
        className={cn(
          "rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
          strong ? "border-vermilion/40" : "border-line"
        )}
      >
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="mono-label text-graphite">
            <span className="text-vermilion">{step}</span> · {title}
          </h3>
          <p className="hidden font-mono text-[10px] text-graphite/60 sm:block">{note}</p>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </Reveal>
  );
}

/** Hand-drawn AST for f(x) = x²·sin(x). */
function AstTree() {
  const node = (
    x: number,
    y: number,
    label: string,
    kind: "op" | "atom"
  ) => {
    const w = 36;
    return (
      <g key={`${x}-${y}-${label}`} transform={`translate(${x - w / 2}, ${y - 11})`}>
        <rect
          width={w}
          height={22}
          rx={6}
          fill={kind === "op" ? "#fdf4ef" : "#ffffff"}
          stroke={kind === "op" ? "#c2451d55" : "#e5e2d6"}
        />
        <text
          x={w / 2}
          y={15}
          textAnchor="middle"
          fontSize="11"
          fontFamily="ui-monospace, monospace"
          fill={kind === "op" ? "#c2451d" : "#1b1a16"}
        >
          {label}
        </text>
      </g>
    );
  };
  const edge = (x1: number, y1: number, x2: number, y2: number) => (
    <line
      key={`${x1}-${y1}-${x2}-${y2}`}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#c8c5b8"
      strokeWidth="1.5"
    />
  );
  return (
    <svg
      viewBox="0 0 260 132"
      className="mx-auto h-auto w-full max-w-[280px]"
      role="img"
      aria-label="Abstract syntax tree of x squared times sine of x: multiply node with children power of x and 2, and sine of x."
    >
      {edge(130, 29, 75, 55)}
      {edge(130, 29, 185, 55)}
      {edge(75, 73, 45, 97)}
      {edge(75, 73, 105, 97)}
      {edge(185, 73, 185, 97)}
      {node(130, 18, "·", "op")}
      {node(75, 62, "^", "op")}
      {node(185, 62, "sin", "op")}
      {node(45, 106, "x", "atom")}
      {node(105, 106, "2", "atom")}
      {node(185, 106, "x", "atom")}
    </svg>
  );
}

const TOKENS: Array<{ t: string; kind: "id" | "num" | "op" | "fn" }> = [
  { t: "x", kind: "id" },
  { t: "^", kind: "op" },
  { t: "2", kind: "num" },
  { t: "·", kind: "op" },
  { t: "sin", kind: "fn" },
  { t: "(", kind: "op" },
  { t: "x", kind: "id" },
  { t: ")", kind: "op" },
];

const TOKEN_STYLES: Record<string, string> = {
  id: "border-line text-ink",
  num: "border-amber/40 text-amber",
  op: "border-vermilion/40 text-vermilion",
  fn: "border-teal/50 text-teal",
};

export function EngineSection() {
  return (
    <section id="engine" className="relative border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="The core"
            title={
              <>
                One mathematical <em className="text-vermilion">engine.</em>
              </>
            }
            description="These are not nine isolated tools. Every workspace — from the calculator to the fractal renderer to the ODE solver — runs on a single shared mathematical core. One engine. No duplicates. No eval."
          />
        </Reveal>

        <div className="mx-auto mt-14 max-w-2xl">
          {/* Expression */}
          <StageCard step="00" title="EXPRESSION" note="input" delay={0}>
            <p className="math text-center text-2xl text-ink sm:text-[1.75rem]">
              f(x) = x<sup>2</sup> · sin(x)
            </p>
          </StageCard>

          <Connector label="lex" />

          {/* Lexer */}
          <StageCard step="01" title="LEXER" note="characters → tokens" delay={60}>
            <ul className="flex flex-wrap items-center justify-center gap-2" aria-label="Token stream">
              {TOKENS.map((tok, i) => (
                <li
                  key={`${tok.t}-${i}`}
                  className={cn(
                    "rounded-sm border bg-card px-2 py-1 font-mono text-xs",
                    TOKEN_STYLES[tok.kind]
                  )}
                >
                  {tok.t}
                </li>
              ))}
            </ul>
          </StageCard>

          <Connector label="parse" />

          {/* Parser */}
          <StageCard step="02" title="PARSER" note="tokens → syntax tree" delay={60}>
            <p className="text-center font-mono text-xs text-graphite">
              expr → term (("·" | "÷") term)*&nbsp;&nbsp;·&nbsp;&nbsp;term → factor ("^" factor)*
            </p>
          </StageCard>

          <Connector label="build" />

          {/* AST */}
          <StageCard step="03" title="AST" note="syntax tree" delay={60}>
            <AstTree />
          </StageCard>

          <Connector label="compile · evaluate" />

          {/* Engine */}
          <Reveal delay={60}>
            <div className="rounded-lg border-2 border-vermilion/50 bg-gradient-to-b from-vermilion-soft/60 to-card p-6 shadow-sm">
              <h3 className="text-center font-mono text-sm font-semibold tracking-[0.2em] text-ink">
                MATHEMATICAL ENGINE
              </h3>
              <ul
                className="mt-4 flex flex-wrap justify-center gap-2"
                aria-label="Engine operations applied to the tree"
              >
                {["evaluate", "differentiate", "solve", "compile → GLSL"].map((op) => (
                  <li
                    key={op}
                    className="rounded-sm border border-vermilion/30 bg-card px-2.5 py-1 font-mono text-[11px] text-vermilion"
                  >
                    {op}
                  </li>
                ))}
              </ul>
              <p className="math mt-4 text-center text-lg text-ink">
                f′(x) = 2x·sin(x) + x<sup>2</sup>·cos(x)
              </p>
            </div>
          </Reveal>

          <Connector label="runs everywhere" />

          {/* Workspaces */}
          <Reveal delay={60}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Workspaces powered by the engine">
              {workspaceMetadata.map((ws) => (
                <li key={ws.id} className="flex flex-col items-center">
                  <span aria-hidden="true" className="mb-1 h-2 w-px bg-line" />
                  <a
                    href="#workspaces"
                    className="focusable w-full rounded-sm border border-line bg-card px-3 py-2 text-center text-[13px] font-medium text-ink/80 transition-all hover:-translate-y-0.5 hover:border-ink/25 hover:text-ink"
                  >
                    {ws.name}
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Core index — specimen sheet of the engine's modules */}
        <Reveal delay={80}>
          <div className="mt-16 rounded-lg border border-line bg-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 className="mono-label text-graphite">Core index</h3>
              <p className="font-mono text-[10px] text-graphite/70">
                {engineCapabilities.length} modules · one implementation
              </p>
            </div>
            <ul className="grid gap-x-6 gap-y-2.5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
              {engineCapabilities.map((cap) => (
                <li key={cap} className="flex items-center gap-2.5 font-mono text-[11.5px] text-ink/75">
                  <span aria-hidden="true" className="inline-block size-[5px] shrink-0 bg-vermilion/70" />
                  {cap}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
