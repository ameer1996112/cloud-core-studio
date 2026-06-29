import type { ReactNode } from "react";
import { studioImages } from "@/lib/image-assets";

/**
 * CloudCardVisual — premium booking-confirmation card visual layer.
 * Soft cloud line-art on navy or ivory, gold hairline.
 */
export function CloudCardVisual({
  variant = "navy",
  className = "",
  children,
}: {
  variant?: "navy" | "ivory";
  className?: string;
  children?: ReactNode;
}) {
  const bg = variant === "navy" ? "bg-navy text-ivory" : "bg-ivory text-navy";
  const texture =
    variant === "navy" ? studioImages.brandBannerNavy.src : studioImages.ivoryPaper.src;
  return (
    <div
      className={`relative overflow-hidden rounded-[6px] border border-gold/40 ${bg} ${className}`}
    >
      <img
        src={texture}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
        loading="lazy"
        decoding="async"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}
