import { Reveal } from "@/components/landing/reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { GeometryDemo } from "@/components/math/geometry-demo";

/**
 * "From shapes you can see, to spaces you cannot."
 * A dimension ladder leads into the live geometry viewport.
 */

const LADDER = [
  { d: "0", label: "point" },
  { d: "1", label: "line" },
  { d: "2", label: "square" },
  { d: "3", label: "cube" },
  { d: "4", label: "tesseract" },
] as const;

function LadderGlyph({ index }: { index: number }) {
  const stroke = index === 4 ? "#c2451d" : "#1b1a16";
  const dim = index < 4 ? 0.35 : 1;
  switch (index) {
    case 0:
      return <circle cx="16" cy="16" r="3" fill={stroke} opacity={dim} />;
    case 1:
      return <line x1="5" y1="16" x2="27" y2="16" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" opacity={dim} />;
    case 2:
      return <rect x="6" y="6" width="20" height="20" rx="1" fill="none" stroke={stroke} strokeWidth="2" opacity={dim} />;
    case 3:
      return (
        <g opacity={dim}>
          <path d="M9 20 V10 l7 -4 7 4 v10 l-7 4 z" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 10 l7 4 7 -4 M16 14 v10" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.55" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="4" y="8" width="14" height="14" fill="none" stroke={stroke} strokeWidth="1.6" opacity="0.9" />
          <rect x="11" y="14" width="14" height="14" fill="none" stroke={stroke} strokeWidth="1.6" opacity="0.45" />
          <path d="M4 8 L11 14 M18 8 L25 14 M4 22 L11 28 M18 22 L25 28" stroke={stroke} strokeWidth="1.1" opacity="0.6" />
        </g>
      );
  }
}

function DimensionLadder() {
  return (
    <ol
      className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-4 sm:gap-x-3"
      aria-label="Dimension ladder from 0D point to 4D tesseract"
    >
      {LADDER.map((item, i) => (
        <li key={item.d} className="flex items-center gap-2 sm:gap-3">
          <div className="group flex w-[76px] flex-col items-center gap-1.5">
            <div className="flex h-8 items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <svg viewBox="0 0 30 30" className="h-7 w-7" aria-hidden="true">
                <LadderGlyph index={i} />
              </svg>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-graphite">
              <span className="text-ink font-semibold">D={item.d}</span> {item.label}
            </span>
          </div>
          {i < LADDER.length - 1 && (
            <span aria-hidden="true" className="text-graphite/50">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function GeometrySection() {
  return (
    <section id="geometry" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Geometry & dimensions"
            title={
              <>
                From shapes you can see,
                <br />
                <em className="text-vermilion">to spaces you cannot.</em>
              </>
            }
            description="A sphere fits in your hand. A tesseract never will — but its shadow can be computed. Projection is how mathematics lets you look at what your eyes cannot."
          />
        </Reveal>

        <Reveal delay={80}>
          <DimensionLadder />
        </Reveal>

        <Reveal delay={120} className="mt-12">
          <GeometryDemo />
        </Reveal>
      </div>
    </section>
  );
}
