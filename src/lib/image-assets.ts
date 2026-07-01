// Centralized image registry for Cloud & Core.
//
// Layout-aware: each class photo ships in 3 crops so cards, modals, and
// thumbnails never force a single source into a mismatched shape.
//   - card:  16:9  (member schedule, premium card)
//   - hero:  21:9  (class detail modal, top-of-page hero)
//   - thumb: 1:1   (admin pulse, mini rows, capsule thumbs)

// Class-detail crops are still imported because the app needs multiple card/hero/thumb ratios.
import matDetail from "@/assets/mat-detail.webp";
import plantDetail from "@/assets/plant-detail.webp";
import hammockDetail from "@/assets/hammock-detail.webp";

import aerialYogaFlowCard from "@/assets/classes/aerial-yoga-flow-card.webp";
import aerialYogaFlowHero from "@/assets/classes/aerial-yoga-flow-hero.webp";
import aerialYogaFlowThumb from "@/assets/classes/aerial-yoga-flow-thumb.webp";

import coreBalanceCard from "@/assets/classes/core-balance-card.webp";
import coreBalanceHero from "@/assets/classes/core-balance-hero.webp";
import coreBalanceThumb from "@/assets/classes/core-balance-thumb.webp";

import pilatesSculptCard from "@/assets/classes/pilates-sculpt-card.webp";
import pilatesSculptHero from "@/assets/classes/pilates-sculpt-hero.webp";
import pilatesSculptThumb from "@/assets/classes/pilates-sculpt-thumb.webp";

import privateCard from "@/assets/classes/private-session-card.webp";
import privateHero from "@/assets/classes/private-session-hero.webp";
import privateThumb from "@/assets/classes/private-session-thumb.webp";

export type Lang = "he" | "en" | "ar";
export type ImageVariant = "card" | "hero" | "thumb";

export type ImageVariants = {
  card: string;
  hero: string;
  thumb: string;
};

type VariantImageUrlKey = `image_${ImageVariant}_url`;
type VariantImageSource = Partial<Record<VariantImageUrlKey, string | null>>;

export type ClassImageProgramSource = VariantImageSource & {
  name?: string | null;
  name_en?: string | null;
  name_he?: string | null;
  name_ar?: string | null;
  label?: string | null;
  image_url?: string | null;
  cover_image_url?: string | null;
  [key: string]: unknown;
};

export type ClassImageSource = VariantImageSource & {
  title?: string | null;
  image_url?: string | null;
  program_type?: ClassImageProgramSource | null;
  program?: ClassImageProgramSource | null;
  [key: string]: unknown;
};

export type ImageAsset = {
  src: string;
  variants?: ImageVariants;
  alt: { he: string; en: string; ar: string };
  tone?: "studio" | "class" | "instructor" | "empty" | "texture";
  /** CSS object-fit override. Default = "cover". */
  fit?: "contain" | "cover";
  /** CSS object-position value tuned per photo. */
  position?: string;
};

export const authImages = {
  hero: {
    src: "/images/auth/cloud-core-auth-hero.webp",
    alt: {
      he: "סטודיו Cloud & Core עם ערסלי יוגה אווירית",
      en: "Cloud & Core aerial yoga studio",
      ar: "استوديو Cloud & Core لليوغا الهوائية",
    },
    tone: "studio" as const,
  },
} satisfies Record<string, ImageAsset>;

export type ClassMoodKey =
  | "core-balance"
  | "morning-flow"
  | "yin-reset"
  | "pilates-sculpt"
  | "restorative-stretch"
  | "breath-mobility"
  | "kids-aerial"
  | "private-session"
  | "workshop"
  | "default";

/** Brand palette (do not extend). */
export const PALETTE = {
  navy: "#0B1D3A",
  ivory: "#FAF7F2",
  gold: "#D4AF6A",
  powder: "#E8DFD1",
  sand: "#E8DFD1",
  slate: "#6F7A8C",
} as const;

export const classMoods: Record<
  ClassMoodKey,
  {
    gradient: string;
    motif: "cloud" | "wave" | "moon" | "sun" | "leaf" | "spark" | "kite" | "circle";
    accent: string;
  }
