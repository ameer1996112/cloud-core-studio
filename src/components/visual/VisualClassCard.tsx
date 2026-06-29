import { Link } from "@tanstack/react-router";
import { getLocale, t, useI18n } from "@/lib/i18n";
import { ClassMoodImage } from "@/components/visual/ClassMoodImage";
import { initialsFor, resolveClassImageSrc } from "@/lib/image-assets";
import { formatDurationLabel, type ClassState } from "@/components/member/PremiumClassCard";
import {
  localizedClassMetadataChips,
  localizedClassTitle,
  localizedClassTitleParts,
  localizedOptionalInstructorName,
  localizedProgramName,
} from "@/lib/localized-content";
import { LtrInline, MixedLessonTitle } from "@/components/ui/bidi";
import {
  formatDuration,
  formatSpots,
  getArtTileVariant,
  getFriendlyStudioLocation,
  getLessonProgramAccent,
  getLessonVisualMode,
  type ArtTileVariant,
  shouldShowRoomOnLessonCard,
  type LessonCardContext,
  type LessonCardVariant,
} from "@/lib/lesson-card-variants";

/**
 * Cloud & Core schedule card — typography-led, image-accented.
 *
 * Anti-patterns this replaces:
 * - Full-bleed cloud-illustration backgrounds (felt like a placeholder).
 * - Large overlays that hid info.
 *
 * New rules:
 * - One small square photo/motif tile (no giant background art).
 * - Information dominates: title, instructor, capacity, CTA.
 * - State drives a 4px inline-start accent stripe + chip tone, not background.
 * - Clean Assistant for all functional text.
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

type VisualClassCardClass = {
  starts_at: string;
  duration_minutes: number;
  capacity?: number | null;
  booked_count?: number | null;
  instructor?: { name?: string | null } | null;
  program_type?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export function ClassArtTile({
  programType,
  tone,
  lang: _lang,
  compact = false,
  variant = "a",
}: {
  programType?: Record<string, unknown> | null;
  tone?: string | null;
  lang?: string;
  compact?: boolean;
  variant?: ArtTileVariant;
}) {
  const accent = getLessonProgramAccent({
    program_type: programType ?? null,
    energy: tone ?? null,
  });
  const key = accent.key;
  return (
    <div
      className={`lesson-card__art-tile lesson-card__art-tile--${key} ${
        compact ? "lesson-card__art-tile--compact" : ""
      } lesson-card__art-tile--variant-${variant}`}
      style={
        {
          "--lesson-accent": accent.rail,
          "--lesson-wash": accent.wash,
          "--lesson-surface": accent.surface,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 96 96" role="img" focusable="false">
        {key === "aerial" ? (
          <>
            <path
              className="motif motif-primary"
              d={
                variant === "b"
                  ? "M17 38c17-18 44-18 62 0"
                  : variant === "c"
                    ? "M16 30c12-10 25-14 39-9 10 3 18 7 25 13"
                    : "M18 31c15-14 45-14 60 0"
              }
            />
            <path
              className="motif motif-soft"
              d={
                variant === "c" ? "M28 31c5 25 15 36 30 31" : "M26 31c2 23 10 34 22 34s20-11 22-34"
              }
            />
            <path
              className="motif motif-gold"
              d={variant === "b" ? "M31 69c10 5 24 5 34 0" : "M35 67c8 7 18 7 26 0"}
            />
          </>
        ) : key === "hot" ? (
          <>
            <path
              className="motif motif-primary"
              d={
                variant === "b"
                  ? "M24 58c10-7 14-19 23-31 17 15 23 28 16 42"
                  : "M27 66c12-11 8-23 21-36 16 15 21 25 13 38"
              }
            />
            <path
              className="motif motif-soft"
              d={
                variant === "c"
                  ? "M31 50c9 5 20 5 31 0M30 61c10 5 22 5 33 0"
                  : "M38 68c8-7 6-14 14-23 9 10 10 17 4 24"
              }
            />
            <path className="motif motif-gold" d={variant === "b" ? "M28 74h40" : "M24 74h48"} />
          </>
        ) : key === "mat" ? (
          <>
            <rect
              className="motif-rect motif-soft-fill"
              x={variant === "b" ? "20" : "24"}
              y={variant === "c" ? "32" : "28"}
              width={variant === "b" ? "56" : "48"}
              height={variant === "c" ? "34" : "40"}
              rx="10"
            />
            <path
              className="motif motif-primary"
              d={variant === "b" ? "M29 39h38M29 50h30M29 61h38" : "M31 39h34M31 49h34M31 59h22"}
            />
            <path className="motif motif-gold" d={variant === "c" ? "M28 74h40" : "M22 72h52"} />
          </>
        ) : (
          <>
            <path className="motif motif-primary" d="M22 55c13-24 40-24 52 0" />
            <path className="motif motif-soft" d="M28 63c12 10 28 10 40 0" />
            <circle className="motif-dot" cx="48" cy="35" r="3" />
          </>
        )}
      </svg>
    </div>
  );
}

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
  const locale = getLocale();
  const dm =
    locale === "en"
      ? date.toLocaleDateString(locale, { month: "short", day: "numeric" })
      : `${date.getDate()}.${date.getMonth() + 1}`;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h2 className="font-sans text-[15px] font-semibold tracking-normal text-navy">{weekday}</h2>
        <span className="text-[12px] text-slate tabular-nums">
          · <LtrInline>{dm}</LtrInline>
        </span>
        <span className="flex-1 h-px bg-gold/30" />
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
}

function formatTimeParts(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  return {
    hour,
    minute,
    weekday: date.toLocaleDateString(getLocale(), { weekday: "short" }),
  };
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
  variant,
  index = 0,
  previousLesson = null,
  roomCount = 1,
  context = "memberSchedule",
}: {
  cls: VisualClassCardClass;
  state: ClassState;
  onOpen: () => void;
  participants?: string[];
  compact?: boolean;
  eager?: boolean;
  variant?: LessonCardVariant;
  index?: number;
  previousLesson?: VisualClassCardClass | null;
  roomCount?: number;
  context?: LessonCardContext;
}) {
  const { dir, lang } = useI18n();
  const isRtl = dir === "rtl";
  const { chipLabel } = toneFor(state);
  const ovr = overlayFor(state);
  const title = localizedClassTitle(cls);
  const titleParts = localizedClassTitleParts(cls, lang);
  const metaChips = localizedClassMetadataChips(cls);
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);
  const totalCapacity = cls.capacity ?? 0;
  const spotsLeft = Math.max(0, totalCapacity - (cls.booked_count ?? 0));
  const time = formatTimeParts(cls.starts_at);
  const resolvedVariant: LessonCardVariant = variant ?? (compact ? "compact" : "standard");
  const visualMode = getLessonVisualMode({
    index,
    lesson: cls,
    previousLesson,
    variant: resolvedVariant,
    context,
  });
  const accent = getLessonProgramAccent(cls);
  const tileVariant = getArtTileVariant(cls, index);
  const isHero = resolvedVariant === "hero";
  const useHeroImage = isHero && visualMode === "image";
  const roomName =
    typeof cls.room_ref === "object" && cls.room_ref && "name" in cls.room_ref
      ? String(cls.room_ref.name ?? "")
      : typeof cls.room === "string"
        ? cls.room
        : "";
  const locationLabel = shouldShowRoomOnLessonCard(roomCount, roomName)
    ? roomName
    : getFriendlyStudioLocation(lang);

  const cardShell = `lesson-card lesson-card--${resolvedVariant} visual-class-card class-card-shell ${
    isRtl ? "is-rtl" : "is-ltr"
  } relative min-w-0 max-w-full overflow-hidden transition-[transform,box-shadow] group-hover:-translate-y-0.5`;

  if (!isHero) {
    return (
      <button
        type="button"
        dir={dir}
        onClick={onOpen}
        className="group block w-full min-w-0 text-start"
      >
        <article
          dir={dir}
          className={cardShell}
          style={
            {
              "--lesson-accent": accent.rail,
              "--lesson-wash": accent.wash,
              "--lesson-surface": accent.surface,
            } as React.CSSProperties
          }
        >
          <span className="lesson-card__accent" aria-hidden="true" />
          <div className="lesson-card__content" dir={dir}>
            <div className="lesson-card__main">
              <div className="lesson-card__time-row">
                <span className="lesson-card__time-badge" dir="ltr">
                  {time.hour}:{time.minute}
                </span>
                <span className="lesson-card__duration" dir="auto">
                  <bdi>{formatDuration(cls.duration_minutes, lang)}</bdi>
                </span>
                <span className="lesson-card__availability">{chipLabel}</span>
              </div>

              <MixedLessonTitle
                as="h3"
                brand={titleParts.brand}
                program={titleParts.program}
                dir={dir}
                className="lesson-card__title lesson-card-title mt-2 font-sans text-[18px] sm:text-[20px] font-semibold leading-[1.15] tracking-normal text-navy"
              />

              <div className="lesson-card__chips lesson-chip-row mt-2">
                {metaChips.slice(0, resolvedVariant === "compact" ? 2 : 3).map((chip) => (
                  <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
                    <bdi>{chip}</bdi>
                  </span>
                ))}
              </div>

              <div className="lesson-card__meta" dir={dir}>
                <span dir="auto">
                  <bdi>{instructor ?? locationLabel}</bdi>
                </span>
                {instructor ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span dir="auto">
                      <bdi>{locationLabel}</bdi>
                    </span>
                  </>
                ) : null}
                <span aria-hidden="true"> · </span>
                <span dir="auto">
                  <bdi>{formatSpots(spotsLeft, totalCapacity, lang)}</bdi>
                </span>
              </div>
            </div>

            <div className="lesson-card__visual">
              <ClassArtTile
                programType={cls.program_type}
                tone={typeof cls.energy === "string" ? cls.energy : null}
                lang={lang}
                compact={resolvedVariant === "compact" || visualMode === "minimal"}
                variant={tileVariant}
              />
            </div>
          </div>
          <span className="sr-only">{chipLabel}</span>
        </article>
      </button>
    );
  }

  return (
    <button
      type="button"
      dir={dir}
      onClick={onOpen}
      className="group block w-full min-w-0 text-start"
    >
      {/* One image-led card. Taller native-photo ratio avoids forcing a panoramic crop. */}
      <article dir={dir} className={cardShell}>
        <div
          className={`lesson-card__visual ${
            useHeroImage ? "lesson-card__media class-card-photo" : "lesson-card__hero-art"
          } relative overflow-hidden ${compact ? "member-class-media" : "schedule-class-media"}`}
        >
          {useHeroImage ? (
            <>
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

              <div
                className="absolute inset-0 z-[2] pointer-events-none"
                aria-hidden
                style={{
                  background:
                    "linear-gradient(90deg, rgba(11,29,58,0.16) 0%, rgba(11,29,58,0.02) 44%, rgba(11,29,58,0.20) 100%)",
                }}
              />
            </>
          ) : (
            <ClassArtTile
              programType={cls.program_type}
              tone={typeof cls.energy === "string" ? cls.energy : null}
              lang={lang}
              variant={tileVariant}
            />
          )}

          <div
            className="class-time-badge"
            dir="ltr"
            aria-label={`${time.weekday} ${time.hour}:${time.minute}, ${formatDurationLabel(
              cls.duration_minutes,
            )}`}
          >
            <span className="class-time-badge__time">
              {time.hour}:{time.minute}
            </span>
            <span className="class-time-badge__separator" aria-hidden="true">
              ·
            </span>
            <span className="class-time-badge__duration" dir="auto">
              <bdi>{formatDurationLabel(cls.duration_minutes)}</bdi>
            </span>
          </div>

          <span className={`class-card-capacity border ${ovr.capacityBorder}`}>
            {spotsLeft === 0
              ? t("capacity.full")
              : spotsLeft === 1
                ? t("capacity.left.one")
                : t("capacity.left.many", { count: spotsLeft })}
          </span>

          {/* Participants — bottom inline-end, only when present */}
          {participants.length > 0 && (
            <div dir={dir} className="absolute bottom-3 end-3 z-[3] flex items-center gap-1">
              {participants.slice(0, 3).map((n, i) => (
                <ParticipantChip key={`${n}-${i}`} name={n} tone="ivory" />
              ))}
              {participants.length > 3 && (
                <span className="text-[10px] text-ivory/90">+{participants.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div className="class-card-copy" dir={dir}>
          <div className="class-card-main" dir={dir}>
            <MixedLessonTitle
              as="h3"
              brand={titleParts.brand}
              program={titleParts.program}
              dir={dir}
              className="lesson-card__title lesson-card-title font-sans text-[20px] sm:text-[24px] font-semibold leading-[1.1] tracking-normal text-navy"
            />
            <div className="lesson-chip-row mt-2">
              {metaChips.map((chip) => (
                <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
                  <bdi>{chip}</bdi>
                </span>
              ))}
            </div>
            <p
              className="lesson-card__instructor lesson-card-instructor mt-2 text-[13px] sm:text-[14px] text-slate leading-snug"
              dir="auto"
            >
              {instructor ?? t("member.locationStudio")}
            </p>
          </div>
        </div>

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
  cls: VisualClassCardClass;
  state: ClassState;
  to: string;
}) {
  const { dir, lang } = useI18n();
  const isRtl = dir === "rtl";
  const { tone, chipLabel } = toneFor(state);
  const title = localizedClassTitleParts(cls, lang);
  const metaChips = localizedClassMetadataChips(cls);
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);
  return (
    <Link
      to={to}
      dir={dir}
      className={`relative block overflow-hidden rounded-[14px] border border-gold/25 ${
        isRtl ? "is-rtl" : "is-ltr"
      } ${tone.card}`}
    >
      <span
        className={`absolute inset-y-0 ${isRtl ? "end-0" : "start-0"} w-[3px] ${tone.rail}`}
        aria-hidden
      />
      <div className={`flex items-center gap-3 p-2.5 text-start ${tone.text}`}>
        <div
          className="relative shrink-0 overflow-hidden rounded-[12px] border border-gold/25"
          style={{ width: 52, height: 52 }}
        >
          <ClassMoodImage
            title={title.full}
            programTypeName={localizedProgramName(cls?.program_type)}
            imageUrl={resolveClassImageSrc(cls, "thumb")}
            variant="thumb"
            className="absolute inset-0 h-full w-full"
          />

          {tone.desaturate && (
            <div className="absolute inset-0 bg-sand/40 mix-blend-luminosity" aria-hidden />
          )}
        </div>
        <div dir={dir} className="min-w-0 flex-1 text-start">
          <MixedLessonTitle
            as="p"
            brand={title.brand}
            program={title.program}
            dir={dir}
            className="truncate font-sans text-[14px] font-semibold leading-tight tracking-normal"
          />
          <p className={`text-[11px] truncate ${tone.soft} tabular-nums`}>
            <LtrInline>{formatTime(cls.starts_at)}</LtrInline>
            {metaChips[0] ? <span aria-hidden="true"> · </span> : null}
            {metaChips[0] ? (
              <span dir="auto">
                <bdi>{metaChips[0]}</bdi>
              </span>
            ) : null}
            {instructor ? <span aria-hidden="true"> · </span> : null}
            {instructor ? (
              <span dir="auto">
                <bdi>{instructor}</bdi>
              </span>
            ) : null}
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
