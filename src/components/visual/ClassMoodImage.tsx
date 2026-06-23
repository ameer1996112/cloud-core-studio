import {
  classImageFor,
  classMoods,
  DEFAULT_CLASS_IMAGE,
  localizedAlt,
  moodKeyFor,
  variantSrc,
  type ClassMoodKey,
  type ImageVariant,
} from "@/lib/image-assets";
import { getLocale } from "@/lib/i18n";
import type { ReactNode } from "react";

type Motif = ReturnType<() => (typeof classMoods)[ClassMoodKey]["motif"]>;

function Motif({ kind, color }: { kind: Motif; color: string }) {
  const common = { fill: "none", stroke: color, strokeWidth: 1.2, strokeLinecap: "round" as const };
  switch (kind) {
    case "cloud":
      return <path d="M30 70 q14 -22 36 -22 q8 -18 28 -18 q24 0 30 22 q20 0 24 18" {...common} />;
    case "wave":
      return <path d="M16 60 q20 -16 40 0 q20 16 40 0 q20 -16 40 0" {...common} />;
    case "moon":
      return <path d="M86 26 a30 30 0 1 0 24 48 a24 24 0 1 1 -24 -48z" {...common} />;
    case "sun":
      return (
        <g {...common}>
          <circle cx="80" cy="48" r="14" />
          <path d="M80 22 v8 M80 66 v8 M50 48 h8 M102 48 h8 M59 27 l5 5 M96 64 l5 5 M59 69 l5 -5 M96 32 l5 -5" />
        </g>
      );
    case "leaf":
      return <path d="M40 80 q20 -60 70 -50 q10 50 -50 70 q0 -30 30 -50" {...common} />;
    case "spark":
      return (
        <g {...common}>
          <path d="M80 20 v22 M80 60 v22 M40 51 h22 M98 51 h22" />
          <circle cx="80" cy="51" r="4" />
        </g>
      );
    case "kite":
      return <path d="M80 14 l28 32 l-28 36 l-28 -36z M80 82 v18" {...common} />;
    case "circle":
    default:
      return (
        <g {...common}>
          <circle cx="80" cy="50" r="26" />
          <circle cx="80" cy="50" r="14" opacity="0.6" />
        </g>
      );
  }
}

/**
 * ClassMoodImage — on-brand visual for a class card.
 *
 * Resolver order (matches member-facing image policy):
 *   1. `imageUrl`                 — explicit DB image (class.image_url or program_type.image_url)
 *   2. mapped photo by program-type name
 *   3. mapped photo by class title keyword
 *   4. DEFAULT_CLASS_IMAGE         — calm Core Balance photo
 *
 * The line-art motif fallback is only used when the caller opts out of
 * photos entirely via `useMotifFallback`.
 */
export function ClassMoodImage({
  title,
  programTypeName,
  imageUrl,
  variant = "card",
  imageFit,
  imagePosition,
  className = "",
  children,
  eager = false,
  useMotifFallback = false,
}: {
  title?: string | null;
  programTypeName?: string | null;
  imageUrl?: string | null;
  variant?: ImageVariant;
  imageFit?: "contain" | "cover";
  imagePosition?: string;
  className?: string;
  children?: ReactNode;
  eager?: boolean;
  useMotifFallback?: boolean;
}) {
  const key = moodKeyFor(title);
  const mood = classMoods[key];
  const matched = !imageUrl ? classImageFor([programTypeName ?? "", title ?? ""]) : null;
  const fallback = !imageUrl && !matched && !useMotifFallback ? DEFAULT_CLASS_IMAGE : null;
  const resolvedAsset = matched ?? fallback;
  const resolvedSrc = imageUrl ?? variantSrc(resolvedAsset, variant);
  const alt = resolvedAsset ? localizedAlt(resolvedAsset, getLocale()) : "";
  const fit = imageFit ?? resolvedAsset?.fit ?? "cover";
  const position = imagePosition ?? resolvedAsset?.position ?? "center center";
  const hasPositionClass = /\b(absolute|fixed|relative|sticky)\b/.test(className);
  return (
    <div
      className={`${hasPositionClass ? "" : "relative"} overflow-hidden ${className}`}
      style={{ background: mood.gradient }}
    >
      {resolvedSrc ? (
        <>
          {fit === "contain" && (
            <img
              src={resolvedSrc}
              alt=""
              aria-hidden="true"
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 z-0 h-full w-full object-cover scale-110 opacity-90 blur-2xl pointer-events-none select-none"
              style={{ objectPosition: position }}
              draggable={false}
            />
          )}
          <img
            src={resolvedSrc}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            className={`absolute inset-0 z-[1] h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
            style={{ objectPosition: position }}
            draggable={false}
          />
        </>
      ) : (
        <svg
          viewBox="0 0 160 100"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <Motif kind={mood.motif} color={mood.accent} />
        </svg>
      )}
      {children}
    </div>
  );
}

export { moodKeyFor };
