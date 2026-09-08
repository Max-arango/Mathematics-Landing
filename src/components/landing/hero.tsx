import { ArrowDown, ArrowUpRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroVisualization } from "@/components/math/hero-visualization";
import { Reveal } from "@/components/landing/reveal";
import { SITE } from "@/lib/site";

const CAPABILITY_CHIPS = [
  "symbolic differentiation",
  "ODE solvers",
  "linear algebra",
  "AST → GLSL",
  "GPU fractals",
] as const;

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="graph-paper graph-paper-vignette absolute inset-0"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_1fr] lg:gap-14">
          {/* Copy */}
          <div>
            <Reveal>
              <p className="mono-label flex items-center gap-2.5 text-graphite">
                <span aria-hidden="true" className="inline-block size-[7px] bg-vermilion" />
                Open-source mathematical exploration
              </p>
            </Reveal>

            <Reveal delay={70}>
              <h1 className="mt-6 font-display text-balance text-[2.75rem] leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-[4.3rem]">
                Explore mathematics{" "}
                <em className="text-vermilion">beyond the graph.</em>
              </h1>
            </Reveal>

            <Reveal delay={140}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-graphite sm:text-lg">
                A laboratory for functions, fractals, dynamical systems,
                topology and higher-dimensional geometry — built on one shared
                mathematical core, where every object is something you can
                manipulate.
              </p>
            </Reveal>

            <Reveal delay={210}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="font-semibold shadow-none">
                  <a
                    href={SITE.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cta="hero-simulator"
                  >
                    Open Simulator
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="font-semibold shadow-none"
                >
                  <a
                    href={SITE.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cta="hero-github"
                  >
                    <Github aria-hidden="true" />
                    Explore on GitHub
                  </a>
                </Button>
                <a
                  href="#play"
                  className="focusable group ml-1 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-ink underline decoration-vermilion/50 decoration-1 underline-offset-4 transition-colors hover:decoration-vermilion"
                >
                  Explore the mathematics
                  <ArrowDown
                    className="size-3.5 text-vermilion transition-transform group-hover:translate-y-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </Reveal>

            <Reveal delay={280}>
              <div className="mt-10 border-t border-line pt-6">
                <p className="sr-only">
                  Capabilities of the shared mathematical core.
                </p>
                <ul className="flex flex-wrap gap-2" aria-label="Core capabilities">
                  {CAPABILITY_CHIPS.map((chip) => (
                    <li
                      key={chip}
                      className="rounded-sm border border-line bg-card/70 px-2.5 py-1 font-mono text-[11px] text-graphite"
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
                <p className="mono-label mt-4 text-graphite/60">
                  one engine · no duplicates · no eval
                </p>
              </div>
            </Reveal>
          </div>

          {/* Live exhibit */}
          <Reveal delay={120} className="w-full">
            <HeroVisualization />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
