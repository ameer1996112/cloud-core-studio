import type { Lang } from "@/lib/i18n";
import {
  localizedClassTitle,
  localizedLevelName,
  localizedProgramName as localizedProgramNameBase,
  localizedToneName,
  type LocalizedClassSource,
  type LocalizedProgramSource,
} from "@/lib/localized-content";

export type LessonCardVariant = "featured" | "standard" | "compact" | "booking";
export type LessonCardLayout = "homeFeature" | "homeList" | "scheduleLead" | "scheduleList";
export type LessonVisualMode = "image" | "artTile" | "accent" | "minimal";
export type LessonCardContext =
  | "memberHome"
  | "memberSchedule"
  | "memberBookings"
  | "classDetail"
  | "bookingConfirmation"
  | "adminSchedule";
export type ArtTileVariant = "a" | "b" | "c";

export type LessonVisualSource = LocalizedClassSource & {
  id?: string | null;
  image_url?: string | null;
  cover_image_url?: string | null;
  duration_minutes?: number | null;
  capacity?: number | null;
  booked_count?: number | null;
  room?: string | null;
  room_ref?: { name?: string | null } | null;
  starts_at?: string | null;
};

type VisualDecisionParams = {
  index: number;
  lesson: LessonVisualSource | null | undefined;
  previousLesson?: LessonVisualSource | null;
  variant?: LessonCardVariant;
  context?: LessonCardContext;
};

const PROGRAM_ACCENTS = {
  aerial: {
    key: "aerial",
    rail: "#0B1D3A",
    wash: "#FAF7F2",
    surface: "#FAF7F2",
    icon: "cloud",
  },
  mat: {
    key: "mat",
    rail: "#D4AF6A",
    wash: "#E8DFD1",
    surface: "#FFFFFF",
    icon: "mat",
  },
  hot: {
    key: "hot",
    rail: "#D4AF6A",
    wash: "#FAF7F2",
    surface: "#FFF8EC",
    icon: "heat",
  },
  default: {
    key: "default",
    rail: "#D4AF6A",
    wash: "#FAF7F2",
    surface: "#FFFFFF",
    icon: "spark",
  },
} as const;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalize(value: unknown) {
  return hasText(value) ? value.trim().toLowerCase() : "";
}

function lessonImageKey(lesson: LessonVisualSource | null | undefined) {
  const program = lesson?.program_type as (LocalizedProgramSource & { image_url?: string }) | null;
  const explicitImage =
    normalize(lesson?.image_url) ||
    normalize(lesson?.cover_image_url) ||
    normalize(program?.image_url) ||
    normalize(program?.cover_image_url);
  if (explicitImage) return explicitImage;

  return normalize(
    [program?.name, program?.name_en, program?.name_he, program?.name_ar, lesson?.title]
      .filter(Boolean)
      .join("|"),
  );
}

export function normalizeLessonCardVariant(
  variant: LessonCardVariant | undefined,
  compact = false,
  context: LessonCardContext = "memberSchedule",
): LessonCardLayout {
  if (variant === "featured") {
    return context === "memberHome" ? "homeFeature" : "scheduleLead";
  }
  if (variant === "compact" || variant === "booking" || compact) return "homeList";
  return context === "memberHome" ? "homeList" : "scheduleList";
}

export function getLessonVisualMode({
  index,
  lesson,
  previousLesson,
  variant = "standard",
  context = "memberSchedule",
}: VisualDecisionParams): LessonVisualMode {
  if (variant === "compact") return "minimal";
  if (variant === "booking") return "minimal";

  const normalizedVariant = normalizeLessonCardVariant(variant, false, context);
  const isFeature = normalizedVariant === "homeFeature" || normalizedVariant === "scheduleLead";
  const showThumbnail = shouldShowLessonThumbnail({ index, lesson, previousLesson, context });

  if (isFeature) {
    if (showThumbnail) return "image";
    return "artTile";
  }

  if (showThumbnail) return "image";
  if (context === "memberSchedule" && index > 0) return "minimal";
  if (context === "memberSchedule" || context === "adminSchedule") return "accent";
  return "accent";
}

