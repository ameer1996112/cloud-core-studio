import { emptyStateImages, localizedAlt, type ImageAsset } from "@/lib/image-assets";
import { getLocale } from "@/lib/i18n";

type Key = keyof typeof emptyStateImages;

/**
 * EmptyIllustration — thin line-art illustration for empty states.
 * Provide a registry key (e.g. "noBookings") or a custom asset.
 */
export function EmptyIllustration({
  name,
  asset,
  className = "",
  maxWidth = 280,
}: {
  name?: Key;
  asset?: ImageAsset;
  className?: string;
  maxWidth?: number;
}) {
  const a = asset ?? (name ? emptyStateImages[name] : undefined);
  if (!a) return null;
  const lang = (getLocale() || "he").split("-")[0];
  return (
    <img
      src={a.src}
      alt={localizedAlt(a, lang)}
      width={maxWidth}
      height={Math.round((maxWidth * 200) / 320)}
      loading="lazy"
      decoding="async"
      className={`mx-auto h-auto w-full ${className}`}
      style={{ maxWidth }}
      draggable={false}
    />
  );
}
