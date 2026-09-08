import { Github, ArrowUpRight, BookOpen } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { SITE } from "@/lib/site";

const PROJECT_LINKS = [
  { label: "GitHub", href: SITE.github, external: true, icon: Github },
  { label: "Simulator", href: SITE.url, external: true, icon: ArrowUpRight },
  { label: "Docs", href: SITE.github, external: true, icon: BookOpen },
] as const;

const PAGE_LINKS = [
  { label: "Workspaces", href: "#workspaces" },
  { label: "Fractal Lab", href: "#fractals" },
  { label: "Dynamics", href: "#dynamics" },
  { label: "Inspector", href: "#inspector" },
  { label: "Notebook", href: "#notebook" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 py-12 md:grid-cols-[1.5fr,1fr,1fr] md:gap-8">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-graphite">
              {SITE.tagline} Functions, fractals, geometry, topology, dynamics —
              one shared mathematical core.
            </p>
            <p className="mono-label mt-5 text-graphite/70">
              one engine · no duplicates · no eval
            </p>
          </div>

          <nav aria-label="Project links">
            <h3 className="mono-label text-graphite">Project</h3>
            <ul className="mt-4 space-y-2.5">
              {PROJECT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="focusable inline-flex items-center gap-2 rounded-sm text-sm font-medium text-ink/80 transition-colors hover:text-vermilion"
                  >
                    <link.icon className="size-3.5 text-graphite" aria-hidden="true" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Page sections">
            <h3 className="mono-label text-graphite">Sections</h3>
            <ul className="mt-4 space-y-2.5">
              {PAGE_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="focusable rounded-sm text-sm font-medium text-ink/80 transition-colors hover:text-vermilion"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-line/70 py-6 pb-8 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] tabular-nums text-graphite">
            © {year} {SITE.name} · {SITE.license} License
          </p>
          <p className="mono-label text-graphite/70">
            Built for exploring mathematics.
          </p>
        </div>
      </div>
    </footer>
  );
}
