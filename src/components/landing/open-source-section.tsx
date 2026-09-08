import { ArrowUpRight, GitBranch, Github, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { stackChips } from "@/data/workspaces";
import { SITE } from "@/lib/site";

/**
 * Open source — honest: MIT, contributions welcome, active development.
 * No fabricated stars/forks/contributors; the only static facts are
 * license + stack, both taken from the repository README.
 */

const FACTS = [
  {
    icon: Github,
    title: "Open source",
    body: "The full source is public — engine, workspaces, and everything between.",
  },
  {
    icon: TerminalSquare,
    title: "MIT licensed",
    body: "Use it, study it, modify it. Mathematics should not be locked away.",
  },
  {
    icon: GitBranch,
    title: "Active development",
    body: "The project evolves continuously; contributions and ideas are welcome.",
  },
] as const;

/** Small decorative commit-graph — abstract, no invented data. */
function CommitGraph() {
  const nodes: Array<[number, number]> = [];
  const edges: Array<[[number, number], [number, number]]> = [];
  const xs = [0, 1, 2, 3, 4];
  const lanes = [0, 1, 0, 2, 1];
  xs.forEach((x, i) => nodes.push([x, lanes[i]]));
  for (let i = 1; i < nodes.length; i++) {
    edges.push([nodes[i - 1], nodes[i]]);
  }
  const px = (n: [number, number]) => [n[0] * 22 + 6, n[1] * 16 + 8] as const;
  return (
    <svg
      viewBox="0 0 120 56"
      className="h-14 w-auto text-ink/25"
      aria-hidden="true"
    >
      {edges.map((e, i) => {
        const [x1, y1] = px(e[0]);
        const [x2, y2] = px(e[1]);
        return (
          <path
            key={i}
            d={`M${x1} ${y1} C ${x1 + 10} ${y1}, ${x2 - 10} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        );
      })}
      {nodes.map((n, i) => {
        const [x, y] = px(n);
        return (
          <circle key={i} cx={x} cy={y} r="3.2" fill={i === nodes.length - 1 ? "#c2451d" : "currentColor"} />
        );
      })}
    </svg>
  );
}

export function OpenSourceSection() {
  return (
    <section id="open-source" className="relative overflow-hidden border-t border-line bg-paper">
      <div aria-hidden="true" className="graph-paper graph-paper-vignette absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionHeading
                eyebrow="Open source"
                title={
                  <>
                    Mathematics should be{" "}
                    <em className="text-vermilion">explorable.</em>
                  </>
                }
                description="Mathematics Simulator is developed in the open, under an MIT license. Inspect the engine, extend a workspace, or fix a bug — the repository is the documentation."
              />
            </Reveal>

            <Reveal delay={100}>
              <ul className="mt-10 space-y-6">
                {FACTS.map((fact) => (
                  <li key={fact.title} className="flex gap-4">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-card text-graphite">
                      <fact.icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                        {fact.title}
                      </h3>
                      <p className="mt-1 max-w-md text-sm leading-relaxed text-graphite">
                        {fact.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={180}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" variant="outline" className="font-semibold shadow-none">
                  <a href={SITE.github} target="_blank" rel="noopener noreferrer" data-cta="opensource-github">
                    <Github aria-hidden="true" />
                    View on GitHub
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </Button>
                <span className="rounded-sm border border-line bg-card px-2.5 py-1 font-mono text-[11px] text-graphite">
                  MIT License
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={140}>
            <div className="rounded-xl border border-line bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between">
                <h3 className="mono-label text-graphite">Built with</h3>
                <CommitGraph />
              </div>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Technology stack">
                {stackChips.map((chip) => (
                  <li
                    key={chip}
                    className="rounded-sm border border-line bg-paper px-2.5 py-1 font-mono text-[11.5px] text-ink/80"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-line pt-5 font-mono text-[11px] leading-relaxed text-graphite/70">
                {/* easter egg */}
                <span className="text-ink/60">$</span> git clone
                https://github.com/Max-arango/Mathematics-simulator.git
                <br />
                <span className="text-ink/60">$</span> cd
                Mathematics-simulator &&{" "}
                <span className="text-vermilion">npm i && npm run dev</span>
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
