import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { featureConcepts } from "@/data/features";

/**
 * "Built for mathematical exploration." — conceptual, not comparative.
 * Four ideas, editorially laid out; no feature-card clichés.
 */
export function WhySection() {
  return (
    <section id="features" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Why Mathematics Simulator"
            title={
              <>
                Built for mathematical{" "}
                <em className="text-vermilion">exploration.</em>
              </>
            }
            description="Not a calculator with extras bolted on. A single environment designed around the act of experimenting with mathematical structure."
          />
        </Reveal>

        <dl className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {featureConcepts.map((concept, i) => (
            <Reveal key={concept.id} delay={i * 80} className="bg-card">
              <div className="flex h-full flex-col p-6 transition-colors hover:bg-vermilion-soft/30">
                <div className="flex items-baseline justify-between">
                  <span className="math text-3xl text-vermilion" aria-hidden="true">
                    {concept.glyph}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-graphite/60">
                    {concept.index}
                  </span>
                </div>
                <dt className="mt-6 text-base font-semibold tracking-tight text-ink">
                  {concept.title}
                </dt>
                <dd className="mt-2.5 text-sm leading-relaxed text-graphite">
                  {concept.body}
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
