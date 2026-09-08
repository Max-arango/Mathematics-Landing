import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { DynamicsDemo } from "@/components/math/dynamics-demo";

/**
 * Dynamics — a scientific-figure moment on paper:
 * vector field, trajectories, equilibrium, all live.
 */
export function DynamicsSection() {
  return (
    <section id="dynamics" className="border-t border-line bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Dynamics"
            title={
              <>
                Mathematics, <em className="text-vermilion">in motion.</em>
              </>
            }
            description="A phase portrait is the complete biography of a differential equation. Drag anywhere to drop a seed and watch the flow decide where it goes — at μ = 0 this is exactly ẋ = y, ẏ = −x."
          />
        </Reveal>
        <Reveal delay={100} className="mt-12">
          <DynamicsDemo />
        </Reveal>
      </div>
    </section>
  );
}
