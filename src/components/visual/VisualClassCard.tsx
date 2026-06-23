import { Link } from "@tanstack/react-router";
import { getLocale, t } from "@/lib/i18n";
import { ClassMoodImage } from "@/components/visual/ClassMoodImage";
import { initialsFor, resolveClassImageSrc } from "@/lib/image-assets";
import type { ClassState } from "@/components/member/PremiumClassCard";
import {
  localizedClassTitle,
  localizedInstructorName,
  localizedProgramName,
} from "@/lib/localized-content";

/**
 * Cloud & Core schedule card — typography-led, image-accented.
 *
 * Anti-patterns this replaces:
 * - Full-bleed cloud-illustration backgrounds (felt like a placeholder).
 * - Large overlays that hid info.
 *
 * New rules:
 * - One small square photo/motif tile (no giant background art).
 * - Information dominates: title, instructor · room, capacity, CTA.
 * - State drives a 4px inline-start accent stripe + chip tone, not background.
 * - Clean DM Sans for all functional text (titles use Cormorant Garamond).
 * - RTL-native via CSS logical props (ps-/pe-/start/end).
 */

type Tone = {
  /** card background */
  card: string;
  /** inline-start accent stripe */
  rail: string;
  /** chip background+text */
  chip: string;
  /** primary text color (title/CTA) */
  text: string;
  /** secondary text */
  soft: string;
  /** CTA pill */
  cta: string;
  /** disable image tile? */
  desaturate?: boolean;
};

