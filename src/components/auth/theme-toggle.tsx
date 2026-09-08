"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Dark-mode toggle. Cycles light ⇄ dark (the system preference is the
 * default until the user picks explicitly).
 *
 * The two icons are swapped purely with CSS (`dark:` variants), so the
 * server markup and the hydrated markup are identical — no mounting state,
 * no hydration mismatch. `resolvedTheme` is only read inside the click
 * handler, after hydration.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Cambiar tema claro u oscuro"
      title="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="size-9 rounded-md border-transparent bg-transparent text-graphite shadow-none transition-colors hover:border-line hover:bg-secondary hover:text-ink"
    >
      <Sun className="hidden size-[18px] dark:block" aria-hidden="true" />
      <Moon className="size-[18px] dark:hidden" aria-hidden="true" />
    </Button>
  );
}
