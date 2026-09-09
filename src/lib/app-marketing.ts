import { DEFAULT_LOCALE, type Lang } from "@/lib/i18n";
import { roleHome, type AppRole } from "@/lib/auth-role-home";
import { buildMarketingHref, sanitizeMarketingUtm } from "@/lib/marketing-attribution";

export { buildMarketingHref, sanitizeMarketingUtm } from "@/lib/marketing-attribution";

export const PUBLIC_SITE_ORIGIN = "https://cloudandcorestudio.com";
export const APP_MARKETING_CANONICAL_URL = `${PUBLIC_SITE_ORIGIN}/app`;
export const APP_MARKETING_OG_IMAGE =
  "https://cloudandcorestudio.com/images/auth/cloud-core-auth-hero.webp";
export const APP_MARKETING_LANGS = ["ar", "he", "en"] as const;
export type AppMarketingLang = (typeof APP_MARKETING_LANGS)[number];
const APP_MARKETING_PUBLIC_PATH = /^\/app(?:\/(?:ar|he|en))?\/?$/;
const APP_MARKETING_BASE_URL = APP_MARKETING_CANONICAL_URL;
export const APP_MARKETING_INSTALL_URL = "https://apps.apple.com/app/id6786035836";
export const APP_MARKETING_APP_ICON =
  "https://cloudandcorestudio.com/brand/cloud-core-app-icon.svg";
export const APP_MARKETING_LOCALE_URLS: Record<AppMarketingLang, string> = {
  ar: `${APP_MARKETING_BASE_URL}/ar`,
  he: `${APP_MARKETING_BASE_URL}/he`,
  en: `${APP_MARKETING_BASE_URL}/en`,
};
export const PUBLIC_INDEXING_URLS = [
  APP_MARKETING_LOCALE_URLS.ar,
  APP_MARKETING_LOCALE_URLS.he,
  APP_MARKETING_LOCALE_URLS.en,
  `${PUBLIC_SITE_ORIGIN}/support`,
  `${PUBLIC_SITE_ORIGIN}/privacy`,
  `${PUBLIC_SITE_ORIGIN}/terms`,
] as const;
export const PUBLIC_SITEMAP_URL = `${PUBLIC_SITE_ORIGIN}/sitemap.xml`;
export const APP_MARKETING_OG_IMAGES: Record<AppMarketingLang, string> = {
  ar: "https://cloudandcorestudio.com/images/app-marketing/social/ar.png",
  he: "https://cloudandcorestudio.com/images/app-marketing/social/he.png",
  en: "https://cloudandcorestudio.com/images/app-marketing/social/en.png",
};
export const APP_STORE_BADGE_PATHS: Record<Lang, string> = {
  he: "/brand/app-store-badges/he.svg",
  ar: "/brand/app-store-badges/ar.svg",
  en: "/brand/app-store-badges/en.svg",
};
export const APP_STORE_BADGE_DIMENSIONS: Record<Lang, { width: number; height: number }> = {
  ar: { width: 120, height: 40 },
  he: { width: 122, height: 42 },
  en: { width: 120, height: 40 },
};

export type AppMarketingSearch = { lang?: Lang };

export function isPublicAppMarketingPathname(pathname: string) {
  return APP_MARKETING_PUBLIC_PATH.test(pathname);
}

export type AppMarketingPublicProfile = {
  address: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
  publicPhone: string | null;
  whatsappNumber: string | null;
};

export type AppMarketingCopy = {
  headerAction: string;
  storeAccessibleLabel: string;
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    storeCta: string;
    trust: string;
    offer: string;
    memberCta: string;
  };
  features: { eyebrow: string; title: string; items: [string, string][] };
  screenshots: {
    eyebrow: string;
    title: string;
    headings: [string, string, string, string, string];
  };
  classes: {
    eyebrow: string;
    title: string;
    body: string;
    items: [string, string, string, string];
    descriptions: [string, string, string, string];
  };
  steps: { eyebrow: string; title: string; items: [string, string, string] };
  finalCta: {
    title: string;
    body: string;
    actions: [string, string, string];
  };
  trustSignals: {
    eyebrow: string;
    title: string;
    items: [string, string, string, string, string, string];
  };
  faq: [string, string][];
  footer: {
    location: string;
    address: string;
    support: string;
    privacy: string;
    terms: string;
    signIn: string;
  };
};

