import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { NotebookDemo } from "@/components/math/notebook-demo";

/**
 * NOTEBOOK — "Think. Experiment. Recompute."
 * The UI is the causality: parameters flow down through cells.
 */
export function NotebookSection() {
  return (
    <section id="notebook" className="border-t border-line bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Notebook"
            title={
              <>
                Think. Experiment. <em className="text-vermilion">Recompute.</em>
              </>
            }
            description="A notebook run is a snapshot: parameters flow into expressions, expressions into graphs, graphs into analysis. Deterministic, inspectable, reproducible — move a slider and watch the dependency chain react."
          />
        </Reveal>
        <Reveal delay={100} className="mt-12">
          <NotebookDemo />
        </Reveal>
      </div>
    </section>
  );
}
