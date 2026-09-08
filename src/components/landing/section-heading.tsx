import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  dark?: boolean;
  className?: string;
}

/**
 * Consistent section header: mono eyebrow with vermilion marker,
 * serif display title, muted description.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  dark = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      <div
        className={cn(
          "mono-label flex items-center gap-2.5",
          align === "center" && "justify-center",
          dark ? "text-cream/60" : "text-graphite"
        )}
      >
        <span
          aria-hidden="true"
          className="inline-block size-[7px] bg-vermilion"
        />
        {eyebrow}
      </div>
      <h2
        className={cn(
          "mt-4 font-display text-balance text-3xl leading-[1.06] tracking-tight text-ink sm:text-4xl lg:text-[2.8rem]",
          dark && "text-cream"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed sm:text-lg",
            dark ? "text-cream/70" : "text-graphite"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