export type AppMarketingMeta = {
  title: string;
  description: string;
  locale: "he_IL" | "ar_IL" | "en_US";
  canonical: string;
  canonicalUrl: string;
  ogImage: string;
  image: string;
};

export type AppMarketingScreenshot = {
  kind: "schedule" | "booking" | "bookings" | "membership" | "account";
  src: string;
  alt: string;
  width: 390;
  height: 844;
};

export function parseAppMarketingSearch(search: Record<string, unknown>): AppMarketingSearch {
  const lang = search.lang;
  return lang === "he" || lang === "ar" || lang === "en" ? { lang } : {};
}

export function resolveAppMarketingLang(
  explicitLang: unknown,
  savedLang: Lang = DEFAULT_LOCALE,
): Lang {
  return explicitLang === "he" || explicitLang === "ar" || explicitLang === "en"
    ? explicitLang
    : savedLang;
}

function asMarketingLang(value: unknown): AppMarketingLang | undefined {
  return value === "ar" || value === "he" || value === "en" ? value : undefined;
}

export function resolveMarketingLocale(input: {
  explicit?: unknown;
  saved?: unknown;
  accepted?: string | string[] | null;
}): AppMarketingLang {
  const explicitLang = asMarketingLang(input.explicit);
  if (explicitLang) return explicitLang;
  const saved = asMarketingLang(input.saved);
  if (saved) return saved;
  const accepted = Array.isArray(input.accepted)
    ? input.accepted
    : typeof input.accepted === "string"
      ? input.accepted.split(",")
      : [];
  const explicitRanges = new Map<AppMarketingLang, { quality: number; order: number }>();
  let wildcard: { quality: number; order: number } | undefined;
  accepted.forEach((candidate, order) => {
    const [rawLanguage, ...parameters] = candidate.trim().toLowerCase().split(";");
    const language = rawLanguage.split(/[-_]/, 1)[0];
    const qParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const parsedQuality = qParameter ? Number(qParameter.trim().slice(2)) : 1;
    if (!Number.isFinite(parsedQuality) || parsedQuality < 0 || parsedQuality > 1) return;
    const quality = parsedQuality;
    if (language === "*") {
      if (!wildcard || quality > wildcard.quality) {
        wildcard = { quality, order: wildcard?.order ?? order };
      }
      return;
    }
    const supported = asMarketingLang(language);
    if (supported && !explicitRanges.has(supported)) {
      explicitRanges.set(supported, { quality, order });
    } else if (supported) {
      const current = explicitRanges.get(supported);
      if (current && quality > current.quality) {
        explicitRanges.set(supported, { quality, order: current.order });
      }
    }
  });

  const ranked = APP_MARKETING_LANGS.map((language, fallbackOrder) => {
    const explicitCandidate = explicitRanges.get(language);
    const quality = explicitCandidate?.quality ?? wildcard?.quality;
    return {
      language,
      quality,
      order: explicitCandidate?.order ?? wildcard?.order ?? Number.MAX_SAFE_INTEGER,
      source: explicitCandidate ? "explicit" : "wildcard",
      fallbackOrder,
    };
  })
    .filter(({ quality }) => quality !== undefined && quality > 0)
    .sort((a, b) => {
      if (a.quality !== b.quality) return (b.quality ?? 0) - (a.quality ?? 0);
      if (a.source !== b.source) return a.source === "explicit" ? -1 : 1;
      if (a.source === "explicit") return a.order - b.order;
      return a.fallbackOrder - b.fallbackOrder;
    });
  if (ranked[0]) return ranked[0].language;
  return "ar";
}

export function resolveAppMarketingRedirect(input: {
  accepted?: string | string[] | null;
  explicit?: unknown;
  saved?: unknown;
  search: string | URLSearchParams;
}) {
  const lang = resolveMarketingLocale(input);
  return {
    lang,
    to: `/app/${lang}` as const,
    search: Object.fromEntries(sanitizeMarketingUtm(input.search)),
  };
}

