import type { ReactNode } from "react";
import { studioImages, type ImageAsset } from "@/lib/image-assets";

/**
 * ImageBackdrop — subtle background image layer that keeps overlaid text legible.
 * Decorative by default (aria-hidden).
 */
export function ImageBackdrop({
  asset = studioImages.ivoryPaper,
  overlay = "linear-gradient(180deg, var(--cc-alpha-ivory-85), var(--cc-alpha-ivory-95))",
  className = "",
  children,
}: {
  asset?: ImageAsset;
  overlay?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <img
        src={asset.src}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: overlay }} />
      <div className="relative">{children}</div>
    </div>
  );
}