> = {
  "core-balance": {
    gradient: "linear-gradient(135deg,#E8DFD1 0%,#FAF7F2 60%,#D4AF6A33 100%)",
    motif: "circle",
    accent: PALETTE.gold,
  },
  "morning-flow": {
    gradient: "linear-gradient(135deg,#FAF7F2 0%,#E8DFD1 55%,#D4AF6A55 100%)",
    motif: "sun",
    accent: PALETTE.gold,
  },
  "yin-reset": {
    gradient: "linear-gradient(135deg,#0B1D3A 0%,#173057 60%,#E8DFD140 100%)",
    motif: "moon",
    accent: PALETTE.powder,
  },
  "pilates-sculpt": {
    gradient: "linear-gradient(135deg,#E8DFD1 0%,#FAF7F2 70%)",
    motif: "spark",
    accent: PALETTE.navy,
  },
  "restorative-stretch": {
    gradient: "linear-gradient(135deg,#FAF7F2 0%,#E8DFD1 80%)",
    motif: "wave",
    accent: PALETTE.navy,
  },
  "breath-mobility": {
    gradient: "linear-gradient(135deg,#E8DFD1 0%,#FAF7F2 60%,#FFFFFF 100%)",
    motif: "cloud",
    accent: PALETTE.navy,
  },
  "kids-aerial": {
    gradient: "linear-gradient(135deg,#E8DFD1 0%,#D4AF6A55 50%,#FAF7F2 100%)",
    motif: "kite",
    accent: PALETTE.navy,
  },
  "private-session": {
    gradient: "linear-gradient(135deg,#0B1D3A 0%,#173057 60%,#D4AF6A55 100%)",
    motif: "spark",
    accent: PALETTE.gold,
  },
  workshop: {
    gradient: "linear-gradient(135deg,#0B1D3A 0%,#6F7A8C 70%,#D4AF6A33 100%)",
    motif: "leaf",
    accent: PALETTE.gold,
  },
  default: {
    gradient: "linear-gradient(135deg,#E8DFD1 0%,#FAF7F2 60%,#D4AF6A33 100%)",
    motif: "cloud",
    accent: PALETTE.gold,
  },
};

const NORMALIZE: Array<[RegExp, ClassMoodKey]> = [
  [/core|balance|ליבה|איזון/i, "core-balance"],
  [/morning|flow|בוקר|זרימה/i, "morning-flow"],
  [/yin|reset|איפוס|יין/i, "yin-reset"],
  [/pilates|sculpt|פילאטיס|עיצוב/i, "pilates-sculpt"],
  [/restor|stretch|מתיחות|התאוששות/i, "restorative-stretch"],
  [/breath|mobility|נשימה|תנועה/i, "breath-mobility"],
  [/kids|child|aerial|ילדים|אווירי/i, "kids-aerial"],
  [/private|אישי|פרטי/i, "private-session"],
  [/workshop|סדנה/i, "workshop"],
];

export function moodKeyFor(input?: string | null): ClassMoodKey {
  if (!input) return "default";
  for (const [re, key] of NORMALIZE) if (re.test(input)) return key;
  return "default";
}