export function isExplicitNativePlatformRequest(search: string | URLSearchParams): boolean {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  return params.get("platform") === "native";
}

const NATIVE_ROOT_USER_AGENT_TOKEN = "CloudCoreNative/1";

export function isNativeRootRequest(input: {
  search: string | URLSearchParams;
  userAgent: string | null;
}) {
  return (
    isExplicitNativePlatformRequest(input.search) ||
    input.userAgent?.split(/\s+/).includes(NATIVE_ROOT_USER_AGENT_TOKEN) === true
  );
}

export function resolveRootEntryRedirect(input: {
  role: AppRole | null | undefined;
  isExplicitNative: boolean;
}) {
  if (input.role) return roleHome(input.role);
  return input.isExplicitNative ? "/auth" : null;
}

export async function resolveRootEntryRedirectAfterAuth(input: {
  auth: Promise<{ role: AppRole } | null>;
  isExplicitNative: boolean;
}) {
  try {
    const auth = await input.auth;
    return resolveRootEntryRedirect({ role: auth?.role, isExplicitNative: input.isExplicitNative });
  } catch {
    return resolveRootEntryRedirect({ role: null, isExplicitNative: input.isExplicitNative });
  }
}

export function resolveRootPublicRedirect(input: {
  isNative: boolean;
  saved?: unknown;
  accepted?: string | string[] | null;
  search: string | URLSearchParams;
}): string {
  if (input.isNative) return "/auth";

  const decision = resolveAppMarketingRedirect(input);
  return buildMarketingHref(decision.to, input.search);
}