export function shouldShowLessonThumbnail({
  lesson,
  variant = "standard",
}: VisualDecisionParams): boolean {
  if (variant === "compact" || variant === "booking") return false;
  const currentImage = lessonImageKey(lesson);
  if (!currentImage) return false;
  return true;
}

export function shouldUseImageCard(params: VisualDecisionParams) {
  return getLessonVisualMode(params) === "image";
}

export function getLocalizedProgramName(
  program: LocalizedProgramSource | null | undefined,
  lang: Lang,
) {
  const direct = program?.[`name_${lang}` as keyof LocalizedProgramSource];
  if (hasText(direct)) return normalizeProgramLabel(direct.trim(), lang);
  if (lang === "en" && hasText(program?.name))
    return normalizeProgramLabel(program.name.trim(), lang);
  return normalizeProgramLabel(
    localizedProgramNameBase(program, lang) ?? fallbackByLang(lang, "Class", "שיעור", "حصة"),
    lang,
  );
}

export function getLocalizedLessonTitle(
  lesson: LocalizedClassSource | null | undefined,
  lang: Lang,
) {
  const title = hasText(lesson?.title) ? lesson.title.trim() : "";
  if (/^Cloud\s*&\s*Core\b/i.test(title)) {
    return `Cloud & Core — ${getLocalizedProgramName(lesson?.program_type, lang)}`;
  }
  return localizedClassTitle(lesson, lang);
}

export function getLocalizedIntensity(
  value: string | null | undefined,
  lang: Lang,
  program?: LocalizedProgramSource | null,
) {
  return localizedLevelName(normalizeToken(value), program, lang);
}

export function getLocalizedTone(
  value: string | null | undefined,
  lang: Lang,
  program?: LocalizedProgramSource | null,
) {
  return localizedToneName(normalizeToken(value), program, lang);
}

export function formatDuration(minutes: number | null | undefined, lang: Lang) {
  const value = Number(minutes ?? 0);
  if (lang === "he") return `${value} דק׳`;
  if (lang === "ar") return `${value} دقيقة`;
  return `${value} min`;
}

export function formatSpots(
  open: number | null | undefined,
  _total: number | null | undefined,
  lang: Lang,
) {
  const value = Math.max(0, Number(open ?? 0));
  if (value === 0) return fallbackByLang(lang, "Waitlist", "רשימת המתנה", "قائمة انتظار");
  if (lang === "he") return `${value} ${value === 1 ? "מקום פנוי" : "מקומות פנויים"}`;
  if (lang === "ar") return `${value} ${value === 1 ? "مكان متاح" : "أماكن متاحة"}`;
  return `${value} ${value === 1 ? "spot" : "spots"} open`;
}

export type LessonAvailabilityMeterModel = {
  shouldRender: boolean;
  spotsLeft: number;
  capacity: number;
  bookedCount: number;
  bookedRatio: number;
  fillPercent: number;
  isLow: boolean;
  label: string;
  assistiveLabel: string;
};

export function getLessonAvailabilityMeter({
  capacity,
  bookedCount,
  lang,
}: {
  capacity?: number | null;
  bookedCount?: number | null;
  lang: Lang;
}): LessonAvailabilityMeterModel {
  const safeCapacity = Math.max(0, Number(capacity ?? 0));
  const safeBooked = Math.min(safeCapacity, Math.max(0, Number(bookedCount ?? 0)));
  const spotsLeft = Math.max(0, safeCapacity - safeBooked);

  if (safeCapacity <= 0) {
    return {
      shouldRender: false,
      spotsLeft: 0,
      capacity: 0,
      bookedCount: 0,
      bookedRatio: 0,
      fillPercent: 0,
      isLow: false,
      label: formatSpots(0, 0, lang),
      assistiveLabel: formatSpots(0, 0, lang),
    };
  }

  const bookedRatio = safeBooked / safeCapacity;
  const fillPercent = Math.round(bookedRatio * 100);
  const isFull = spotsLeft === 0;
  const isLow = isFull || spotsLeft <= 2 || bookedRatio >= 0.75;
  const label = availabilityMeterLabel(spotsLeft, isLow, lang);
  const assistiveLabel =
    isFull && lang !== "en"
      ? label
      : lang === "he"
        ? `${label} מתוך ${safeCapacity}`
        : lang === "ar"
          ? `${label} من ${safeCapacity}`
          : isFull
            ? label
            : `${label} out of ${safeCapacity}`;

  return {
    shouldRender: true,
    spotsLeft,
    capacity: safeCapacity,
    bookedCount: safeBooked,
    bookedRatio: Number(bookedRatio.toFixed(3)),
    fillPercent,
    isLow,
    label,
    assistiveLabel,
  };
}

