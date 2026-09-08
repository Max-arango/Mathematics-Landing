import { ArrowUpRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";
import { SITE } from "@/lib/site";

/**
 * Final CTA — the closing "phenomenon": the page dims once more,
 * a faint parametric curve drifts behind the invitation.
 */
export function FinalCta() {
  return (
    <section id="start" className="relative overflow-hidden bg-void text-cream">
      <div aria-hidden="true" className="graph-paper-dark absolute inset-0 opacity-70" />
      {/* faint Lissajous backdrop */}
      <svg
        aria-hidden="true"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full text-cream/[0.06]"
      >
        <path
          d="M0 200 C 90 200 70 40 160 40 S 250 360 340 360 S 430 40 520 40 S 610 360 700 360 S 780 200 800 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M0 200 C 90 200 70 360 160 360 S 250 40 340 40 S 430 360 520 360 S 610 40 700 40 S 780 200 800 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>

      <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <Reveal>
          <p className="mono-label text-cream/50">Begin</p>
          <h2 className="mt-5 font-display text-balance text-5xl leading-[1.02] tracking-tight text-cream sm:text-6xl lg:text-7xl">
            Start <em className="text-[#e0673d]">exploring.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-cream/70 sm:text-lg">
            Functions, fractals, geometry, topology, dynamics — and the
            structures between them.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-11 bg-[#c2451d] px-7 text-[15px] font-semibold text-[#fdf9f4] shadow-none hover:bg-[#d0522a]"
            >
              <a
                href={SITE.url}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="final-simulator"
              >
                Open Mathematics Simulator
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 border-cream/25 bg-transparent px-7 text-[15px] font-semibold text-cream shadow-none hover:bg-cream/10 hover:text-cream"
            >
              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="final-github"
              >
                <Github aria-hidden="true" />
                View source on GitHub
              </a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
