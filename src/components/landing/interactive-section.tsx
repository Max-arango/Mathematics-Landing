import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { FunctionDemo } from "@/components/math/function-demo";

/**
 * "Mathematics you can manipulate" — the Desmos-philosophy moment:
 * a real parameter-driven experiment, not a mockup.
 */
export function InteractiveSection() {
  return (
    <section id="play" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Interactive mathematics"
            title={
              <>
                Mathematics you can{" "}
                <em className="text-vermilion">manipulate.</em>
              </>
            }
            description="Change a parameter, watch the consequence. This is a live experiment — the curve, the formula, the derivative and the tangent probe all recompute as you move the controls."
          />
        </Reveal>
        <Reveal delay={100} className="mt-12">
          <FunctionDemo />
        </Reveal>
      </div>
    </section>
  );
}