/** Studio atmosphere / boutique imagery. */
export const studioImages = {
  loginHero: {
    src: "/images/studio/studio-interior.webp",
    alt: {
      he: "אווירת סטודיו Cloud & Core",
      en: "Cloud & Core studio atmosphere",
      ar: "أجواء استوديو Cloud & Core",
    },
    tone: "studio" as const,
  },
  atmosphere: {
    src: "/images/studio/studio-interior.webp",
    alt: { he: "סטודיו תנועה בוטיק", en: "Boutique movement studio", ar: "استوديو حركة بوتيك" },
    tone: "studio" as const,
  },
  studioInterior: {
    src: "/images/studio/studio-interior.webp",
    alt: {
      he: "חלל הסטודיו של Cloud & Core",
      en: "Cloud & Core studio space",
      ar: "مساحة استوديو Cloud & Core",
    },
    tone: "studio" as const,
  },
  logoWall: {
    src: "/images/studio/studio-sign.webp",
    alt: {
      he: "קיר המותג של Cloud & Core",
      en: "Cloud & Core brand wall",
      ar: "جدار علامة Cloud & Core",
    },
    tone: "studio" as const,
  },
  brandBannerNavy: {
    src: "/images/textures/cloud-core-soft-texture.webp",
    alt: {
      he: "Cloud & Core — באנר מותג",
      en: "Cloud & Core brand banner",
      ar: "Cloud & Core — لافتة",
    },
    tone: "studio" as const,
  },
  matDetail: {
    src: matDetail,
    alt: {
      he: "מזרן וכלים בסטודיו",
      en: "Mat and studio essentials",
      ar: "حصيرة وأدوات الاستوديو",
    },
    tone: "studio" as const,
  },
  plantDetail: {
    src: plantDetail,
    alt: { he: "פינת צמחיה רגועה", en: "Calm plant detail", ar: "زاوية نباتات هادئة" },
    tone: "studio" as const,
  },
  hammockDetail: {
    src: hammockDetail,
    alt: { he: "ערסל יוגה אווירית", en: "Aerial yoga hammock", ar: "أرجوحة يوغا هوائية" },
    tone: "studio" as const,
  },
  authBackdrop: {
    src: authImages.hero.src,
    alt: { he: "אווירת סטודיו בוטיק", en: "Boutique studio atmosphere", ar: "أجواء استوديو بوتيك" },
    tone: "studio" as const,
  },
  cloudCardBackdrop: {
    src: "/images/textures/cloud-card.svg",
    alt: { he: "", en: "", ar: "" },
    tone: "texture" as const,
  },
  ivoryPaper: {
    src: "/images/textures/ivory-paper.svg",
    alt: { he: "", en: "", ar: "" },
    tone: "texture" as const,
  },
  navyCloud: {
    src: "/images/textures/cloud-core-soft-texture.webp",
    alt: { he: "", en: "", ar: "" },
    tone: "texture" as const,
  },
} satisfies Record<string, ImageAsset>;

export const emptyStateImages = {
  noBookings: {
    src: "/images/empty-states/no-bookings.svg",
    alt: { he: "אין הזמנות פעילות", en: "No active bookings", ar: "لا توجد حجوزات نشطة" },
    tone: "empty" as const,
  },
  noClasses: {
    src: "/images/empty-states/no-classes.svg",
    alt: { he: "אין שיעורים בלוח", en: "No classes scheduled", ar: "لا توجد دروس مجדولة" },
    tone: "empty" as const,
  },
  paymentEmpty: {
    src: "/images/empty-states/payment-empty.svg",
    alt: { he: "אין תנועות תשלום", en: "No payment activity", ar: "لا توجد حركات دفع" },
    tone: "empty" as const,
  },
  cloudCardEmpty: {
    src: "/images/empty-states/cloud-card-empty.svg",
    alt: { he: "Cloud Card מחכה לך", en: "Your Cloud Card awaits", ar: "بطاقتك بانتظارك" },
    tone: "empty" as const,
  },
} satisfies Record<string, ImageAsset>;

export const instructorImages = {
  placeholder: {
    src: "/images/instructors/placeholder.svg",
    alt: { he: "מדריך/ה", en: "Instructor", ar: "مدرّب/ة" },
    tone: "instructor" as const,
  },
} satisfies Record<string, ImageAsset>;

/**
 * Real class photography — boutique studio shoot.
 * Each entry ships 3 crops so the consumer never stretches one shape.
 */
export const classImages = {
  coreBalance: {
    src: coreBalanceCard,
    variants: { card: coreBalanceCard, hero: coreBalanceHero, thumb: coreBalanceThumb },
    alt: { he: "שיעור Core Balance", en: "Core Balance class", ar: "درس Core Balance" },
    tone: "class" as const,
    fit: "cover" as const,
    position: "center center",
  },
  aerialYogaFlow: {
    src: aerialYogaFlowCard,
    variants: { card: aerialYogaFlowCard, hero: aerialYogaFlowHero, thumb: aerialYogaFlowThumb },
    alt: { he: "יוגה אווירית", en: "Aerial yoga flow", ar: "يوغا هوائية" },
    tone: "class" as const,
    fit: "cover" as const,
    position: "center 46%",
  },
  pilatesSculpt: {
    src: pilatesSculptCard,
    variants: { card: pilatesSculptCard, hero: pilatesSculptHero, thumb: pilatesSculptThumb },
    alt: { he: "פילאטיס Sculpt", en: "Pilates Sculpt", ar: "بيلاتس Sculpt" },
    tone: "class" as const,
    fit: "cover" as const,
    position: "center 52%",
  },
  privateSession: {
    src: privateCard,
    variants: { card: privateCard, hero: privateHero, thumb: privateThumb },
    alt: { he: "שיעור פרטי", en: "Private session", ar: "جلسة خاصة" },
    tone: "class" as const,
    fit: "cover" as const,
    position: "center center",
  },
} satisfies Record<string, ImageAsset>;

