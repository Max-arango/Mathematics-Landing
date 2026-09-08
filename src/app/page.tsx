import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { EngineSection } from "@/components/landing/engine-section";
import { WorkspacesSection } from "@/components/landing/workspaces-section";
import { InteractiveSection } from "@/components/landing/interactive-section";
import { FractalSection } from "@/components/landing/fractal-section";
import { GeometrySection } from "@/components/landing/geometry-section";
import { DynamicsSection } from "@/components/landing/dynamics-section";
import { InspectorSection } from "@/components/landing/inspector-section";
import { NotebookSection } from "@/components/landing/notebook-section";
import { OpenSourceSection } from "@/components/landing/open-source-section";
import { WhySection } from "@/components/landing/why-section";
import { AdminSection } from "@/components/admin/admin-section";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

/**
 * Mathematics Simulator — landing.
 * One route, one narrative: a live mathematical exhibit from top to bottom.
 * Rhythm: paper → paper → paper → phenomenon (void) → paper → paper → …
 */
export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-paper"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Hero />
        <EngineSection />
        <WorkspacesSection />
        <InteractiveSection />
        <FractalSection />
        <GeometrySection />
        <DynamicsSection />
        <InspectorSection />
        <NotebookSection />
        <OpenSourceSection />
        <WhySection />
        <AdminSection />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