function availabilityMeterLabel(spotsLeft: number, isLow: boolean, lang: Lang) {
  if (spotsLeft <= 0) {
    return fallbackByLang(lang, "Waitlist open", "רשימת המתנה פתוחה", "قائمة الانتظار مفتوحة");
  }
  if (!isLow) return formatSpots(spotsLeft, spotsLeft, lang);

  if (lang === "he")
    return spotsLeft === 1 ? "נותר מקום אחד בלבד" : `נותרו ${spotsLeft} מקומות בלבד`;
  if (lang === "ar")
    return spotsLeft === 1 ? "تبقى مكان واحد فقط" : `تبقى ${spotsLeft} أماكن فقط`;
  return spotsLeft === 1 ? "Only 1 spot left" : `Only ${spotsLeft} spots left`;
}

export function formatTime(iso: string | Date, lang: Lang, timeZone?: string) {
  return new Intl.DateTimeFormat(localeForLang(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function getFriendlyStudioLocation(lang: Lang) {
  if (lang === "he") return "בסטודיו Cloud & Core";
  if (lang === "ar") return "في ستوديو Cloud & Core";
  return "At Cloud & Core Studio";
}

export function getLessonProgramAccent(lesson: LessonVisualSource | null | undefined) {
  const name = normalize(
    [
      lesson?.program_type?.name,
      lesson?.program_type?.name_en,
      lesson?.program_type?.name_he,
      lesson?.program_type?.name_ar,
      lesson?.title,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (/aerial|אווירית|هوائية/.test(name)) return PROGRAM_ACCENTS.aerial;
  if (/hot|הוט|هوت|heat/.test(name)) return PROGRAM_ACCENTS.hot;
  if (/mat|מזרן|فرشة|حصيرة|pilates/.test(name)) return PROGRAM_ACCENTS.mat;
  return PROGRAM_ACCENTS.default;
}

export function getArtTileVariant(
  lesson: LessonVisualSource | null | undefined,
  index: number,
): ArtTileVariant {
  const hour = hasText(lesson?.starts_at) ? new Date(lesson.starts_at).getHours() : 0;
  const toneWeight = normalize(lesson?.energy).length % 3;
  const slot = Math.abs(index + hour + toneWeight) % 3;
  return slot === 0 ? "a" : slot === 1 ? "b" : "c";
}

export function shouldShowRoomOnLessonCard(
  roomCount: number | null | undefined,
  roomName?: string | null,
) {
  return Number(roomCount ?? 0) > 1 && hasText(roomName);
}

function localeForLang(lang: Lang) {
  if (lang === "ar") return "ar";
  if (lang === "en") return "en";
  return "he-IL";
}

function fallbackByLang(lang: Lang, en: string, he: string, ar: string) {
  if (lang === "ar") return ar;
  if (lang === "en") return en;
  return he;
}

function normalizeToken(value: string | null | undefined) {
  return hasText(value) ? value.trim().replace(/_/g, " ") : value;
}

function normalizeProgramLabel(value: string, lang: Lang) {
  if (lang === "en" && /^pilates mat$/i.test(value.trim())) return "Mat Pilates";
  return value;
}
