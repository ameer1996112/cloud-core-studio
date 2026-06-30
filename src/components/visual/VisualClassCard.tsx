import { Link } from "@tanstack/react-router";
import { ArrowUpLeft, CalendarPlus, ChevronLeft } from "lucide-react";
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
  getLessonAvailabilityMeter,
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

function fadeColorForCard(cardClass: string) {
  if (cardClass.includes("bg-navy")) return "#0B1D3A";
  if (cardClass.includes("bg-ivory")) return "#FAF7F2";
  if (cardClass.includes("bg-[#F1EBE1]")) return "#F1EBE1";
  if (cardClass.includes("bg-[#EDE5D8]")) return "#EDE5D8";
  if (cardClass.includes("bg-[#F5F0E9]")) return "#F5F0E9";
  if (cardClass.includes("bg-sand")) return "#E8DFD1";
  if (cardClass.includes("bg-powder")) return "#B7CCE6";
  return "#FAF7F2";
}

function PhotoPanel({
  title,
  imageUrl,
  imagePosition,
  desaturate,
  fadeColor,
  eager,
  isRtl,
  verticalFadeMobile = false,
}: {
  title?: string | null;
  imageUrl?: string | null;
  imagePosition?: string;
  desaturate?: boolean;
  fadeColor: string;
  eager?: boolean;
  isRtl: boolean;
  verticalFadeMobile?: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <ClassMoodImage
        title={title ?? undefined}
        imageUrl={imageUrl ?? null}
        className="absolute inset-0 h-full w-full"
        imagePosition={imagePosition}
        eager={eager}
      />
      {desaturate && (
        <div className="absolute inset-0 bg-sand/50 mix-blend-luminosity" aria-hidden />
      )}

      {/* Mobile: vertical fade (photo top, content below) */}
      {verticalFadeMobile && (
        <div
          className="pointer-events-none absolute inset-0 md:hidden"
          style={{ background: `linear-gradient(to bottom, transparent 55%, ${fadeColor} 100%)` }}
          aria-hidden
        />
      )}

      {/* Desktop: horizontal fade (photo left, content right in LTR; photo right, content left in RTL) */}
      <div
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          background: isRtl
            ? `linear-gradient(to left, transparent 45%, ${fadeColor} 95%)`
            : `linear-gradient(to right, transparent 45%, ${fadeColor} 95%)`,
        }}
        aria-hidden
      />
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
      card: "bg-[#F1EBE1]",
      rail: "bg-powder",
      chip: "bg-powder text-navy",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    full: {
      card: "bg-[#F1EBE1]",
      rail: "bg-slate/60",
      chip: "bg-navy/85 text-ivory",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-slate/30 text-slate cursor-not-allowed",
      desaturate: true,
    },
    low_credits: {
      card: "bg-[#EDE5D8]",
      rail: "bg-gold",
      chip: "bg-gold/80 text-navy",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    package_required: {
      card: "bg-[#EDE5D8]",
      rail: "bg-gold",
      chip: "bg-sand text-navy border border-gold/50",
      text: "text-navy",
      soft: "text-slate",
      cta: "bg-navy text-ivory hover:bg-navy/90",
    },
    cancelled: {
      card: "bg-[#F5F0E9]",
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
      <div className="schedule-day-section__cards grid gap-4 sm:gap-5">{children}</div>
    </section>
  );
}

