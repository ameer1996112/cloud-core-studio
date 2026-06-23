import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { getLocale, t } from "@/lib/i18n";
import { ClassMoodImage } from "@/components/visual/ClassMoodImage";
import { resolveClassImageSrc, type ImageVariant } from "@/lib/image-assets";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedProgramName,
} from "@/lib/localized-content";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(getLocale(), { hour: "numeric", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(getLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ClassImage({
  cls,
  variant = "card",
  className = "",
  children,
  imageFit = "cover",
  imagePosition = "center center",
  eager = false,
}: {
  cls: any;
  variant?: ImageVariant;
  className?: string;
  children?: ReactNode;
  imageFit?: "contain" | "cover";
  imagePosition?: string;
  eager?: boolean;
}) {
  const title = localizedClassTitle(cls);
  return (
    <ClassMoodImage
      title={title}
      programTypeName={localizedProgramName(cls?.program_type)}
      imageUrl={resolveClassImageSrc(cls, variant)}
      variant={variant}
      imageFit={imageFit}
      imagePosition={imagePosition}
      eager={eager}
      className={className.includes("absolute") ? `!absolute ${className}` : className}
    >
      {children}
    </ClassMoodImage>
  );
}

export type ClassState =
  | { kind: "available"; spotsLeft: number }
  | { kind: "almost"; spotsLeft: number }
  | { kind: "full" }
  | { kind: "waitlist_available" }
  | { kind: "booked" }
  | { kind: "waiting"; position?: number }
  | { kind: "package_required" }
  | { kind: "low_credits" }
  | { kind: "closed" }
  | { kind: "cancelled" };

export function deriveClassState(
  cls: any,
  ctx: { booked: boolean; waiting: boolean; remainingCredits: number },
): ClassState {
  if (cls.status === "cancelled") return { kind: "cancelled" };
  if (cls.status !== "scheduled") return { kind: "closed" };
  if (ctx.booked) return { kind: "booked" };
  const spots = (cls.capacity ?? 0) - (cls.booked_count ?? 0);
  if (spots <= 0) return ctx.waiting ? { kind: "waiting" } : { kind: "waitlist_available" };
  if (ctx.remainingCredits < (cls.credit_cost ?? 1)) return { kind: "low_credits" };
  if (spots <= 2) return { kind: "almost", spotsLeft: spots };
  return { kind: "available", spotsLeft: spots };
}

export function StateBadge({ state }: { state: ClassState }) {
  const map: Record<string, { label: string; cls: string }> = {
    available: {
      label: t("state.available", { count: state.kind === "available" ? state.spotsLeft : "" }),
      cls: "bg-white/85 text-navy border-gold/40",
    },
    almost: {
      label: t("state.almost", { count: state.kind === "almost" ? state.spotsLeft : "" }),
      cls: "bg-gold/15 text-navy border-gold/60",
    },
    full: { label: t("state.full"), cls: "bg-navy/10 text-navy border-navy/20" },
    waitlist_available: {
      label: t("state.waitlist_available"),
      cls: "bg-powder/40 text-navy border-powder",
    },
    booked: { label: t("state.booked"), cls: "bg-navy text-ivory border-navy" },
    waiting: { label: t("state.waiting"), cls: "bg-powder/60 text-navy border-powder" },
    package_required: { label: t("state.package_required"), cls: "bg-sand text-navy border-sand" },
    low_credits: { label: t("state.low_credits"), cls: "bg-sand text-navy border-sand" },
    closed: { label: t("state.closed"), cls: "bg-navy/10 text-slate border-navy/20" },
    cancelled: { label: t("state.cancelled"), cls: "bg-navy/10 text-slate border-navy/20" },
  };
  const c = map[state.kind] ?? map.available;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase border rounded-full ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

export function PremiumClassCard({
  cls,
  state,
  onOpen,
}: {
  cls: any;
  state: ClassState;
  onOpen: () => void;
}) {
  const title = localizedClassTitle(cls);
  const instructor = localizedInstructorName(cls.instructor?.name);

  return (
    <button
      onClick={onOpen}
      className="member-card hover:member-card-hover text-left w-full overflow-hidden flex flex-col group"
    >
      <ClassImage cls={cls} className="member-class-media">
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          aria-hidden
          style={{
            background:
              "linear-gradient(0deg, rgba(11,29,58,0.78) 0%, rgba(11,29,58,0.28) 48%, rgba(11,29,58,0.08) 100%)",
          }}
        />
        <div className="absolute top-3 right-3 z-10">
          <StateBadge state={state} />
        </div>
        <div className="absolute bottom-3 left-4 right-4 z-10 text-ivory">
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-90">
            {formatDate(cls.starts_at)} · {formatTime(cls.starts_at)}
          </p>
          <p className="font-display text-2xl leading-tight mt-1 text-ivory drop-shadow-sm">
            {title}
          </p>
        </div>
      </ClassImage>
      <div className="px-4 py-3 flex items-center gap-3 text-xs text-slate">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-gold" />
          {cls.duration_minutes}
          {t("common.minutes")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-gold" />
          {cls.room_ref?.name ?? cls.room ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-gold" />
          {instructor}
        </span>
      </div>
    </button>
  );
}

export function MemberEmptyState({
  title,
  body,
  cta,
  illustration = "noBookings",
}: {
  title: string;
  body: string;
  cta?: { label: string; to: string };
  illustration?: "noBookings" | "noClasses" | "cloudCardEmpty" | "paymentEmpty" | null;
}) {
  return (
    <div
      className="member-card relative overflow-hidden px-6 py-8 sm:px-10 sm:py-12 text-center"
      style={{
        background: "linear-gradient(180deg, #F6F1E7 0%, #EDE4D2 100%)",
        borderColor: "color-mix(in oklab, var(--color-gold, #C9A24B) 35%, transparent)",
      }}
    >
      {/* subtle gold hairline accent */}
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gold/40" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gold/25"
      />

      {illustration && (
        <div className="premium-cloud-mark mx-auto mb-6" aria-hidden="true">
          <span className="premium-cloud-mark__ring" />
          <svg
            viewBox="0 0 64 64"
            className="premium-cloud-mark__glyph"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              className="premium-cloud-mark__shadow"
              d="M18.5 37.5h27c5 0 9-3.5 9-8.3 0-4.7-3.7-8.4-8.4-8.4-1 0-2 .2-2.9.5-2.4-6.3-8-10.3-14.8-10.3-7.4 0-13.8 5.2-15.3 12.3-4.6.7-8 4.4-8 8.9 0 4.8 4.1 8.3 9.4 8.3h4"
            />
            <path
              className="premium-cloud-mark__cloud"
              d="M18.5 34.5h27c5 0 9-3.5 9-8.3 0-4.7-3.7-8.4-8.4-8.4-1 0-2 .2-2.9.5C40.8 12 35.2 8 28.4 8 21 8 14.6 13.2 13.1 20.3c-4.6.7-8 4.4-8 8.9 0 4.8 4.1 8.3 9.4 8.3h4"
            />
            <path className="premium-cloud-mark__line" d="M21 45h22" />
            <path
              className="premium-cloud-mark__line premium-cloud-mark__line--soft"
              d="M25 51h14"
            />
          </svg>
        </div>
      )}

      <p className="font-display text-2xl sm:text-[26px] text-navy leading-snug">{title}</p>
      <p className="text-sm text-slate mt-2 leading-relaxed max-w-sm mx-auto">{body}</p>
      {cta && (
        <Link to={cta.to} className="btn-navy hover:btn-navy-hover mt-6 inline-flex">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function formatRelative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t("common.today");
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

export { formatTime, formatDate };