function toneFor(state: ClassState): {
  tone: Tone;
  chipLabel: string;
  cta: { label: string; disabled?: boolean } | null;
} {
  // Brand-aware tones — no bright accents outside the palette.
  const tones: Record<string, Tone> = {
    booked: {
      card: "bg-navy",
      rail: "bg-gold",
      chip: "bg-gold text-navy",
      text: "text-ivory",
      soft: "text-ivory/75",
      cta: "bg-ivory text-navy hover:bg-gold",
    },
    waiting: {
      card: "bg-navy/95",
      rail: "bg-powder",
      chip: "bg-powder text-navy",
      text: "text-ivory",
      soft: "text-ivory/70",
      cta: "bg-powder text-navy hover:bg-ivory",
    },
    almost: {
      card: "bg-ivory",
      rail: "bg-gold",
      chip: "bg-gold/90 text-navy",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    available: {
      card: "bg-ivory",
      rail: "bg-navy/80",
      chip: "bg-ivory text-navy border border-gold/50",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    waitlist_available: {
      card: "bg-sand/40",
      rail: "bg-powder",
      chip: "bg-powder text-navy",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    full: {
      card: "bg-sand/40",
      rail: "bg-slate/60",
      chip: "bg-navy/85 text-ivory",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-slate/30 text-slate cursor-not-allowed",
      desaturate: true,
    },
    low_credits: {
      card: "bg-sand/50",
      rail: "bg-gold",
      chip: "bg-gold/80 text-navy",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    package_required: {
      card: "bg-sand/50",
      rail: "bg-gold",
      chip: "bg-sand text-navy border border-gold/50",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    cancelled: {
      card: "bg-sand/30",
      rail: "bg-slate/50",
      chip: "bg-navy/10 text-slate",
      text: "text-slate",
      soft: "text-slate/80",
      cta: "bg-slate/20 text-slate cursor-not-allowed",
      desaturate: true,
    },
    closed: {
      card: "bg-sand/30",
      rail: "bg-slate/50",
      chip: "bg-navy/10 text-slate",
      text: "text-slate",
      soft: "text-slate/80",
      cta: "bg-slate/20 text-slate cursor-not-allowed",
      desaturate: true,
    },
  };

  // Chip label + CTA per kind
  switch (state.kind) {
    case "booked":
      return {
        tone: tones.booked,
        chipLabel: t("state.booked"),
        cta: { label: t("class.cta.manageBooking") },
      };
    case "waiting":
      return {
        tone: tones.waiting,
        chipLabel: t("state.waiting"),
        cta: { label: t("class.cta.manageWaitlist") },
      };
    case "almost":
      return {
        tone: tones.almost,
        chipLabel: t("state.almost", { count: state.spotsLeft }),
        cta: { label: t("class.cta.bookClass") },
      };
    case "available":
      return {
        tone: tones.available,
        chipLabel: t("state.available", { count: state.spotsLeft }),
        cta: { label: t("class.cta.bookClass") },
      };
    case "waitlist_available":
      return {
        tone: tones.waitlist_available,
        chipLabel: t("state.waitlist_available"),
        cta: { label: t("class.cta.joinWaitlist") },
      };
    case "full":
      return {
        tone: tones.full,
        chipLabel: t("state.full"),
        cta: { label: t("state.full"), disabled: true },
      };
    case "low_credits":
      return {
        tone: tones.low_credits,
        chipLabel: t("state.low_credits"),
        cta: { label: t("class.cta.topUpCredits") },
      };
    case "package_required":
      return {
        tone: tones.package_required,
        chipLabel: t("state.package_required"),
        cta: { label: t("class.cta.choosePackage") },
      };
    case "cancelled":
      return { tone: tones.cancelled, chipLabel: t("state.cancelled"), cta: null };
    case "closed":
    default:
      return { tone: tones.closed, chipLabel: t("state.closed"), cta: null };
  }
}

export function ParticipantChip({
  name,
  tone = "ivory",
}: {
  name: string;
  tone?: "ivory" | "navy";
}) {
  const cls =
    tone === "navy"
      ? "bg-navy/70 text-ivory border-ivory/30"
      : "bg-ivory/95 text-navy border-gold/40";
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-medium ${cls}`}
      title={name}
    >
      {initialsFor(name)}
    </span>
  );
}

export function ScheduleDaySection({ date, children }: { date: Date; children: React.ReactNode }) {
  const weekday = date.toLocaleDateString(getLocale(), { weekday: "long" });
  const dm = date.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit" });
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="font-sans text-[15px] font-semibold tracking-normal text-navy">{weekday}</h2>
        <span className="text-[12px] text-slate tabular-nums">· {dm}</span>
        <span className="flex-1 h-px bg-gold/30" />
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
}

/**
 * Overlay tone for the photo-led card. State drives overlay strength and the
 * CTA pill color; the photo is always the dominant visual layer.
 */
function overlayFor(state: ClassState): {
  overlay: string;
  capacityBorder: string;
  desaturate?: boolean;
} {
  switch (state.kind) {
    case "booked":
      return {
        overlay:
          "linear-gradient(var(--ovr-dir), rgba(11,29,58,0.05) 0%, rgba(11,29,58,0.35) 50%, rgba(11,29,58,0.75) 100%)",
        capacityBorder: "border-gold/70",
      };
    case "waiting":
      return {
        overlay:
          "linear-gradient(var(--ovr-dir), rgba(11,29,58,0.05) 0%, rgba(11,29,58,0.32) 50%, rgba(11,29,58,0.72) 100%)",
        capacityBorder: "border-powder/70",
      };
    case "almost":
      return {
        overlay:
          "linear-gradient(var(--ovr-dir), rgba(212,175,106,0.04) 0%, rgba(11,29,58,0.24) 50%, rgba(11,29,58,0.70) 100%)",
        capacityBorder: "border-gold",
      };
    case "available":
      return {
        overlay:
          "linear-gradient(var(--ovr-dir), rgba(183,204,230,0.04) 0%, rgba(11,29,58,0.26) 50%, rgba(11,29,58,0.70) 100%)",
        capacityBorder: "border-gold/60",
      };
    case "waitlist_available":
      return {
        overlay:
          "linear-gradient(var(--ovr-dir), rgba(183,204,230,0.06) 0%, rgba(11,29,58,0.30) 50%, rgba(11,29,58,0.72) 100%)",
        capacityBorder: "border-powder",
      };
    case "low_credits":
    case "package_required":
      return {
        overlay:
          "linear-gradient(var(--ovr-dir), rgba(232,223,209,0.06) 0%, rgba(11,29,58,0.30) 50%, rgba(11,29,58,0.72) 100%)",
        capacityBorder: "border-gold/70",
      };
    case "full":
    case "cancelled":
    case "closed":
    default:
      return {
        overlay:
          "linear-gradient(var(--ovr-dir), rgba(11,29,58,0.20) 0%, rgba(11,29,58,0.50) 50%, rgba(11,29,58,0.82) 100%)",
        capacityBorder: "border-slate/50",
        desaturate: true,
      };
  }
}

export function VisualClassCard({
  cls,
  state,
  onOpen,
  participants = [],
  compact = false,
  eager = false,
}: {
  cls: any;
  state: ClassState;
  onOpen: () => void;
  participants?: string[];
  compact?: boolean;
  eager?: boolean;
}) {
  const { chipLabel } = toneFor(state);
  const ovr = overlayFor(state);
  const title = localizedClassTitle(cls);
  const instructor = localizedInstructorName(cls.instructor?.name);
  const room = cls.room_ref?.name ?? cls.room ?? null;
  const totalCapacity = cls.capacity ?? 0;
  const spotsLeft = Math.max(0, totalCapacity - (cls.booked_count ?? 0));
  const isRtl =
    typeof document !== "undefined"
      ? document.documentElement.dir === "rtl"
      : ["he", "ar"].includes(getLocale());

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid w-full min-w-0 grid-cols-[58px_minmax(0,1fr)] items-stretch gap-3 text-start sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-4"
    >
      {/* Time column — outside the card */}
      <div className="flex min-h-[148px] flex-col items-center justify-center rounded-[18px] border border-gold/25 bg-ivory/65 px-2 py-3 shadow-[0_10px_28px_-24px_rgba(11,29,58,0.55)] sm:min-h-[168px]">
        <span className="font-sans text-[20px] font-semibold leading-none text-navy tabular-nums">
          {formatTime(cls.starts_at)}
        </span>
        <span className="mt-1 text-[10px] text-slate tabular-nums">
          {cls.duration_minutes}
          {t("common.minutes")}
        </span>
      </div>

      {/* One image-led card. Taller native-photo ratio avoids forcing a panoramic crop. */}
      <article
        className={`visual-class-card relative min-w-0 max-w-full overflow-hidden rounded-[22px] bg-navy shadow-[0_18px_38px_-18px_rgba(11,29,58,0.45)] transition-[transform,box-shadow] group-hover:-translate-y-0.5 group-hover:shadow-[0_24px_50px_-24px_rgba(11,29,58,0.55)] ${
          compact ? "member-class-media" : "schedule-class-media"
        }`}
      >
        <ClassMoodImage
          title={title}
          programTypeName={localizedProgramName(cls?.program_type)}
          imageUrl={resolveClassImageSrc(cls, "card")}
          variant="card"
          imageFit="cover"
          imagePosition="center center"
          className="!absolute inset-0 h-full w-full"
          eager={eager}
        />

        {ovr.desaturate && (
          <div
            className="absolute inset-0 z-[2] bg-navy/25 mix-blend-luminosity pointer-events-none"
            aria-hidden
          />
        )}

        {/* Readable gradient overlay — strong on the text side, soft on the subject side */}
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          aria-hidden
          style={{
            background: isRtl
              ? "linear-gradient(270deg, rgba(11,29,58,0.78) 0%, rgba(11,29,58,0.60) 28%, rgba(11,29,58,0.18) 64%, rgba(11,29,58,0.05) 100%)"
              : "linear-gradient(90deg, rgba(11,29,58,0.05) 0%, rgba(11,29,58,0.18) 36%, rgba(11,29,58,0.60) 72%, rgba(11,29,58,0.78) 100%)",
          }}
        />

        {/* Content — anchored right-side safe zone (RTL-first) */}
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="absolute z-[3] flex flex-col items-end gap-2.5 text-right"
          style={{
            top: "50%",
            insetInlineEnd: "24px",
            transform: "translateY(-50%)",
            width: "min(48%, 380px)",
            color: "#FAF7F2",
          }}
        >
          <h3 className="font-sans text-[22px] sm:text-[26px] font-semibold leading-[1.1] tracking-tight text-ivory drop-shadow-[0_1px_3px_rgba(11,29,58,0.7)]">
            {title}
          </h3>
          <p className="text-[13px] sm:text-[14px] text-ivory/85 leading-snug drop-shadow-[0_1px_2px_rgba(11,29,58,0.55)] line-clamp-1">
            {instructor}
            {room ? ` · ${room}` : " · Cloud & Core"}
          </p>
          <span
            className={`inline-flex items-center rounded-full bg-navy/55 backdrop-blur-[2px] border ${ovr.capacityBorder} px-2.5 py-1 text-[11px] font-medium text-ivory whitespace-nowrap`}
          >
            {spotsLeft === 0
              ? t("capacity.full")
              : spotsLeft === 1
                ? t("capacity.left.one")
                : t("capacity.left.many", { count: spotsLeft })}
          </span>
        </div>

        {/* Participants — bottom inline-end, only when present */}
        {participants.length > 0 && (
          <div
            dir={isRtl ? "rtl" : "ltr"}
            className="absolute bottom-3 z-[3] flex items-center gap-1"
            style={{ insetInlineEnd: "14px" }}
          >
            {participants.slice(0, 3).map((n, i) => (
              <ParticipantChip key={`${n}-${i}`} name={n} tone="ivory" />
            ))}
            {participants.length > 3 && (
              <span className="text-[10px] text-ivory/90">+{participants.length - 3}</span>
            )}
          </div>
        )}

        {/* Screen-reader only state label (visual chip removed to avoid duplicate capacity info) */}
        <span className="sr-only">{chipLabel}</span>
      </article>
    </button>
  );
}

/** Mini variant — single-line row for home upcoming previews. */
export function VisualClassCardMini({
  cls,
  state,
  to,
}: {
  cls: any;
  state: ClassState;
  to: string;
}) {
  const { tone, chipLabel } = toneFor(state);
  const title = localizedClassTitle(cls);
  const instructor = localizedInstructorName(cls.instructor?.name);
  return (
    <Link
      to={to}
      className={`relative block overflow-hidden rounded-[14px] border border-gold/25 ${tone.card}`}
    >
      <span className={`absolute inset-y-0 start-0 w-[3px] ${tone.rail}`} aria-hidden />
      <div className={`flex items-center gap-3 p-2.5 ${tone.text}`}>
        <div
          className="relative shrink-0 overflow-hidden rounded-[12px] border border-gold/25"
          style={{ width: 52, height: 52 }}
        >
          <ClassMoodImage
            title={title}
            programTypeName={localizedProgramName(cls?.program_type)}
            imageUrl={resolveClassImageSrc(cls, "thumb")}
            variant="thumb"
            className="absolute inset-0 h-full w-full"
          />

          {tone.desaturate && (
            <div className="absolute inset-0 bg-sand/40 mix-blend-luminosity" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[14px] font-semibold leading-tight tracking-normal truncate">
            {title}
          </p>
          <p className={`text-[11px] truncate ${tone.soft} tabular-nums`}>
            {formatTime(cls.starts_at)} · {instructor}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tone.chip}`}
        >
          {chipLabel}
        </span>
      </div>
    </Link>
  );
}

/** Back-compat — older imports referenced an overlay component. Kept as no-op shim. */
export function ClassImageOverlay() {
  return null;
}
