import type { ImgHTMLAttributes } from "react";
import { localizedAlt, type ImageAsset } from "@/lib/image-assets";
import { getLocale } from "@/lib/i18n";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  asset?: ImageAsset;
  src?: string;
  alt?: string;
  aspect?: string; // e.g. "16/9", "1/1"
  eager?: boolean;
  decorative?: boolean;
  rounded?: string; // tailwind class fragment
};

/**
 * ResponsiveImage — stable aspect-ratio box, lazy by default, no layout shift.
 * Pass an `asset` from the registry for localized alt, or a raw `src` + `alt`.
 */
export function ResponsiveImage({
  asset,
  src,
  alt,
  aspect = "16/9",
  eager,
  decorative,
  rounded = "",
  className = "",
  ...rest
}: Props) {
  const lang = (getLocale() || "he").split("-")[0];
  const resolvedSrc = asset?.src ?? src ?? "";
  const resolvedAlt = decorative ? "" : (alt ?? (asset ? localizedAlt(asset, lang) : ""));
  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ aspectRatio: aspect }}
      aria-hidden={decorative ? true : undefined}
    >
      {resolvedSrc && (
        <img
          {...rest}
          src={resolvedSrc}
          alt={resolvedAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      )}
    </div>
  );
}
