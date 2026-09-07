/** Approved full lockups, used without filters, cropping, or reconstructed lettering. */
export function StudioLogo({
  className = "",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <picture className={`studio-logo ${className}`}>
      <source
        media={inverse ? undefined : "(prefers-color-scheme: dark)"}
        srcSet="/brand/Cloud_Core_logo_transparent_ivory.png"
      />
      <img
        src={`/brand/Cloud_Core_logo_transparent_${inverse ? "ivory" : "navy"}.png`}
        alt="Cloud & Core"
        width={1152}
        height={726}
      />
    </picture>
  );
}