export type ClassImageKey = keyof typeof classImages;

const CLASS_IMAGE_NORMALIZE: Array<[RegExp, ClassImageKey]> = [
  [/aerial|hammock|אווירי|יוגה אווירית|هوائي/i, "aerialYogaFlow"],
  [/pilates.*sculpt|sculpt.*pilates|פילאטיס.*sculpt|פילאטיס.*עיצוב/i, "pilatesSculpt"],
  [/private|פרטי|אישי|خاص/i, "privateSession"],
  [/core|balance|ליבה|איזון/i, "coreBalance"],
  [/pilates|פילאטיס/i, "pilatesSculpt"],
];

export const DEFAULT_CLASS_IMAGE: ImageAsset = classImages.coreBalance;

/** Pick a class photo asset by title / program-type name. Null only when no candidates given. */
export function classImageFor(input?: string | string[] | null): ImageAsset | null {
  if (input == null) return null;
  const candidates = (Array.isArray(input) ? input : [input]).filter(
    (s): s is string => !!s && s.length > 0,
  );
  if (candidates.length === 0) return null;
  for (const candidate of candidates) {
    for (const [re, key] of CLASS_IMAGE_NORMALIZE) {
      if (re.test(candidate)) return classImages[key];
    }
  }
  return null;
}

/** Return the variant URL from an asset, or fall back to its base src. */
export function variantSrc(
  asset: ImageAsset | null | undefined,
  variant: ImageVariant,
): string | null {
  if (!asset) return null;
  return asset.variants?.[variant] ?? asset.src;
}

/**
 * Resolve the best image URL for a class row at a given layout.
 * Priority:
 *   1. class[image_<variant>_url]  (per-variant DB override)
 *   2. class.image_url             (single override)
 *   3. program_type[image_<variant>_url]
 *   4. program_type.image_url / cover_image_url
 *   5. mapped boutique photo (by program name / title) — uses variant crop
 *   6. DEFAULT_CLASS_IMAGE         — variant crop
 */
export function resolveClassImageSrc(
  cls: ClassImageSource | null | undefined,
  variant: ImageVariant = "card",
): string {
  const variantCol: VariantImageUrlKey = `image_${variant}_url`;
  const pt = cls?.program_type ?? cls?.program ?? null;
  const candidates: Array<string | null | undefined> = [
    cls?.[variantCol],
    cls?.image_url,
    pt?.[variantCol],
    pt?.image_url,
    pt?.cover_image_url,
  ];
  for (const c of candidates) if (c) return c;
  const ptName = pt?.name_en ?? pt?.name_he ?? pt?.name ?? pt?.label ?? null;
  const matched = classImageFor([ptName ?? "", cls?.title ?? ""]) ?? DEFAULT_CLASS_IMAGE;
  return variantSrc(matched, variant) ?? matched.src;
}

/** Resolve the tuned object-position for mapped class photography. */
export function resolveClassImagePosition(cls: ClassImageSource | null | undefined): string {
  const pt = cls?.program_type ?? cls?.program ?? null;
  const ptName = pt?.name_en ?? pt?.name_he ?? pt?.name ?? pt?.label ?? null;
  const matched = classImageFor([ptName ?? "", cls?.title ?? ""]) ?? DEFAULT_CLASS_IMAGE;
  return matched.position ?? "center center";
}

/** Helper: pick localized alt safely. */
export function localizedAlt(asset: ImageAsset, lang: Lang | string): string {
  const l = (lang as Lang) in asset.alt ? (lang as Lang) : "en";
  return asset.alt[l];
}

/** Initials for instructor / member avatar fallback. */
export function initialsFor(name?: string | null): string {
  if (!name) return "·";
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!clean) return "·";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}
