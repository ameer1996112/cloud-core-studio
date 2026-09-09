/** Original, unmodified brand assets. Selection follows the application appearance. */
export function StudioLogo({
  className = "",
  inverse = false,
  priority = false,
}: {
  className?: string;
  inverse?: boolean;
  priority?: boolean;
}) {
  return (
    <span className={`studio-logo ${inverse ? "studio-logo-inverse" : ""} ${className}`}>
      <img
        className="studio-logo-light"
        src="/brand/Cloud_Core_logo_transparent_navy.png"
        srcSet="/brand/cloud-core-navy-320.webp 320w, /brand/cloud-core-navy-640.webp 640w"
        sizes="(min-width: 768px) 180px, 140px"
        fetchPriority={priority ? "high" : "auto"}
        alt="Cloud & Core"
        width={1152}
        height={726}
      />
      <img
        className="studio-logo-dark"
        src="/brand/Cloud_Core_logo_transparent_ivory.png"
        srcSet="/brand/cloud-core-ivory-320.webp 320w, /brand/cloud-core-ivory-640.webp 640w"
        sizes="(min-width: 768px) 180px, 140px"
        loading="lazy"
        fetchPriority="auto"
        alt="Cloud & Core"
        width={1152}
        height={726}
      />
    </span>
  );
}
