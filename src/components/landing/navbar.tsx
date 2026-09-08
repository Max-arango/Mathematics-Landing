"use client";

import { useEffect, useState } from "react";
import { Menu, X, Github, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/landing/logo";
import { ThemeToggle } from "@/components/auth/theme-toggle";
import { AuthControls } from "@/components/auth/auth-controls";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Explore", href: "#play" },
  { label: "Features", href: "#features" },
  { label: "Workspaces", href: "#workspaces" },
  { label: "Open Source", href: "#open-source" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-paper/85 backdrop-blur-md transition-[border-color,box-shadow] duration-300",
        scrolled ? "border-line shadow-[0_1px_0_rgba(27,26,22,0.04)]" : "border-transparent"
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <a
          href="#top"
          className="focusable rounded-md transition-opacity hover:opacity-80"
          aria-label="Mathematics Simulator — back to top"
        >
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="focusable rounded-md px-3 py-2 text-sm font-medium text-graphite transition-colors hover:bg-secondary hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mathematics Simulator on GitHub"
            className="focusable hidden size-9 items-center justify-center rounded-md text-graphite transition-colors hover:bg-secondary hover:text-ink sm:inline-flex"
          >
            <Github className="size-[18px]" aria-hidden="true" />
          </a>
          <Button
            asChild
            size="sm"
            className="hidden font-semibold shadow-none lg:inline-flex"
          >
            <a
              href={SITE.url}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="navbar-simulator"
            >
              Open Simulator
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>

          <ThemeToggle />
          <AuthControls />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="focusable inline-flex size-9 items-center justify-center rounded-md text-ink transition-colors hover:bg-secondary md:hidden"
          >
            {open ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile navigation */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-line bg-paper md:hidden"
      >
        <ul className="mx-auto max-w-6xl space-y-1 px-4 py-4 sm:px-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="focusable block rounded-md px-3 py-2.5 text-[15px] font-medium text-ink transition-colors hover:bg-secondary"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="flex items-center gap-2 pt-2">
            <Button asChild className="flex-1 font-semibold shadow-none">
              <a
                href={SITE.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                Open Simulator
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="shadow-none"
              aria-label="GitHub repository"
            >
              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                <Github aria-hidden="true" />
              </a>
            </Button>
          </li>
        </ul>
      </div>
    </header>
  );
}
