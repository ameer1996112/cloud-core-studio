import { getActiveLang, type Lang } from "@/lib/i18n";

const HEBREW_RE = /[\u0590-\u05ff]/;
const ARABIC_RE = /[\u0600-\u06ff]/;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function textForLang(source: any, base: string, lang: Lang): string | null {
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

  return null;
}

export function localizedProgramName(
  programType: any,
  lang: Lang = getActiveLang(),
): string | null {
  return (
    textForLang(programType, "name", lang) ?? (hasText(programType?.name) ? programType.name : null)
  );
}

export function localizedClassTitle(cls: any, lang: Lang = getActiveLang()): string {
  const rawTitle = hasText(cls?.title) ? cls.title.trim() : "";
  const programName = localizedProgramName(cls?.program_type, lang);
  const titleLooksHebrew = HEBREW_RE.test(rawTitle);
  const titleLooksArabic = ARABIC_RE.test(rawTitle);
  const knownTitle = knownClassTitle(rawTitle, lang);

  if (knownTitle && (titleLooksHebrew || titleLooksArabic)) return knownTitle;

  if (programName && lang === "en" && (titleLooksHebrew || titleLooksArabic)) return programName;
  if (programName && lang === "ar" && titleLooksHebrew) return programName;
  if (programName && lang === "he" && titleLooksArabic) return programName;

  return rawTitle || programName || "Class";
}

export function localizedProgramDescription(
  programType: any,
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
  if (["נור עאמר", "Noor Amer", "نور عامر"].includes(normalized)) {
    if (lang === "he") return "נור עאמר";
    if (lang === "en") return "Noor Amer";
    if (lang === "ar") return "نور عامر";
  }
  return normalized;
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