function lessonCountLabel(count: number, locale: string) {
  if (locale.startsWith("he")) return `${count} ${count === 1 ? "שיעור" : "שיעורים"}`;
  if (locale.startsWith("ar")) return `${count} ${count === 1 ? "حصة" : "حصص"}`;
  return `${count} ${count === 1 ? "lesson" : "lessons"}`;
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

function studioName() {
  return "Cloud & Core Studio";
}

function StudioLocationInline({ value }: { value: string }) {
  const match = value.match(/Cloud\s*&\s*Core/);
  if (!match || match.index === undefined) {
    return (
      <span dir="auto">
        <bdi>{value}</bdi>
      </span>
    );
  }

  const before = value.slice(0, match.index);
  const after = value.slice(match.index + match[0].length);
  return (
    <span>
      {before}
      <bdi dir="ltr" style={{ unicodeBidi: "isolate" }}>
        Cloud &amp; Core
      </bdi>
      {after}
    </span>
  );
}

export function LessonAvailabilityMeter({
  capacity,
  bookedCount,
  lang,
  dir,
  compact = false,
}: {
  capacity?: number | null;
  bookedCount?: number | null;
  lang: Lang;
  dir: "rtl" | "ltr";
  compact?: boolean;
}) {
  const model = getLessonAvailabilityMeter({ capacity, bookedCount, lang });
  if (!model.shouldRender) return null;

  return (
    <div
      className={`lesson-availability-meter ${
        model.isLow ? "lesson-availability-meter--low" : ""
      } ${compact ? "lesson-availability-meter--compact" : ""}`}
      dir={dir}
      aria-label={model.assistiveLabel}
    >
      <div className="lesson-availability-meter__row">
        <span className="lesson-availability-meter__label" dir="auto">
          <bdi>{model.label}</bdi>
        </span>
        <span className="lesson-availability-meter__count" dir="ltr">
          {model.bookedCount}/{model.capacity}
        </span>
      </div>
      <div className="lesson-availability-meter__track" aria-hidden="true">
        <span
          className="lesson-availability-meter__fill"
          style={{ inlineSize: `${model.fillPercent}%` }}
        />
      </div>
    </div>
  );
}

function instructorDescriptor(instructor: string | null, lang: Lang) {
  if (!instructor) return null;
  if (lang === "he") return `בהנחיית ${instructor}`;
  if (lang === "ar") return `مع ${instructor}`;
  return `With ${instructor}`;
}

function supportTextFor(state: ClassState, chipLabel: string, lang: Lang) {
  switch (state.kind) {
    case "low_credits":
    case "package_required":
      if (lang === "he") return "נדרש חידוש קרדיטים כדי להשלים הזמנה.";
      if (lang === "ar") return "يلزم تجديد الرصيد لإكمال الحجز.";
      return "Credits are required to complete this reservation.";
    case "available":
    case "almost":
      return "";
    case "full":
      if (lang === "he") return "השיעור מלא כרגע.";
      if (lang === "ar") return "الحصة ممتلئة حاليا.";
      return "This class is currently full.";
    case "waitlist_available":
      if (lang === "he") return "אפשר להצטרף לרשימת ההמתנה.";
      if (lang === "ar") return "يمكن الانضمام إلى قائمة الانتظار.";
      return "You can join the waitlist for this class.";
    default:
      return chipLabel;
  }
}

function ctaLabelFor(state: ClassState, fallback: string, lang: Lang) {
  if (state.kind === "low_credits" || state.kind === "package_required") {
    if (lang === "he") return "חידוש קרדיטים";
    if (lang === "ar") return "تجديد الرصيد";
    return fallback;
  }
  if (state.kind === "available" || state.kind === "almost") {
    if (lang === "he") return "פרטים והרשמה";
    if (lang === "ar") return "التفاصيل والتسجيل";
    return "Details & booking";
  }
  if (state.kind === "waitlist_available") {
    if (lang === "he") return "הצטרפות לרשימת המתנה";
    if (lang === "ar") return "الانضمام إلى قائمة الانتظار";
    return "Join waitlist";
  }
  return fallback;
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

export function PremiumLessonReservationCard({
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
  const { tone, chipLabel, cta } = toneFor(state);
  const titleParts = localizedClassTitleParts(cls, lang);
  const metaChips = localizedClassMetadataChips(cls);
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);
  const totalCapacity = cls.capacity ?? 0;
  const spotsLeft = Math.max(0, totalCapacity - (cls.booked_count ?? 0));
  const time = formatTimeParts(cls.starts_at);
  const roomName =
    typeof cls.room_ref === "object" && cls.room_ref && "name" in cls.room_ref
      ? String(cls.room_ref.name ?? "")
      : typeof cls.room === "string"
        ? cls.room
        : "";
  const locationLabel = shouldShowRoomOnLessonCard(roomCount, roomName)
    ? roomName
    : getFriendlyStudioLocation(lang);
  const descriptor = instructorDescriptor(instructor, lang);
  const stateCopy = supportTextFor(state, chipLabel, lang);
  const fade = fadeColorForCard(tone.card);
  const imageUrl = resolveClassImageSrc(cls, "card");
  const imagePosition = resolveClassImagePosition(cls);
  const layoutVariant = normalizeLessonCardVariant(variant, compact, context);
  const accent = getLessonProgramAccent(cls);

  return (
    <button
      type="button"
      dir={dir}
      onClick={onOpen}
      className="group block w-full text-start animate-fade-in premium-lesson-card-trigger"
    >
      <article
        dir={dir}
        data-lesson-variant={layoutVariant}
        className={`lesson-card premium-lesson-card premium-lesson-card--live class-card-shell transition-[transform,box-shadow] duration-300 ${tone.card}`}
        style={
          {
            "--lesson-accent": accent.rail,
            "--lesson-wash": accent.wash,
            "--lesson-surface": accent.surface,
          } as React.CSSProperties
        }
      >
        <span className="lesson-card__accent" aria-hidden="true" />
        <div className="premium-lesson-card__layout">
          <div className="premium-lesson-card__media" aria-hidden="true">
            <PhotoPanel
              title={localizedClassTitle(cls)}
              imageUrl={imageUrl}
              imagePosition={imagePosition}
              desaturate={tone.desaturate}
              fadeColor={fade}
              eager={eager}
              isRtl={dir === "rtl"}
              verticalFadeMobile
            />
          </div>

          <div className={`premium-lesson-card__content ${tone.text}`}>
            <div className="premium-lesson-card__meta lesson-card__time-row">
              <span className="lesson-card__time-badge" dir="ltr">
                {time.hour}:{time.minute}
              </span>
              <span className="lesson-card__duration" dir="auto">
                <bdi>{formatDuration(cls.duration_minutes, lang)}</bdi>
              </span>
              <span className="lesson-card__availability" dir="auto">
                <bdi>{formatSpots(spotsLeft, totalCapacity, lang)}</bdi>
              </span>
            </div>
            <MixedLessonTitle
              as="h3"
              brand={titleParts.brand}
              program={titleParts.program}
              dir={dir}
              className="lesson-card__title lesson-card-title"
            />
            <div className="premium-lesson-card__descriptor">
              {descriptor ? (
                <>
                  <span dir="auto">
                    <bdi>{descriptor}</bdi>
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <StudioLocationInline value={locationLabel} />
            </div>

            <div dir={dir} className="lesson-card__chips lesson-chip-row">
              {metaChips.slice(0, 3).map((chip) => (
                <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
                  <bdi>{chip}</bdi>
                </span>
              ))}
            </div>

            <LessonAvailabilityMeter
              capacity={totalCapacity}
              bookedCount={cls.booked_count}
              lang={lang}
              dir={dir}
            />

            <div className="premium-lesson-card__actions lesson-card__footer">
              {stateCopy ? (
                <div className={`lesson-card__state-copy ${tone.soft}`}>
                  <span dir="auto">
                    <bdi>{stateCopy}</bdi>
                  </span>
                </div>
              ) : null}
              {participants.length > 0 && (
                <div className="premium-lesson-card__participants">
                  {participants.slice(0, 4).map((n, i) => (
                    <ParticipantChip
                      key={`${n}-${i}`}
                      name={n}
                      tone={tone.card.includes("navy") ? "ivory" : "navy"}
                    />
                  ))}
                  {participants.length > 4 && (
                    <span className={`text-[10px] ${tone.soft}`}>+{participants.length - 4}</span>
                  )}
                </div>
              )}
              {cta && !compact && (
                <span
                  className={`lesson-card__cta ${tone.cta}`}
                  aria-disabled={cta.disabled || undefined}
                >
                  {ctaLabelFor(state, cta.label, lang)}
                  {!cta.disabled && (
                    <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
                  )}
                </span>
              )}
            </div>
            {compact && (
              <ChevronLeft
                className={`absolute bottom-4 end-4 h-4 w-4 ${tone.soft} rtl:-scale-x-100`}
                aria-hidden
              />
            )}
          </div>
        </div>
      </article>
    </button>
  );
}

export const VisualClassCard = PremiumLessonReservationCard;
export const PremiumReservationLessonCard = PremiumLessonReservationCard;
export const LessonCard = PremiumLessonReservationCard;

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
      <div className={`flex items-center gap-3.5 p-3 text-start ${tone.text}`}>
        <div
          className="relative shrink-0 overflow-hidden rounded-[14px] border border-gold/25"
          style={{ width: 64, height: 64 }}
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

export function LessonReservationCard({
  cls,
  state,
  statusLabel,
  onOpen,
  children,
  muted = false,
}: {
  cls: VisualClassCardClass;
  state: ClassState;
  statusLabel?: string;
  onOpen: () => void;
  children?: React.ReactNode;
  muted?: boolean;
}) {
  const { dir, lang } = useI18n();
  const { chipLabel, cta } = toneFor(state);
  const titleParts = localizedClassTitleParts(cls, lang);
  const metaChips = localizedClassMetadataChips(cls);
  const instructor = localizedOptionalInstructorName(cls.instructor?.name);
  const totalCapacity = cls.capacity ?? 0;
  const spotsLeft = Math.max(0, totalCapacity - (cls.booked_count ?? 0));
  const time = formatTimeParts(cls.starts_at);
  const accent = getLessonProgramAccent(cls);
  const tileVariant = getArtTileVariant(cls, 0);
  const displayStatus = statusLabel ?? chipLabel;
  const descriptor = instructorDescriptor(instructor, lang);

  return (
    <article
      dir={dir}
      role="button"
      tabIndex={0}
      data-lesson-variant="booking"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`lesson-card premium-lesson-card lesson-reservation-card class-card-shell ${
        muted ? "lesson-reservation-card--muted" : ""
      }`}
      style={
        {
          "--lesson-accent": accent.rail,
          "--lesson-wash": accent.wash,
          "--lesson-surface": accent.surface,
        } as React.CSSProperties
      }
    >
      <span className="lesson-card__accent" aria-hidden="true" />
      <div className="lesson-reservation-card__media" aria-hidden="true">
        <ClassArtTile
          programType={cls.program_type}
          tone={typeof cls.energy === "string" ? cls.energy : null}
          lang={lang}
          compact
          variant={tileVariant}
        />
      </div>
      <div className="lesson-reservation-card__copy">
        <div className="premium-lesson-card__meta lesson-card__time-row">
          <span className="lesson-card__time-badge" dir="ltr">
            {time.hour}:{time.minute}
          </span>
          <span className="lesson-card__duration" dir="auto">
            <bdi>{formatDuration(cls.duration_minutes, lang)}</bdi>
          </span>
          <span className="lesson-card__availability" dir="auto">
            <bdi>{formatSpots(spotsLeft, totalCapacity, lang)}</bdi>
          </span>
        </div>
        <MixedLessonTitle
          as="h3"
          brand={titleParts.brand}
          program={titleParts.program}
          dir={dir}
          className="lesson-card__title lesson-card-title"
        />
        <div className="premium-lesson-card__descriptor">
          {descriptor ? (
            <>
              <span dir="auto">
                <bdi>{descriptor}</bdi>
              </span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <StudioLocationInline value={studioName()} />
        </div>
        <div dir={dir} className="lesson-card__chips lesson-chip-row">
          {metaChips.slice(0, 3).map((chip) => (
            <span key={chip} className="member-class-meta-chip" dir="auto" title={chip}>
              <bdi>{chip}</bdi>
            </span>
          ))}
        </div>
        <LessonAvailabilityMeter
          capacity={totalCapacity}
          bookedCount={cls.booked_count}
          lang={lang}
          dir={dir}
          compact
        />
        <div className="lesson-card__meta-inline">
          <span dir="auto">
            <bdi>{displayStatus}</bdi>
          </span>
          <span aria-hidden="true">·</span>
          <span dir="auto">
            <bdi>{supportTextFor(state, chipLabel, lang)}</bdi>
          </span>
        </div>
        {cta ? (
          <div className="lesson-reservation-card__primary-action">
            <CtaLabel label={ctaLabelFor(state, cta.label, lang)} disabled={cta.disabled} strong />
          </div>
        ) : null}
        {children ? <div className="lesson-reservation-card__actions">{children}</div> : null}
      </div>
    </article>
  );
}

/** Back-compat — older imports referenced an overlay component. Kept as no-op shim. */
export function ClassImageOverlay() {
  return null;
}
