import { ReviewButton, ReviewSurface } from "@/components/member/design/VisualSystem";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getLocale, t, useI18n } from "@/lib/i18n";
import { ClassMoodImage } from "@/components/visual/ClassMoodImage";
import {
  emptyStateImages,
  resolveClassImageSrc,
  type ClassImageSource,
  type ImageVariant,
} from "@/lib/image-assets";
import { EmptyIllustration } from "@/components/visual/EmptyIllustration";
import {
  localizedClassTitle,
  localizedOptionalInstructorName,
  localizedProgramName,
} from "@/lib/localized-content";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(getLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDurationLabel(minutes: number) {
  return t("member.durationMinutes", { count: minutes });
}

export type PremiumClassCardClass = ClassImageSource & {
  starts_at: string;
  duration_minutes: number;
  capacity?: number | null;
  booked_count?: number | null;
  credit_cost?: number | null;
  cancellation_window_hours?: number | null;
  status?: string | null;
  instructor?: { name?: string | null } | null;
};

export function ClassImage({
  cls,
  variant = "card",
  className = "",
  children,
  imageFit = "cover",
  imagePosition = "center center",
  eager = false,
}: {
  cls: ClassImageSource | null | undefined;
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
  cls: PremiumClassCardClass,
  ctx: {
    booked: boolean;
    waiting: boolean;
    remainingCredits: number;
    hasActivePackage?: boolean | null;
  },
): ClassState {
  if (cls.status === "cancelled") return { kind: "cancelled" };
  if (cls.status !== "scheduled") return { kind: "closed" };
  if (ctx.booked) return { kind: "booked" };
  const spots = (cls.capacity ?? 0) - (cls.booked_count ?? 0);
  if (spots <= 0) return ctx.waiting ? { kind: "waiting" } : { kind: "waitlist_available" };
  if (ctx.remainingCredits < (cls.credit_cost ?? 1)) {
    if (ctx.hasActivePackage === false) return { kind: "package_required" };
    return { kind: "low_credits" };
  }
  if (spots <= 2) return { kind: "almost", spotsLeft: spots };
  return { kind: "available", spotsLeft: spots };
}

export function StateBadge({ state }: { state: ClassState }) {
  const map: Record<string, { label: string; cls: string }> = {
    available: {
      label: t("schedule.availability.open"),
      cls: "bg-card text-navy border-gold/40",
    },
    almost: {
      label: t("schedule.availability.few"),
      cls: "bg-gold/15 text-navy border-gold/60",
    },
    full: { label: t("state.full"), cls: "bg-navy/10 text-navy border-navy/20" },
    waitlist_available: {
      label: t("schedule.availability.waitlist"),
      cls: "bg-powder/40 text-navy border-powder",
    },
    booked: { label: t("bookings.confirmed"), cls: "bg-navy text-ivory border-navy" },
    waiting: { label: t("bookings.waitlisted"), cls: "bg-powder/60 text-navy border-powder" },
    package_required: { label: t("state.package_required"), cls: "bg-sand text-navy border-sand" },
    low_credits: { label: t("state.low_credits"), cls: "bg-sand text-navy border-sand" },
    closed: { label: t("state.closed"), cls: "bg-navy/10 text-slate border-navy/20" },
    cancelled: { label: t("state.cancelled"), cls: "bg-navy/10 text-slate border-navy/20" },
  };
  const c = map[state.kind] ?? map.available;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

export function PremiumLogoMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-2 ${className}`}
      aria-label="Cloud & Core Logo"
    >
      <h2 dir="ltr" className="premium-logo-wordmark">
        Cloud &amp; Core
      </h2>
      <div className="flex items-center gap-2 mt-3">
        <div className="premium-logo-rule w-12 sm:w-16"></div>
        <div className="premium-logo-dot rounded-full"></div>
        <div className="premium-logo-rule w-12 sm:w-16"></div>
      </div>
      <div className="premium-logo-divider mt-2 w-36 sm:w-48"></div>
    </div>
  );
}

export type MemberEmptyStateVariant =
  | "bookings"
  | "schedule"
  | "packages"
  | "payments"
  | "profile"
  | "cloudCard";

type MemberEmptyStateTone = "ivory" | "sand" | "powder";
type MemberEmptyStateAction = { label: string; to?: string; onClick?: () => void };
type MemberEmptyStateIllustration =
  | keyof typeof emptyStateImages
  | "cloudCardPreview"
  | ReactNode
  | null;
type MemberEmptyTextField = "eyebrow" | "title" | "body";

const defaultEmptyIllustration: Record<MemberEmptyStateVariant, MemberEmptyStateIllustration> = {
  bookings: "cloudCardPreview",
  schedule: "noClasses",
  packages: "paymentEmpty",
  payments: "paymentEmpty",
  profile: "cloudCardEmpty",
  cloudCard: "cloudCardPreview",
};

const defaultEmptyTone: Record<MemberEmptyStateVariant, MemberEmptyStateTone> = {
  bookings: "ivory",
  schedule: "sand",
  packages: "ivory",
  payments: "ivory",
  profile: "powder",
  cloudCard: "ivory",
};

const defaultEmptyTextKeys = {
  bookings: {
    eyebrow: "member.empty.bookings.eyebrow",
    title: "member.empty.bookings.title",
    body: "member.empty.bookings.body",
  },
  schedule: {
    eyebrow: "member.empty.schedule.eyebrow",
    title: "member.empty.schedule.title",
    body: "member.empty.schedule.body",
  },
  packages: {
    eyebrow: "member.empty.packages.eyebrow",
    title: "member.empty.packages.title",
    body: "member.empty.packages.body",
  },
  payments: {
    eyebrow: "member.empty.payments.eyebrow",
    title: "member.empty.payments.title",
    body: "member.empty.payments.body",
  },
  profile: {
    eyebrow: "member.empty.profile.eyebrow",
    title: "member.empty.profile.title",
    body: "member.empty.profile.body",
  },
  cloudCard: {
    eyebrow: "member.empty.bookings.eyebrow",
    title: "member.empty.bookings.title",
    body: "member.empty.bookings.body",
  },
} as const satisfies Record<
  MemberEmptyStateVariant,
  Record<MemberEmptyTextField, Parameters<typeof t>[0]>
>;

function defaultEmptyTextKey(variant: MemberEmptyStateVariant, field: MemberEmptyTextField) {
  return defaultEmptyTextKeys[variant][field];
}

function EmptyAction({
  action,
  variant,
}: {
  action: MemberEmptyStateAction;
  variant: "primary" | "secondary";
}) {
  const className =
    variant === "primary" ? "cc-button cc-button--primary" : "cc-button cc-button--secondary";
  if (action.to) {
    return (
      <Link to={action.to} className={className}>
        {action.label}
      </Link>
    );
  }
  if (!action.onClick) return null;
  return (
    <ReviewButton variant={variant} type="button" onClick={action.onClick}>
      {action.label}
    </ReviewButton>
  );
}

function MemberEmptyVisual({
  illustration,
  variant,
}: {
  illustration: MemberEmptyStateIllustration;
  variant: MemberEmptyStateVariant;
}) {
  if (!illustration) return null;
  if (illustration === "cloudCardPreview") {
    return (
      <div className="member-empty-cloud-card" aria-hidden="true">
        <div className="member-empty-cloud-mark">
          <svg viewBox="0 0 64 34" role="img" aria-hidden="true">
            <path
              d="M9.4 29h44.8c4.2 0 7.6-3.3 7.6-7.4s-3.4-7.4-7.6-7.4c-1.4 0-2.8.4-3.9 1.1C48.2 7.2 40.7 2 32 2 24.4 2 17.8 6 14.8 12 7.7 12.3 2.2 17.8 2.2 24.5 2.2 27 5.4 29 9.4 29Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="member-empty-card-lines">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  if (typeof illustration === "string") {
    return (
      <div className="member-empty-illustration" aria-hidden="true">
        <EmptyIllustration
          name={illustration as keyof typeof emptyStateImages}
          className={variant === "schedule" ? "opacity-90" : "opacity-95"}
          maxWidth={variant === "packages" || variant === "payments" ? 180 : 210}
        />
      </div>
    );
  }
  return (
    <div className="member-empty-illustration" aria-hidden="true">
      {illustration}
    </div>
  );
}

export function MemberEmptyState({
  variant = "cloudCard",
  eyebrow,
  title,
  body,
  primaryAction,
  secondaryAction,
  cta,
  illustration,
  align = "center",
  tone,
}: {
  variant?: MemberEmptyStateVariant;
  eyebrow?: string;
  title?: string;
  body?: string;
  primaryAction?: MemberEmptyStateAction;
  secondaryAction?: MemberEmptyStateAction;
  cta?: { label: string; to: string };
  illustration?: MemberEmptyStateIllustration;
  align?: "center" | "start";
  tone?: MemberEmptyStateTone;
}) {
  const { dir } = useI18n();
  const resolvedEyebrow = eyebrow ?? t(defaultEmptyTextKey(variant, "eyebrow"));
  const resolvedTitle = title ?? t(defaultEmptyTextKey(variant, "title"));
  const resolvedBody = body ?? t(defaultEmptyTextKey(variant, "body"));
  const resolvedPrimaryAction = primaryAction ?? cta;
  const resolvedIllustration =
    illustration === undefined ? defaultEmptyIllustration[variant] : illustration;
  const resolvedTone = tone ?? defaultEmptyTone[variant];

  return (
    <ReviewSurface
      dir={dir}
      data-product-view={variant === "schedule" ? "guest-schedule-empty" : undefined}
      className={`member-empty-state member-empty-state-${resolvedTone} member-empty-state-${align}`}
    >
      <span aria-hidden className="member-empty-hairline member-empty-hairline-top" />
      <span aria-hidden className="member-empty-hairline member-empty-hairline-bottom" />
      <MemberEmptyVisual illustration={resolvedIllustration} variant={variant} />
      <div className="member-empty-copy">
        {resolvedEyebrow && <p className="member-empty-eyebrow">{resolvedEyebrow}</p>}
        <h2 className="member-empty-title">{resolvedTitle}</h2>
        <p className="member-empty-body">{resolvedBody}</p>
      </div>
      {(resolvedPrimaryAction || secondaryAction) && (
        <div className="member-empty-actions">
          {resolvedPrimaryAction && (
            <EmptyAction action={resolvedPrimaryAction} variant="primary" />
          )}
          {secondaryAction && <EmptyAction action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </ReviewSurface>
  );
}

export function formatRelative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t("common.today");
  const minutes = Math.floor(ms / 60000);
  if (minutes < 2) return t("member.startsSoon");
  if (minutes < 60) return t("member.startsInMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("member.startsInHours", { count: hours });
  const days = Math.floor(hours / 24);
  return t("member.startsInDays", { count: days });
}

export { formatTime, formatDate };
