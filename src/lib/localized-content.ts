import { getActiveLang, type Lang } from "@/lib/i18n";

const HEBREW_RE = /[\u0590-\u05ff]/;
const ARABIC_RE = /[\u0600-\u06ff]/;

type LocalizedFieldSource = Record<string, unknown>;

export type LocalizedProgramSource = LocalizedFieldSource & {
  name?: string | null;
  name_en?: string | null;
  name_he?: string | null;
  name_ar?: string | null;
  description_en?: string | null;
  description_he?: string | null;
  description_ar?: string | null;
  level?: string | null;
};

export type LocalizedClassSource = LocalizedFieldSource & {
  title?: string | null;
  energy?: string | null;
  program_type?: LocalizedProgramSource | null;
};

export type LocalizedRoomSource = LocalizedFieldSource & {
  name?: string | null;
};

const INSTRUCTOR_NAME_ALIASES: Record<string, Record<Lang, string>> = {
  "נור עאמר": { en: "Noor Amer", he: "נור עאמר", ar: "نور عامر" },
  "noor amer": { en: "Noor Amer", he: "נור עאמר", ar: "نور عامر" },
  "نور عامر": { en: "Noor Amer", he: "נור עאמר", ar: "نور عامر" },
  "yareen shobash": { en: "Yareen Shobash", he: "יארין שובאש", ar: "يارين شوباش" },
  "יארין שובאש": { en: "Yareen Shobash", he: "יארין שובאש", ar: "يارين شوباش" },
  "ירין שובאש": { en: "Yareen Shobash", he: "יארין שובאש", ar: "يارين شوباش" },
  "يارين شوباش": { en: "Yareen Shobash", he: "יארין שובאש", ar: "يارين شوباش" },
};

const PROGRAM_NAME_ALIASES: Record<string, Record<Lang, string>> = {
  "aerial yoga": { en: "Aerial Yoga", he: "יוגה אווירית", ar: "يوغا هوائية" },
  "aerial / yoga": { en: "Aerial Yoga", he: "יוגה אווירית", ar: "يوغا هوائية" },
  "pilates mat": { en: "Pilates Mat", he: "פילאטיס מזרן", ar: "بيلاتيس فرشة" },
  "mat pilates": { en: "Mat Pilates", he: "פילאטיס מזרן", ar: "بيلاتيس فرشة" },
  "hot pilates": { en: "Hot Pilates", he: "הוט פילאטיס", ar: "هوت بيلاتيس" },
  "core balance": { en: "Core Balance", he: "איזון ליבה", ar: "توازن مركزي" },
  pilates: { en: "Pilates", he: "פילאטיס", ar: "بيلاتس" },
  "sculpt pilates": { en: "Sculpt Pilates", he: "פילאטיס סקלפט", ar: "بيلاتس سكلبت" },
};

const LEVEL_ALIASES: Record<string, Record<Lang, string>> = {
  "beginner to intermediate": {
    en: "Beginner–Intermediate",
    he: "מתחילות–בינוניות",
    ar: "مبتدئات–متوسط",
  },
  "beginner–intermediate": {
    en: "Beginner–Intermediate",
    he: "מתחילות–בינוניות",
    ar: "مبتدئات–متوسط",
  },
  "all levels": { en: "All levels", he: "לכל הרמות", ar: "لكل المستويات" },
  "intermediate to advanced": {
    en: "Intermediate–Advanced",
    he: "בינוניות–מתקדמות",
    ar: "متوسط–متقدم",
  },
  "intermediate–advanced": {
    en: "Intermediate–Advanced",
    he: "בינוניות–מתקדמות",
    ar: "متوسط–متقدم",
  },
};

const TONE_ALIASES: Record<string, Record<Lang, string>> = {
  "flow / signature": { en: "Flow", he: "שיעור זורם", ar: "حصة انسيابية" },
  flow: { en: "Flow", he: "שיעור זורם", ar: "حصة انسيابية" },
  signature: { en: "Flow", he: "שיעור זורם", ar: "حصة انسيابية" },
  "strength & precision": { en: "Strength & precision", he: "חיזוק ודיוק", ar: "قوة ودقة" },
  "strength and precision": {
    en: "Strength & precision",
    he: "חיזוק ודיוק",
    ar: "قوة ودقة",
  },
  "tone & energy": { en: "Tone & energy", he: "חיטוב ואנרגיה", ar: "نحت وطاقة" },
  "tone and energy": { en: "Tone & energy", he: "חיטוב ואנרגיה", ar: "نحت وطاقة" },
  calm: { en: "Calm", he: "רגוע", ar: "هادئ" },
  grounding: { en: "Grounding", he: "מקרקע", ar: "تثبيت" },
  uplifting: { en: "Flow", he: "שיעור זורם", ar: "حصة انسيابية" },
  restorative: { en: "Restorative", he: "משקם", ar: "ترميمي" },
};

