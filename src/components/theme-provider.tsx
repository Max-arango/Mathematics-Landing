"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Class-based theming (`.dark` on <html>) with system preference detection.
 * The palette flip is fully defined in globals.css (:root / .dark tokens).
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="ms-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