export const APP_MARKETING_COPY: Record<Lang, AppMarketingCopy> = {
  he: {
    headerAction: "כניסה לחשבון",
    storeAccessibleLabel: "הורדת Cloud & Core מה־App Store",
    hero: {
      eyebrow: "Cloud & Core Studio · חורפיש",
      title: "יוגה אווירית ופילאטיס, בקצב שלך",
      body: "צפי בלוח השיעורים, בחרי את החוג שמתאים לך, הזמיני מקום ועקבי אחרי המנוי והקרדיטים — הכול במקום אחד.",
      primaryCta: "צפייה בלוח והרשמה",
      storeCta: "הורדה מה־App Store",
      trust: "מתאים למתחילות · קבוצות קטנות · יחס אישי",
      offer: "",
      memberCta: "כבר חברה? כניסה לחשבון",
    },
    features: {
      eyebrow: "הכול קרוב",
      title: "הסטודיו שלך, בקצב שלך",
      items: [
        ["לוח שיעורים מעודכן", "צפי בשיעורים הקרובים, בשעות ובזמינות המקומות."],
        ["הרשמה קלה לשיעורים", "בחרי את השיעור שמתאים לך והזמיני מקום בכמה צעדים."],
        ["ניהול הזמנות", "עקבי אחרי ההזמנות הקרובות והשתמשי באפשרויות השינוי או הביטול הזמינות."],
        ["מעקב אחרי המנוי", "צפי בפרטי המנוי וביתרת הקרדיטים שנותרה."],
      ],
    },
    screenshots: {
      eyebrow: "בתוך האפליקציה",
      title: "כל מה שצריך, ברור ונגיש",
      headings: [
        "כל הלו״ז במקום אחד",
        "הרשמה לשיעור בשניות",
        "כל ההזמנות שלך מסודרות",
        "המנוי והקרדיטים תמיד ברורים",
        "ניהול פשוט מכל מקום",
      ],
    },
    classes: {
      eyebrow: "Cloud & Core בחורפיש",
      title: "תנועה, כוח ורוגע בקבוצות קטנות",
      body: "סטודיו בוטיק בחורפיש, עם קבוצות קטנות ויחס אישי בכל שיעור.",
      items: ["יוגה אווירית לנשים", "יוגה אווירית לילדים", "פילאטיס מזרן", "HOT Pilates"],
      descriptions: [
        "שיעורי יוגה אווירית לנשים ולמתחילות בחורפיש. אין צורך בניסיון קודם או בגמישות מיוחדת — השיעורים מתקיימים בקבוצות קטנות ועם יחס אישי.",
        "שיעורי יוגה אווירית לילדים מגיל 7, בקבוצות מותאמות לגיל ובליווי אישי בסטודיו Cloud & Core בחורפיש.",
        "אימוני פילאטיס מזרן לחיזוק הגוף, שיפור היציבה והתנועה, באווירה רגועה ובקבוצה קטנה.",
        "שיעור דינמי בחלל מחומם המשלב פילאטיס, כוח ותנועה, עם התאמות לרמות שונות.",
      ],
    },
    steps: {
      eyebrow: "פשוט להתחיל",
      title: "שלושה צעדים לשיעור הבא",
      items: ["פתחי חשבון", "בחרי שיעור", "אשרי את ההזמנה"],
    },
    finalCta: {
      title: "מוכנה לבחור את השיעור הבא שלך?",
      body: "פתחי את Cloud & Core, צפי בלו״ז והזמיני מקום.",
      actions: ["צפייה בלוח והרשמה", "הורדה מה־App Store", "כניסה לחשבון"],
    },
    trustSignals: {
      eyebrow: "Cloud & Core בחורפיש",
      title: "מה חשוב לדעת לפני שמתחילים",
      items: [
        "מתאים למתחילות",
        "קבוצות קטנות",
        "יחס אישי",
        "שיעורים לנשים",
        "ילדים מגיל 7",
        "חורפיש",
      ],
    },
    faq: [
      [
        "האם יוגה אווירית מתאימה למתחילות?",
        "כן. השיעורים מתאימים למתחילות ואין צורך בניסיון קודם.",
      ],
      ["האם צריך להיות גמישה?", "לא. אין צורך בגמישות מיוחדת כדי להתחיל."],
      ["מה צריך ללבוש לשיעור?", "כדאי לבחור בגדי אימון נוחים שמאפשרים תנועה חופשית."],
      [
        "מאיזה גיל אפשר להצטרף ליוגה אווירית לילדים?",
        "קבוצות יוגה אווירית לילדים מיועדות לילדים מגיל 7.",
      ],
      ["איך מזמינים שיעור ניסיון?", "צפי בלוח השיעורים באפליקציה, בחרי שיעור והזמיני מקום."],
      ["איפה נמצא הסטודיו?", "Cloud & Core Studio נמצא בחורפיש, בכביש הראשי 89."],
    ],
    footer: {
      location: "חורפיש, צפון ישראל",
      address: "חורפיש · כביש ראשי 89",
      support: "תמיכה",
      privacy: "פרטיות",
      terms: "תנאי שימוש",
      signIn: "כניסה לחשבון",
    },
  },
  ar: {
    headerAction: "سجّلي دخولك",
    storeAccessibleLabel: "حمّلي تطبيق Cloud & Core من App Store",
    hero: {
      eyebrow: "Cloud & Core Studio · حرفيش",
      title: "يوغا هوائية وبيلاتس، على إيقاعك",
      body: "شوفي جدول الحصص، اختاري الحصة المناسبة، احجزي مكانك وتابعي اشتراكك ورصيدك — كله بمكان واحد.",
      primaryCta: "شوفي الجدول واحجزي",
      storeCta: "حمّلي من App Store",
      trust: "مناسب للمبتدئات · مجموعات صغيرة · اهتمام شخصي",
      offer: "",
      memberCta: "عضوة بالاستوديو؟ سجّلي دخولك",
    },
    features: {
      eyebrow: "كل شيء قريب",
      title: "الاستوديو معك، على إيقاعك",
      items: [
        ["جدول حصص محدّث", "شوفي الحصص الجاية، المواعيد والأماكن المتاحة."],
        ["حجز سهل للحصص", "اختاري الحصة المناسبة واحجزي مكانك بخطوات بسيطة."],
        ["إدارة الحجوزات", "تابعي الحجوزات الجاية واستعملي خيارات التعديل أو الإلغاء المتاحة."],
        ["متابعة الاشتراك", "شوفي تفاصيل الاشتراك ورصيد الحصص المتبقي."],
      ],
    },
    screenshots: {
      eyebrow: "داخل التطبيق",
      title: "كل اللي تحتاجيه، واضح وقريب",
      headings: [
        "كل الجدول بمكان واحد",
        "احجزي حصتك بثواني",
        "كل حجوزاتك مرتّبة",
        "اشتراكك ورصيدك واضحين",
        "إدارة سهلة من أي مكان",
      ],
    },
    classes: {
      eyebrow: "Cloud & Core في حرفيش",
      title: "حركة، قوة وهدوء بمجموعات صغيرة",
      body: "استوديو بوتيك بحرفيش، بمجموعات صغيرة واهتمام شخصي بكل حصة.",
      items: ["يوغا هوائية للنساء", "يوغا هوائية للأطفال", "بيلاتس فرشات", "HOT Pilates"],
      descriptions: [
        "حصص يوغا هوائية للنساء والمبتدئات بحرفيش. مش لازم تكون عندك خبرة أو مرونة مسبقة — الحصص ضمن مجموعات صغيرة واهتمام شخصي.",
        "حصص يوغا هوائية للأطفال من عمر 7، ضمن مجموعات مناسبة للعمر وبإشراف شخصي في استوديو Cloud & Core بحرفيش.",
        "تمارين بيلاتس فرشات لتقوية الجسم، تحسين الثبات والحركة، ضمن أجواء هادئة ومجموعة صغيرة.",
        "حصة ديناميكية ببيئة دافئة تجمع بين تمارين البيلاتس، القوة والحركة، بمستويات مناسبة للمشاركات.",
      ],
    },
    steps: {
      eyebrow: "بسيط تبلّشي",
      title: "ثلاث خطوات لحصتك الجاية",
      items: ["افتحي حساب", "اختاري حصة", "أكّدي الحجز"],
    },
    finalCta: {
      title: "جاهزة تختاري حصتك الجاية؟",
      body: "افتحي Cloud & Core، شوفي الجدول واحجزي مكانك.",
      actions: ["شوفي الجدول واحجزي", "حمّلي من App Store", "سجّلي دخولك"],
    },
    trustSignals: {
      eyebrow: "Cloud & Core في حرفيش",
      title: "معلومات مهمة قبل ما تبلّشي",
      items: [
        "مناسب للمبتدئات",
        "مجموعات صغيرة",
        "اهتمام شخصي",
        "حصص للنساء",
        "للأطفال من عمر 7",
        "حرفيش",
      ],
    },
    faq: [
      [
        "هل اليوغا الهوائية مناسبة للمبتدئات؟",
        "نعم، الحصص مناسبة للمبتدئات ومش لازم تكون عندك خبرة مسبقة.",
      ],
      ["هل لازم أكون مرنة؟", "لا، مش لازم تكون عندك مرونة خاصة لتبلّشي."],
      ["شو لازم ألبس للحصة؟", "اختاري ملابس رياضية مريحة وتسمح بالحركة بحرية."],
      [
        "من أي عمر اليوغا الهوائية للأطفال؟",
        "مجموعات اليوغا الهوائية للأطفال مناسبة من عمر 7 سنوات.",
      ],
      ["كيف بحجز حصة تجريبية؟", "شوفي الجدول بالتطبيق، اختاري الحصة واحجزي مكانك."],
      ["وين موجود الاستوديو؟", "استوديو Cloud & Core موجود بحرفيش، الشارع الرئيسي 89."],
    ],
    footer: {
      location: "حرفيش، شمال إسرائيل",
      address: "حرفيش · الشارع الرئيسي 89",
      support: "الدعم",
      privacy: "الخصوصية",
      terms: "شروط الاستخدام",
      signIn: "سجّلي دخولك",
    },
  },
  en: {
    headerAction: "Sign In",
    storeAccessibleLabel: "Download Cloud & Core on the App Store",
    hero: {
      eyebrow: "Cloud & Core Studio · Hurfeish",
      title: "Aerial yoga and Pilates, at your pace",
      body: "View the schedule, choose your class, reserve your place, and track your membership and credits in one place.",
      primaryCta: "View Schedule and Book",
      storeCta: "Download on the App Store",
      trust: "Beginner friendly · Small groups · Personal attention",
      offer: "",
      memberCta: "Already a member? Sign in",
    },
    features: {
      eyebrow: "Everything close",
      title: "Your studio, at your pace",
      items: [
        ["Live Class Schedule", "View upcoming classes, times, and availability."],
        ["Easy Class Booking", "Choose a class and reserve your place in a few steps."],
        [
          "Booking Management",
          "View upcoming bookings and use the available change or cancellation options.",
        ],
        ["Membership Tracking", "View membership details and remaining class credits."],
      ],
    },
    screenshots: {
      eyebrow: "Inside the app",
      title: "Everything you need, clear and close",
      headings: [
        "Your Schedule in One Place",
        "Book a Class in Seconds",
        "Keep Every Booking Organized",
        "Track Membership and Credits",
        "Manage Everything Anywhere",
      ],
    },
    classes: {
      eyebrow: "Cloud & Core in Hurfeish",
      title: "Movement, strength and calm in small groups",
      body: "A boutique studio in Hurfeish, with small groups and personal attention in every class.",
      items: ["Aerial Yoga for Women", "Kids Aerial Yoga", "Mat Pilates", "HOT Pilates"],
      descriptions: [
        "Beginner-friendly aerial yoga classes for women in Hurfeish. No previous experience or exceptional flexibility is required.",
        "Aerial yoga classes for children aged 7 and above, with age-appropriate groups and personal guidance.",
        "Mat Pilates classes focused on strength, stability, posture, and controlled movement in a calm small-group setting.",
        "A dynamic class in a heated environment combining Pilates, strength, and movement with appropriate level adjustments.",
      ],
    },
    steps: {
      eyebrow: "Simple to begin",
      title: "Three steps to your next class",
      items: ["Create an account", "Choose a class", "Confirm your booking"],
    },
    finalCta: {
      title: "Ready to choose your next class?",
      body: "Open Cloud & Core, view the schedule, and reserve your place.",
      actions: ["View Schedule and Book", "Download on the App Store", "Sign In"],
    },
    trustSignals: {
      eyebrow: "Cloud & Core in Hurfeish",
      title: "What to know before you begin",
      items: [
        "Beginner friendly",
        "Small groups",
        "Personal attention",
        "Women’s classes",
        "Kids from age 7",
        "Hurfeish",
      ],
    },
    faq: [
      [
        "Is aerial yoga suitable for beginners?",
        "Yes. Classes are beginner-friendly, and no previous experience is required.",
      ],
      ["Do I need to be flexible?", "No. Exceptional flexibility is not required to get started."],
      ["What should I wear?", "Choose comfortable workout clothes that allow you to move freely."],
      [
        "What age can children join aerial yoga?",
        "Children’s aerial yoga groups are available from age 7.",
      ],
      [
        "How do I book a trial class?",
        "View the schedule in the app, choose a class, and reserve your place.",
      ],
      [
        "Where is the studio located?",
        "Cloud & Core Studio is located at Main Road 89 in Hurfeish.",
      ],
    ],
    footer: {
      location: "Hurfeish, North Israel",
      address: "Main Road 89, Hurfeish",
      support: "Support",
      privacy: "Privacy",
      terms: "Terms of Use",
      signIn: "Sign In",
    },
  },
};