const ROOM_NAME_ALIASES: Record<string, Record<Lang, string>> = {
  "main studio": { en: "Main Studio", he: "הסטודיו הראשי", ar: "الاستوديو الرئيسي" },
  "הסטודיו הראשי": { en: "Main Studio", he: "הסטודיו הראשי", ar: "الاستوديو الرئيسي" },
  "الاستوديو الرئيسي": { en: "Main Studio", he: "הסטודיו הראשי", ar: "الاستوديو الرئيسي" },
  "cloud room": { en: "Cloud Room", he: "חדר Cloud", ar: "غرفة Cloud" },
  "core room": { en: "Core Room", he: "חדר Core", ar: "غرفة Core" },
  "cloud & core studio": {
    en: "Cloud & Core Studio",
    he: "סטודיו Cloud & Core",
    ar: "استوديو Cloud & Core",
  },
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function splitBrandedLessonName(value: string | null | undefined) {
  if (!hasText(value)) return { brand: null, suffix: null };
  const parts = value.trim().split(/\s+[—–-]\s+/);
  if (parts.length < 2) return { brand: null, suffix: value.trim() };
  return {
    brand: parts.slice(0, -1).join(" — ").trim(),
    suffix: parts[parts.length - 1]?.trim() || null,
  };
}

function localizedProgramSuffix(value: string | null | undefined, lang: Lang) {
  if (!hasText(value)) return null;
  return aliasText(value, PROGRAM_NAME_ALIASES, lang) ?? value.trim();
}

function programBaseFrom(programType: LocalizedProgramSource | null | undefined, lang: Lang) {
  const candidates = [
    programType?.name_en,
    programType?.name,
    programType?.name_he,
    programType?.name_ar,
  ].filter(hasText);

  for (const candidate of candidates) {
    const { suffix } = splitBrandedLessonName(candidate);
    const localized = localizedProgramSuffix(suffix ?? candidate, lang);
    if (localized && localized !== candidate.trim()) return localized;
  }

  return localizedProgramSuffix(programType?.name_en ?? programType?.name, lang);
}

function localizedPresetFromBase(baseName: string | null, lang: Lang) {
  const normalized = (baseName ?? "").toLowerCase();
  if (/aerial|אווירית|هوائية/.test(normalized)) {
    return [
      PROGRAM_NAME_ALIASES["aerial yoga"][lang],
      LEVEL_ALIASES["beginner to intermediate"][lang],
      TONE_ALIASES["flow / signature"][lang],
    ];
  }
  if (/hot|הוט|هوت/.test(normalized)) {
    return [
      PROGRAM_NAME_ALIASES["hot pilates"][lang],
      LEVEL_ALIASES["intermediate to advanced"][lang],
      TONE_ALIASES["tone & energy"][lang],
    ];
  }
  if (/pilates mat|mat pilates|מזרן|فرشة|حصيرة/.test(normalized)) {
    return [
      PROGRAM_NAME_ALIASES["pilates mat"][lang],
      LEVEL_ALIASES["all levels"][lang],
      TONE_ALIASES["strength & precision"][lang],
    ];
  }
  return null;
}

function textForLang(
  source: LocalizedFieldSource | null | undefined,
  base: string,
  lang: Lang,
): string | null {
  const preferred = source?.[`${base}_${lang}`];
  if (hasText(preferred)) return preferred.trim();
  const english = source?.[`${base}_en`];
  if (hasText(english)) return english.trim();
  const hebrew = source?.[`${base}_he`];
  if (hasText(hebrew)) return hebrew.trim();
  const arabic = source?.[`${base}_ar`];
  if (hasText(arabic)) return arabic.trim();
  return null;
}

function knownClassTitle(rawTitle: string, lang: Lang): string | null {
  if (!rawTitle) return null;

  if (/Sculpt/i.test(rawTitle) && /פילאטיס/.test(rawTitle)) {
    if (lang === "en") return "Sculpt Pilates";
    if (lang === "he") return "פילאטיס סקלפט";
    if (lang === "ar") return "بيلاتس سكلبت";
  }

  if (/יוגה\s+אווירית/.test(rawTitle)) {
    if (lang === "en") return "Aerial Yoga";
    if (lang === "ar") return "يوغا هوائية";
  }

  if (/שיעור\s+פרטי/.test(rawTitle)) {
    if (lang === "en") return "Private Session";
    if (lang === "ar") return "جلسة خاصة";
  }

  if (/^Core\s+Balance$/i.test(rawTitle)) {
    if (lang === "he") return "איזון ליבה";
    if (lang === "ar") return "توازن مركزي";
    return "Core Balance";
  }

  if (/^E2E\s+Open\s+Class$/i.test(rawTitle)) {
    if (lang === "he") return "שיעור פתוח";
    if (lang === "ar") return "حصة مفتوحة";
    return "Open Class";
  }

  if (/^E2E\s+Imminent\s+Class$/i.test(rawTitle)) {
    if (lang === "he") return "שיעור קרוב";
    if (lang === "ar") return "حصة قريبة";
    return "Upcoming Class";
  }

  if (/^E2E\s+Full\s+Class$/i.test(rawTitle)) {
    if (lang === "he") return "שיעור מלא";
    if (lang === "ar") return "حصة ممتلئة";
    return "Full Class";
  }

  if (/^E2E\b/i.test(rawTitle)) {
    if (lang === "he") return rawTitle.replace(/^E2E\s*/i, "").trim() || "שיעור";
    if (lang === "ar") return rawTitle.replace(/^E2E\s*/i, "").trim() || "حصة";
  }

  return null;
}

export function localizedProgramName(
  programType: LocalizedProgramSource | null | undefined,
  lang: Lang = getActiveLang(),
): string | null {
  const preferred = textForLang(programType, "name", lang);
  if (preferred) {
    const { brand, suffix } = splitBrandedLessonName(preferred);
    const localizedSuffix = localizedProgramSuffix(suffix, lang);
    if (brand && localizedSuffix) return `${brand} — ${localizedSuffix}`;
    return preferred;
  }

  const raw = programType?.name_en ?? programType?.name;
  const { brand, suffix } = splitBrandedLessonName(raw);
  const localizedSuffix = localizedProgramSuffix(suffix ?? raw, lang);
  if (brand && localizedSuffix) return `${brand} — ${localizedSuffix}`;
  return localizedSuffix ?? (hasText(raw) ? raw.trim() : null);
}

export function localizedClassTitle(
  cls: LocalizedClassSource | null | undefined,
  lang: Lang = getActiveLang(),
): string {
  const rawTitle = hasText(cls?.title) ? cls.title.trim() : "";
  const programName = localizedProgramName(cls?.program_type, lang);
  const titleLooksHebrew = HEBREW_RE.test(rawTitle);
  const titleLooksArabic = ARABIC_RE.test(rawTitle);
  const knownTitle = knownClassTitle(rawTitle, lang);

  if (knownTitle) return knownTitle;

  const { brand, suffix } = splitBrandedLessonName(rawTitle);
  const localizedSuffix = localizedProgramSuffix(suffix, lang);
  if (brand && localizedSuffix) return `${brand} — ${localizedSuffix}`;

  if (programName && lang === "en" && (titleLooksHebrew || titleLooksArabic)) return programName;
  if (programName && lang === "ar" && titleLooksHebrew) return programName;
  if (programName && lang === "he" && titleLooksArabic) return programName;

  return programName || rawTitle || "Class";
}

export function localizedClassTitleParts(
  cls: LocalizedClassSource | null | undefined,
  lang: Lang = getActiveLang(),
): { brand: string | null; program: string; full: string } {
  const rawTitle = hasText(cls?.title) ? cls.title.trim() : "";
  const localizedTitle = localizedClassTitle(cls, lang);
  const program = localizedProgramBaseName(cls?.program_type, lang) ?? localizedTitle;
  const knownTitle = knownClassTitle(rawTitle, lang);

  if (knownTitle) {
    return { brand: null, program: knownTitle, full: knownTitle };
  }

  const { brand } = splitBrandedLessonName(rawTitle);
  if (brand && program) {
    return {
      brand,
      program,
      full: `${brand} — ${program}`,
    };
  }

  return {
    brand: null,
    program: localizedTitle,
    full: localizedTitle,
  };
}

export function localizedProgramBaseName(
  programType: LocalizedProgramSource | null | undefined,
  lang: Lang = getActiveLang(),
) {
  return programBaseFrom(programType, lang) ?? localizedProgramName(programType, lang);
}

export function localizedLevelName(
  value: string | null | undefined,
  programType?: LocalizedProgramSource | null,
  lang: Lang = getActiveLang(),
) {
  const basePreset = localizedPresetFromBase(programBaseFrom(programType, lang), lang);
  if (basePreset) return basePreset[1];
  const raw = hasText(value) ? value.trim() : "";
  const parts = raw
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  const levelPart = parts.find((p) => /beginner|intermediate|advanced|levels/i.test(p)) ?? raw;
  return aliasText(levelPart, LEVEL_ALIASES, lang) ?? levelPart;
}

export function localizedToneName(
  value: string | null | undefined,
  programType?: LocalizedProgramSource | null,
  lang: Lang = getActiveLang(),
) {
  const basePreset = localizedPresetFromBase(programBaseFrom(programType, lang), lang);
  if (basePreset) return basePreset[2];
  const raw = hasText(value) ? value.trim() : "";
  const parts = raw
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  const tonePart = parts.find((p) => /flow|signature|tone|energy|precision/i.test(p)) ?? raw;
  return aliasText(tonePart, TONE_ALIASES, lang) ?? tonePart;
}

export function localizedClassMetadataChips(
  cls: LocalizedClassSource | null | undefined,
  lang: Lang = getActiveLang(),
) {
  const baseName = programBaseFrom(cls?.program_type, lang);
  const preset = localizedPresetFromBase(baseName, lang);
  if (preset) return preset;

  return [
    baseName,
    localizedLevelName(cls?.program_type?.level, cls?.program_type, lang),
    localizedToneName(cls?.energy ?? cls?.program_type?.level, cls?.program_type, lang),
  ].filter(hasText);
}

export function localizedFilterLabel(value: string, lang: Lang = getActiveLang()) {
  const parts = value
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  const program = localizedProgramSuffix(parts[0], lang);
  const level =
    parts.find((p) => /beginner|intermediate|advanced|levels/i.test(p)) ?? parts[1] ?? "";
  const tone = parts.find((p) => /flow|signature|tone|energy|precision/i.test(p)) ?? parts[2] ?? "";
  const labels = [
    program,
    aliasText(level, LEVEL_ALIASES, lang) ?? level,
    aliasText(tone, TONE_ALIASES, lang) ?? tone,
  ].filter(hasText);
  return labels.length > 0 ? labels.join(" · ") : value;
}

export function localizedProgramDescription(
  programType: LocalizedProgramSource | null | undefined,
  lang: Lang = getActiveLang(),
): string | null {
  return textForLang(programType, "description", lang);
}

export function localizedInstructorName(
  name: string | null | undefined,
  lang: Lang = getActiveLang(),
) {
  if (!hasText(name)) return "—";
  const normalized = name.trim();
  const alias =
    INSTRUCTOR_NAME_ALIASES[normalized] ?? INSTRUCTOR_NAME_ALIASES[normalized.toLowerCase()];
  if (alias) return alias[lang];
  return normalized;
}

export function localizedOptionalInstructorName(
  name: string | null | undefined,
  lang: Lang = getActiveLang(),
) {
  if (!hasText(name)) return null;
  return localizedInstructorName(name, lang);
}

export function localizedRoomName(
  room: LocalizedRoomSource | string | null | undefined,
  fallbackOrLang?: string | null,
  langArg?: Lang,
): string | null {
  const maybeLang = fallbackOrLang;
  const lang =
    maybeLang === "he" || maybeLang === "ar" || maybeLang === "en"
      ? maybeLang
      : (langArg ?? getActiveLang());
  const fallback =
    maybeLang === "he" || maybeLang === "ar" || maybeLang === "en" ? null : fallbackOrLang;
  const raw =
    typeof room === "string" ? room.trim() : hasText(room?.name) ? room.name.trim() : fallback;
  return aliasText(raw, ROOM_NAME_ALIASES, lang) ?? (hasText(raw) ? raw.trim() : null);
}

function aliasText(
  value: string | null | undefined,
  aliases: Record<string, Record<Lang, string>>,
  lang: Lang,
) {
  if (!hasText(value)) return null;
  const direct = value.trim().toLowerCase();
  const normalized = direct.replace(/[_-]+/g, " ").replace(/\s*\/\s*/g, " / ");
  return aliases[direct]?.[lang] ?? aliases[normalized]?.[lang] ?? null;
}

export function localizedInstructorBio(
  bio: string | null | undefined,
  lang: Lang = getActiveLang(),
) {
  if (!hasText(bio)) return null;
  const normalized = bio.trim();
  if (
    ["Aerial & mat lead", "מובילה יוגה אווירית ומזרן", "مدرّبة يوغا هوائية وبساط"].includes(
      normalized,
    )
  ) {
    if (lang === "en") return "Aerial & mat lead";
    if (lang === "he") return "מובילה יוגה אווירית ומזרן";
    if (lang === "ar") return "مدرّبة يوغا هوائية وبساط";
  }
  return normalized;
}
