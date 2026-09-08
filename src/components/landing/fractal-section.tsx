import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { FractalDemo } from "@/components/math/fractal-demo";

/**
 * FRACTAL.LAB — the first "mathematical phenomenon" moment:
 * the page dims to a laboratory viewport and hands the user a real
 * escape-time explorer.
 */
export function FractalSection() {
  return (
    <section id="fractals" className="relative overflow-hidden bg-void text-cream">
      <div
        aria-hidden="true"
        className="graph-paper-dark graph-paper-vignette absolute inset-0"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            dark
            eyebrow="Fractal lab"
            title={
              <>
                Explore <em className="text-[#e0673d]">infinite complexity.</em>
              </>
            }
            description="Deterministic iteration, unbounded depth. Zoom into the Mandelbrot set, drag the Julia parameter, or watch Newton's method sort the plane into basins — every pixel is computed live in your browser."
          />
        </Reveal>
        <Reveal delay={100} className="mt-12">
          <FractalDemo />
        </Reveal>
      </div>
    </section>
  );
}