export function getAppMarketingCopy(
  lang: AppMarketingLang,
  trialPrice?: number | null,
): AppMarketingCopy {
  const copy = APP_MARKETING_COPY[lang];
  if (trialPrice == null) return copy;
  const formattedTrialPrice = formatAppMarketingTrialPrice(trialPrice);
  const offer =
    lang === "ar"
      ? `حصة تجريبية بـ${formattedTrialPrice} ₪`
      : lang === "he"
        ? `שיעור ניסיון ב־${formattedTrialPrice} ₪`
        : `Trial class for ₪${formattedTrialPrice}`;
  const faqTrialAnswer =
    lang === "ar"
      ? `الحصة التجريبية بـ${formattedTrialPrice} ₪. شوفي الجدول بالتطبيق، اختاري الحصة واحجزي مكانك.`
      : lang === "he"
        ? `שיעור הניסיון עולה ${formattedTrialPrice} ₪. צפי בלוח השיעורים באפליקציה, בחרי שיעור והזמיני מקום.`
        : `The trial class is ₪${formattedTrialPrice}. View the schedule in the app, choose a class, and reserve your place.`;
  return {
    ...copy,
    hero: { ...copy.hero, offer },
    faq: copy.faq.map((item, index) => (index === 4 ? [item[0], faqTrialAnswer] : item)) as [
      string,
      string,
    ][],
  };
}

