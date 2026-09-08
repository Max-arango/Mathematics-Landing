import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { WorkspaceVisual } from "@/components/math/workspace-visuals";
import { workspaceMetadata } from "@/data/workspaces";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * "Explore the mathematical universe" — the nine workspaces.
 * The mathematics does the visual work; copy stays minimal.
 * Each card opens the live simulator.
 */
export function WorkspacesSection() {
  return (
    <section id="workspaces" className="border-t border-line bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Workspaces"
            title={
              <>
                Explore the{" "}
                <em className="text-vermilion">mathematical universe.</em>
              </>
            }
            description="Nine workspaces, one shared core. Each card is a small, live piece of the mathematics inside."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {workspaceMetadata.map((ws, i) => {
            const dark = ws.id === "fractal_lab" || ws.id === "four_d";
            return (
              <Reveal key={ws.id} delay={(i % 3) * 70}>
                <a
                  href={SITE.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group focusable block overflow-hidden rounded-lg border border-line bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-lg"
                >
                  <div
                    className={cn(
                      "relative h-36 overflow-hidden border-b border-line",
                      dark ? "bg-void" : "bg-paper graph-paper-fine"
                    )}
                  >
                    <WorkspaceVisual id={ws.id} />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mono-label absolute right-3 top-2.5 rounded-sm px-1.5 py-0.5 [font-size:9px]",
                        dark
                          ? "bg-cream/10 text-cream/60"
                          : "bg-card/80 text-graphite/70"
                      )}
                    >
                      {String(ws.sortOrder).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                        {ws.name}
                      </h3>
                      <p className="mt-1 text-sm leading-snug text-graphite">
                        {ws.description}
                      </p>
                    </div>
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-graphite/70 transition-colors group-hover:text-vermilion">
                      Explore
                      <ArrowUpRight
                        className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </a>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
