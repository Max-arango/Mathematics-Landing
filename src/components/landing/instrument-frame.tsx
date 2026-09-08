import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InstrumentFrameProps {
  /** mono label, e.g. "SURFACE.PLOT" */
  label: string;
  /** right-aligned mono meta, e.g. live readouts */
  meta?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dark?: boolean;
  className?: string;
  bodyClassName?: string;
  /** hide the pulsing "live" marker (static exhibits) */
  static?: boolean;
}

/**
 * Chrome shared by every live demo on the page — reads like a lab instrument:
 * a header rail with a mono label + status marker, the viewport, an optional
 * footer rail with readouts.
 */
export function InstrumentFrame({
  label,
  meta,
  children,
  footer,
  dark = false,
  className,
  bodyClassName,
  static: isStatic = false,
}: InstrumentFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-sm",
        dark ? "border-cream/15 bg-void-soft" : "border-line bg-card",
        className
      )}
    >
      <div
        className={cn(
          "flex min-h-10 items-center justify-between gap-4 border-b px-4 py-2",
          dark ? "border-cream/10" : "border-line"
        )}
      >
        <div
          className={cn(
            "mono-label flex items-center gap-2.5",
            dark ? "text-cream/70" : "text-graphite"
          )}
        >
          {!isStatic && (
            <span
              aria-hidden="true"
              className="relative flex size-[7px]"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vermilion opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-[7px] rounded-full bg-vermilion" />
            </span>
          )}
          {isStatic && (
            <span aria-hidden="true" className="inline-block size-[7px] bg-vermilion/60" />
          )}
          <span className="truncate">{label}</span>
        </div>
        {meta ? (
          <div
            className={cn(
              "mono-label shrink-0 tabular-nums",
              dark ? "text-cream/50" : "text-graphite/80"
            )}
          >
            {meta}
          </div>
        ) : null}
      </div>
      <div className={cn("relative", bodyClassName)}>{children}</div>
      {footer ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t px-4 py-2 font-mono text-[11px] tabular-nums",
            dark ? "border-cream/10 text-cream/50" : "border-line text-graphite/80"
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
