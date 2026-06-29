import { initialsFor } from "@/lib/image-assets";

type Size = "xs" | "sm" | "md" | "lg";
const SIZES: Record<Size, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

/**
 * InstructorAvatar — real photo when available, premium initials fallback.
 * Never renders a fake AI-generated face.
 */
export function InstructorAvatar({
  name,
  photoUrl,
  size = "sm",
  className = "",
  tone = "ivory",
}: {
  name?: string | null;
  photoUrl?: string | null;
  size?: Size;
  className?: string;
  tone?: "ivory" | "navy" | "sand";
}) {
  const initials = initialsFor(name);
  const toneCls =
    tone === "navy"
      ? "bg-navy text-ivory border-gold/40"
      : tone === "sand"
        ? "bg-sand text-navy border-gold/30"
        : "bg-ivory text-navy border-gold/40";
  const cls = `inline-flex items-center justify-center rounded-full border font-sans font-semibold ${toneCls} ${SIZES[size]} ${className}`;
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name ?? ""}
        loading="lazy"
        decoding="async"
        className={`${SIZES[size]} rounded-full object-cover border border-gold/40 ${className}`}
        draggable={false}
      />
    );
  }
  return (
    <span className={cls} aria-label={name ?? undefined} title={name ?? undefined}>
      {initials}
    </span>
  );
}

/** Member avatar — same shape, member-tone defaults. */
export function MemberAvatar(props: React.ComponentProps<typeof InstructorAvatar>) {
  return <InstructorAvatar tone="sand" {...props} />;
}
