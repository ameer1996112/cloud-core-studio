import { Link } from "@tanstack/react-router";
import { ArrowUpLeft, CalendarPlus, MapPin, Sparkles, Users } from "lucide-react";
import { getLocale, t, useI18n, type Lang } from "@/lib/i18n";
import { ClassMoodImage } from "@/components/visual/ClassMoodImage";
import { initialsFor, resolveClassImagePosition, resolveClassImageSrc } from "@/lib/image-assets";
import { type ClassState } from "@/components/member/PremiumClassCard";
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
  normalizeLessonCardVariant,
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
  lang = "en" as Lang,
  compact = false,
  variant = "a",
}: {
  programType?: Record<string, unknown> | null;
  tone?: string | null;
  lang?: Lang;
  compact?: boolean;
  variant?: ArtTileVariant;
}) {
  const accent = getLessonProgramAccent({
    program_type: programType ?? null,
    energy: tone ?? null,
  });
  const key = accent.key;
  const label = localizedProgramName(programType, lang);
  const code = key === "aerial" ? "AIR" : key === "mat" ? "MAT" : key === "hot" ? "HOT" : "C&C";

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
      <span className="lesson-card__plate-photo" />
      <span className="lesson-card__plate-mark">
        <img src="/brand/cloud-core-mark.svg" alt="" loading="lazy" decoding="async" />
      </span>
      <span className="lesson-card__plate-kicker">Cloud &amp; Core</span>
      <span className="lesson-card__plate-label" dir="auto">
        <bdi>{label}</bdi>
      </span>
      <span className="lesson-card__plate-code" dir="ltr">
        {code}
      </span>
      <span className="lesson-card__plate-rule" />
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

export function ScheduleDaySection({
  date,
  count,
  children,
}: {
  date: Date;
  count?: number;
  children: React.ReactNode;
}) {
  const weekday = date.toLocaleDateString(getLocale(), { weekday: "long" });
  const locale = getLocale();
  const dm =
    locale === "en"
      ? date.toLocaleDateString(locale, { month: "short", day: "numeric" })
      : `${date.getDate()}.${date.getMonth() + 1}`;
  return (
    <section className="schedule-day-section">
      <header className="schedule-day-header">
        <div className="schedule-day-header__copy">
          <p className="schedule-day-header__eyebrow">{t("nav.schedule")}</p>
          <h2 className="schedule-day-header__title">{weekday}</h2>
        </div>
        <span className="schedule-day-header__date tabular-nums">
          <LtrInline>{dm}</LtrInline>
        </span>
        {typeof count === "number" ? (
          <span className="schedule-day-header__count">{lessonCountLabel(count, getLocale())}</span>
        ) : null}
        <span className="schedule-day-header__rule" aria-hidden="true" />
      </header>
      <div className="schedule-day-section__cards">{children}</div>
    </section>
  );
}

function lessonCountLabel(count: number, locale: string) {
  if (locale.startsWith("he")) return `${count} ${count === 1 ? "שיעור" : "שיעורים"}`;
  if (locale.startsWith("ar")) return `${count} ${count === 1 ? "حصة" : "حصص"}`;
  return `${count} ${count === 1 ? "lesson" : "lessons"}`;
}

function MetaItem({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="lesson-card__meta-item">
      <div className="lesson-card__meta-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="lesson-card__meta-text w-full">
        <span className="lesson-card__meta-label">{label}</span>
        <span className="lesson-card__meta-value">{value}</span>
        {children}
      </div>
    </div>
  );
}

function CtaLabel({
  label,
  disabled = false,
  strong = false,
}: {
  label: string;
  disabled?: boolean;
  strong?: boolean;
}) {
  return (
    <span
      className={`lesson-card__cta ${strong ? "lesson-card__cta--primary" : ""} ${
        disabled ? "lesson-card__cta--disabled" : ""
      }`}
    >
      <span>{label}</span>
      {strong ? (
        <CalendarPlus className="lesson-card__cta-icon" />
      ) : (
        <ArrowUpLeft className="lesson-card__cta-icon" />
      )}
    </span>
  );
}

function availabilityText(spotsLeft: number, lang: Lang) {
  if (spotsLeft <= 0) return t("capacity.full");
  if (spotsLeft === 1) return t("capacity.left.one");
  return lang === "he" || lang === "ar"
    ? t("capacity.left.many", { count: spotsLeft })
    : t("capacity.left.many", { count: spotsLeft });
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
  const { chipLabel, cta } = toneFor(state);
  const title = localizedClassTitle(cls);
  const titleParts = localizedClassTitleParts(cls, lang);
  const metaChips = localizedClassMetadataChips(cls);
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);
  const totalCapacity = cls.capacity ?? 0;
  const spotsLeft = Math.max(0, totalCapacity - (cls.booked_count ?? 0));
  const time = formatTimeParts(cls.starts_at);
  const resolvedVariant =
    context === "memberHome" &&
    (variant === "hero" || variant === "standard" || variant === "compact")
      ? variant === "hero"
        ? "homeFeature"
        : "homeList"
      : variant;
  const normalizedVariant = normalizeLessonCardVariant(resolvedVariant, compact);
  const visualMode = getLessonVisualMode({
    index,
    lesson: cls,
    previousLesson,
    variant: normalizedVariant,
    context,
  });
  const isHomeFeature = normalizedVariant === "homeFeature";
  const isHomeList = normalizedVariant === "homeList";
  const isScheduleLead = normalizedVariant === "scheduleLead";
  const isScheduleList = normalizedVariant === "scheduleList";
  const isFeature = isHomeFeature || isScheduleLead;
  const accent = getLessonProgramAccent(cls);
  const tileVariant = getArtTileVariant(cls, index);
  const useHeroImage = isFeature && visualMode === "image";
  const roomName =
    typeof cls.room_ref === "object" && cls.room_ref && "name" in cls.room_ref
      ? String(cls.room_ref.name ?? "")
      : typeof cls.room === "string"
        ? cls.room
        : "";
  const locationLabel = shouldShowRoomOnLessonCard(roomCount, roomName)
    ? roomName
    : getFriendlyStudioLocation(lang);
  const openSpotsText = availabilityText(spotsLeft, lang);
  const listImageSrc = resolveClassImageSrc(cls, "thumb");
  const featureImageSrc = resolveClassImageSrc(cls, "card");

  const cardShell = `lesson-card lesson-card--${normalizedVariant} visual-class-card class-card-shell ${
    isRtl ? "is-rtl" : "is-ltr"
  } relative min-w-0 max-w-full overflow-hidden transition-[transform,box-shadow] group-hover:-translate-y-0.5`;

  if (!isFeature) {
    return (
      <button
        type="button"
        dir={dir}
        onClick={onOpen}
        className="group block w-full min-w-0 text-start"
      >
        <article
          dir={dir}
          data-lesson-variant={normalizedVariant}
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
          <div className="lesson-card__list-layout" dir={dir}>
            <div className="lesson-card__list-copy">
              <div className="lesson-card__time-row">
                <span className="lesson-card__time-badge" dir="ltr">
                  {time.hour}:{time.minute}
                </span>
                <span className="lesson-card__duration" dir="auto">
                  <bdi>{formatDuration(cls.duration_minutes, lang)}</bdi>
                </span>
                <span className="lesson-card__availability">
                  <bdi>{openSpotsText}</bdi>
                </span>
              </div>

              <MixedLessonTitle
                as="h3"
                brand={titleParts.brand}
                program={titleParts.program}
                dir={dir}
                className="lesson-card__title lesson-card-title"
              />
              <div className="lesson-card__chips lesson-chip-row">
                {metaChips.slice(0, isHomeList ? 2 : 3).map((chip) => (
                  <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
                    <bdi>{chip}</bdi>
                  </span>
                ))}
              </div>
              <div className="lesson-card__meta-inline">
                <span dir="auto">
                  <bdi>{instructor ?? t("member.locationStudio")}</bdi>
                </span>
                <span aria-hidden="true">·</span>
                <span dir="auto">
                  <bdi>{locationLabel}</bdi>
                </span>
                <span aria-hidden="true">·</span>
                <span dir="auto">
                  <bdi>{formatSpots(spotsLeft, totalCapacity, lang)}</bdi>
                </span>
              </div>
              <div className="lesson-card__footer">
                <span className="lesson-card__state-copy">{chipLabel}</span>
                {cta ? (
                  <CtaLabel label={cta.label} disabled={cta.disabled} strong={isScheduleList} />
                ) : null}
              </div>
            </div>
            <div className="lesson-card__list-media" aria-hidden="true">
              {listImageSrc ? (
                <ClassMoodImage
                  title={title}
                  programTypeName={localizedProgramName(cls?.program_type)}
                  imageUrl={listImageSrc}
                  variant="thumb"
                  imagePosition={resolveClassImagePosition(cls)}
                  className="lesson-card__list-image"
                  eager={eager}
                />
              ) : (
                <ClassArtTile
                  programType={cls.program_type}
                  tone={typeof cls.energy === "string" ? cls.energy : null}
                  lang={lang}
                  compact
                  variant={tileVariant}
                />
              )}
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
      <article
        dir={dir}
        data-lesson-variant={normalizedVariant}
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
        <div className="lesson-card__feature-layout" dir={dir}>
          <div className="lesson-card__feature-copy">
            <div className="lesson-card__time-row">
              <span className="lesson-card__time-badge" dir="ltr">
                {time.hour}:{time.minute}
              </span>
              <span className="lesson-card__duration" dir="auto">
                <bdi>{formatDuration(cls.duration_minutes, lang)}</bdi>
              </span>
              <span className="lesson-card__availability">
                <bdi>{openSpotsText}</bdi>
              </span>
            </div>
            <MixedLessonTitle
              as="h3"
              brand={titleParts.brand}
              program={titleParts.program}
              dir={dir}
              className="lesson-card__title lesson-card-title"
            />
            <div className="lesson-card__chips lesson-chip-row">
              {metaChips.slice(0, 3).map((chip) => (
                <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
                  <bdi>{chip}</bdi>
                </span>
              ))}
            </div>
            <div className="lesson-card__meta-grid" dir={dir}>
              <MetaItem
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label={t("common.with")}
                value={
                  <span dir="auto">
                    <bdi>{instructor ?? t("member.locationStudio")}</bdi>
                  </span>
                }
              />
              <MetaItem
                icon={<MapPin className="h-3.5 w-3.5" />}
                label={t("common.where")}
                value={
                  <span dir="auto">
                    <bdi>{locationLabel}</bdi>
                  </span>
                }
              />
              <MetaItem
                icon={<Users className="h-3.5 w-3.5" />}
                label={t("common.spots")}
                value={
                  <span dir="auto">
                    <bdi>{formatSpots(spotsLeft, totalCapacity, lang)}</bdi>
                  </span>
                }
              />
            </div>
            <div className="lesson-card__footer">
              <span className="lesson-card__state-copy">{chipLabel}</span>
              {cta ? <CtaLabel label={cta.label} disabled={cta.disabled} strong /> : null}
            </div>
            {participants.length > 0 ? (
              <div className="lesson-card__participant-row" dir={dir}>
                {participants.slice(0, 3).map((n, i) => (
                  <ParticipantChip key={`${n}-${i}`} name={n} tone="ivory" />
                ))}
                {participants.length > 3 && (
                  <span className="lesson-card__participant-count">+{participants.length - 3}</span>
                )}
              </div>
            ) : null}
          </div>
          <div className="lesson-card__feature-media">
            {useHeroImage && featureImageSrc ? (
              <ClassMoodImage
                title={title}
                programTypeName={localizedProgramName(cls?.program_type)}
                imageUrl={featureImageSrc}
                variant="card"
                imagePosition={resolveClassImagePosition(cls)}
                className="lesson-card__feature-image"
                eager={eager}
              />
            ) : (
              <ClassArtTile
                programType={cls.program_type}
                tone={typeof cls.energy === "string" ? cls.energy : null}
                lang={lang}
                variant={tileVariant}
              />
            )}
          </div>
        </div>
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
