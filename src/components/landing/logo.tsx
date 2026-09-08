import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

interface LogoProps {
  className?: string;
  /** show the wordmark next to the mark */
  wordmark?: boolean;
}

/**
 * Plot-mark logo: a framed sine curve over faint axes.
 * Theme-aware via currentColor (the wrapper sets text-ink, which follows
 * the light/dark CSS variables).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
      fill="none"
    >
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="7"
        strokeWidth="1.5"
        stroke="currentColor"
      />
      <line x1="8" y1="24" x2="26" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="8" y1="8" x2="8" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <path
        d="M8 19.5 C 10.5 19.5, 11 11, 14 11 S 16.5 24, 19.5 24 S 23 14, 26 14"
        stroke="#c2451d"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className, wordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <LogoMark />
      {wordmark && (
        <span className="text-[15px] font-semibold tracking-tight">{SITE.name}</span>
      )}
    </span>
  );
}
