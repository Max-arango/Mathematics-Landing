import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { InspectorDemo } from "@/components/math/inspector-demo";

/**
 * INSPECTOR — "Look inside the mathematics."
 * The project doesn't just plot; it interrogates structure.
 */
export function InspectorSection() {
  return (
    <section id="inspector" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Inspector"
            title={
              <>
                Look <em className="text-vermilion">inside</em> the mathematics.
              </>
            }
            description="An expression is not a string — it is a structure. Traverse its syntax tree, differentiate it, find where it turns. This is the analytical half of the engine: roots, gradients, critical points."
          />
        </Reveal>
        <Reveal delay={100} className="mt-12">
          <InspectorDemo />
        </Reveal>
      </div>
    </section>
  );
}