export function formatAppMarketingTrialPrice(trialPrice: number): string {
  return new Intl.NumberFormat("en-IL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(trialPrice);
}

export function normalizeAppMarketingAddress(address: string | null | undefined): string | null {
  const normalized = address?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function comparableAppMarketingAddress(address: string): string {
  return address.toLowerCase().replace(/[,.·]/g, "").replace(/\s+/g, "");
}

export function getAppMarketingAddressDisplay(
  localized: string,
  profileAddress: string | null | undefined,
): { localized: string; canonical: string | null } {
  const canonical = normalizeAppMarketingAddress(profileAddress);
  return {
    localized,
    canonical:
      canonical &&
      comparableAppMarketingAddress(canonical) !== comparableAppMarketingAddress(localized)
        ? canonical
        : null,
  };
}

const SCREENSHOT_KINDS: AppMarketingScreenshot["kind"][] = [
  "schedule",
  "booking",
  "bookings",
  "membership",
  "account",
];

const SCREENSHOT_ALTS: Record<Lang, [string, string, string, string, string]> = {
  he: [
    "לוח השיעורים באפליקציית Cloud & Core",
    "פרטי שיעור והרשמה באפליקציית Cloud & Core",
    "ההזמנות הקרובות באפליקציית Cloud & Core",
    "המנוי והקרדיטים באפליקציית Cloud & Core",
    "מסך הפרופיל באפליקציית Cloud & Core",
  ],
  ar: [
    "جدول الحصص في تطبيق Cloud & Core",
    "تفاصيل الحصة والحجز في تطبيق Cloud & Core",
    "الحجوزات القادمة في تطبيق Cloud & Core",
    "الاشتراك وأرصدة الحصص في تطبيق Cloud & Core",
    "صفحة الملف الشخصي في تطبيق Cloud & Core",
  ],
  en: [
    "Class schedule in the Cloud & Core app",
    "Class details and booking in the Cloud & Core app",
    "Upcoming bookings in the Cloud & Core app",
    "Membership and class credits in the Cloud & Core app",
    "Profile screen in the Cloud & Core app",
  ],
};

export function getAppMarketingScreenshots(lang: Lang): AppMarketingScreenshot[] {
  return SCREENSHOT_KINDS.map((kind, index) => ({
    kind,
    src: `/images/app-marketing/${lang}/${kind}.png`,
    alt: SCREENSHOT_ALTS[lang][index],
    width: 390 as const,
    height: 844 as const,
  }));
}

const APP_MARKETING_META: Record<AppMarketingLang, AppMarketingMeta> = {
  ar: {
    title: "Cloud & Core | يوغا هوائية وبيلاتس في حرفيش",
    description:
      "استوديو Cloud & Core في حرفيش لليوغا الهوائية، بيلاتس الفرشات و-HOT Pilates للنساء والأطفال. شوفي الجدول واحجزي من التطبيق.",
    locale: "ar_IL",
    canonical: APP_MARKETING_LOCALE_URLS.ar,
    canonicalUrl: APP_MARKETING_LOCALE_URLS.ar,
    ogImage: APP_MARKETING_OG_IMAGES.ar,
    image: APP_MARKETING_OG_IMAGES.ar,
  },
  he: {
    title: "Cloud & Core | יוגה אווירית ופילאטיס בחורפיש",
    description:
      "סטודיו Cloud & Core בחורפיש ליוגה אווירית, פילאטיס מזרן ו-HOT Pilates לנשים ולילדים. צפייה בלוח והרשמה דרך האפליקציה.",
    locale: "he_IL",
    canonical: APP_MARKETING_LOCALE_URLS.he,
    canonicalUrl: APP_MARKETING_LOCALE_URLS.he,
    ogImage: APP_MARKETING_OG_IMAGES.he,
    image: APP_MARKETING_OG_IMAGES.he,
  },
  en: {
    title: "Cloud & Core | Aerial Yoga & Pilates in Hurfeish",
    description:
      "Boutique aerial yoga, mat Pilates and HOT Pilates classes for women and children in Hurfeish. View the schedule and book through the Cloud & Core app.",
    locale: "en_US",
    canonical: APP_MARKETING_LOCALE_URLS.en,
    canonicalUrl: APP_MARKETING_LOCALE_URLS.en,
    ogImage: APP_MARKETING_OG_IMAGES.en,
    image: APP_MARKETING_OG_IMAGES.en,
  },
};

export function getAppMarketingMeta(lang: AppMarketingLang): AppMarketingMeta {
  return APP_MARKETING_META[lang];
}

export function getAppMarketingAlternates(lang: AppMarketingLang) {
  void lang;
  return [
    { rel: "alternate", hrefLang: "ar", href: APP_MARKETING_LOCALE_URLS.ar },
    { rel: "alternate", hrefLang: "he", href: APP_MARKETING_LOCALE_URLS.he },
    { rel: "alternate", hrefLang: "en", href: APP_MARKETING_LOCALE_URLS.en },
    { rel: "alternate", hrefLang: "x-default", href: APP_MARKETING_LOCALE_URLS.ar },
  ] as const;
}

export type AppMarketingStructuredDataInput = {
  lang: AppMarketingLang;
  trialPrice?: number | null;
  faqVisible?: boolean;
  profile?: AppMarketingPublicProfile;
};

export function buildAppMarketingStructuredData({
  lang,
  trialPrice,
  faqVisible = false,
  profile = {
    address: null,
    contactEmail: null,
    instagramUrl: null,
    publicPhone: null,
    whatsappNumber: null,
  },
}: AppMarketingStructuredDataInput) {
  const resolvedInstallUrl = APP_MARKETING_INSTALL_URL;
  const meta = getAppMarketingMeta(lang);
  const copy = getAppMarketingCopy(lang, trialPrice);
  const canonicalAddress = normalizeAppMarketingAddress(profile.address);
  const studioId = `${APP_MARKETING_BASE_URL}#studio`;
  const appId = `${APP_MARKETING_BASE_URL}#app`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HealthClub",
        "@id": studioId,
        name: "Cloud & Core Studio",
        alternateName: "Cloud & Core",
        url: APP_MARKETING_BASE_URL,
        logo: "https://cloudandcorestudio.com/brand/cloud-core-logo-full.webp",
        image: meta.ogImage,
        telephone: profile.publicPhone ?? "055-939-8438",
        email: profile.contactEmail ?? "cloudandcorestudio@gmail.com",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Main Road 89",
          addressLocality: "Hurfeish",
          addressCountry: "IL",
          ...(canonicalAddress ? { name: canonicalAddress } : {}),
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 33.016109,
          longitude: 35.349285,
        },
        availableLanguage: ["ar", "he", "en"],
        makesOffer: copy.classes.items.map((name) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name },
        })),
        ...(profile.instagramUrl ? { sameAs: [profile.instagramUrl] } : {}),
      },
      {
        "@type": "SoftwareApplication",
        "@id": appId,
        name: "Cloud & Core",
        description: meta.description,
        applicationCategory: "HealthApplication",
        operatingSystem: "iOS",
        url: meta.canonical,
        installUrl: resolvedInstallUrl,
        downloadUrl: resolvedInstallUrl,
        image: APP_MARKETING_APP_ICON,
        publisher: { "@id": studioId },
      },
      ...(faqVisible
        ? [
            {
              "@type": "FAQPage",
              "@id": `${meta.canonical}#faq`,
              url: meta.canonical,
              mainEntity: copy.faq.map(([name, text]) => ({
                "@type": "Question",
                name,
                acceptedAnswer: { "@type": "Answer", text },
              })),
            },
          ]
        : []),
    ],
  };
}
