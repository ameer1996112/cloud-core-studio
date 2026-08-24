import { DEFAULT_LOCALE, type Lang } from "@/lib/i18n";

export const APP_MARKETING_CANONICAL_URL = "https://cloudandcorestudio.com/app";
export const APP_MARKETING_OG_IMAGE =
  "https://cloudandcorestudio.com/images/auth/cloud-core-auth-hero.webp";
export const APP_MARKETING_LANGS = ["ar", "he", "en"] as const;
export type AppMarketingLang = (typeof APP_MARKETING_LANGS)[number];
const APP_MARKETING_BASE_URL = APP_MARKETING_CANONICAL_URL;
export const APP_MARKETING_INSTALL_URL = "https://apps.apple.com/app/id6786035836";
export const APP_MARKETING_TRIAL_PRICE_ILS = 80;
const APP_MARKETING_LOCALE_URLS: Record<AppMarketingLang, string> = {
  ar: `${APP_MARKETING_BASE_URL}/ar`,
  he: `${APP_MARKETING_BASE_URL}/he`,
  en: `${APP_MARKETING_BASE_URL}/en`,
};
export const APP_MARKETING_OG_IMAGES: Record<AppMarketingLang, string> = {
  ar: "https://cloudandcorestudio.com/images/app-marketing/ar/social.webp",
  he: "https://cloudandcorestudio.com/images/app-marketing/he/social.webp",
  en: "https://cloudandcorestudio.com/images/app-marketing/en/social.webp",
};
export const APP_STORE_BADGE_PATHS: Record<Lang, string> = {
  he: "/brand/app-store-badges/he.svg",
  ar: "/brand/app-store-badges/ar.svg",
  en: "/brand/app-store-badges/en.svg",
};

export type AppMarketingSearch = { lang?: Lang };

export type AppMarketingPublicProfile = {
  address: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
  publicPhone: string | null;
  whatsappNumber: string | null;
};

export type AppMarketingCopy = {
  headerAction: string;
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
  finalCta: { title: string; body: string };
  faq: [string, string][];
  footer: { location: string; support: string; privacy: string; terms: string; signIn: string };
};

export type AppMarketingMeta = {
  title: string;
  description: string;
  locale: "he_IL" | "ar_AR" | "en_US";
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
  const explicit = asMarketingLang(input.explicit);
  if (explicit) return explicit;
  const saved = asMarketingLang(input.saved);
  if (saved) return saved;
  const accepted = Array.isArray(input.accepted)
    ? input.accepted
    : typeof input.accepted === "string"
      ? input.accepted.split(",")
      : [];
  for (const candidate of accepted) {
    const lang = candidate.trim().toLowerCase().split(/[-_;]/, 1)[0];
    if (asMarketingLang(lang)) return lang;
  }
  return "ar";
}

const APPROVED_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
] as const;

export function sanitizeMarketingUtm(input: string | URLSearchParams): URLSearchParams {
  const source = typeof input === "string" ? new URLSearchParams(input.replace(/^\?/, "")) : input;
  const result = new URLSearchParams();
  for (const key of APPROVED_UTM_KEYS) {
    const value = source.get(key);
    if (value !== null && value !== "") result.set(key, value);
  }
  return result;
}

export function buildMarketingHref(path: string, utm?: string | URLSearchParams): string {
  if (!utm) return path;
  const clean = sanitizeMarketingUtm(utm);
  const query = clean.toString();
  if (!query) return path;
  const separator = path.includes("?")
    ? path.endsWith("?") || path.endsWith("&")
      ? ""
      : "&"
    : "?";
  return `${path}${separator}${query}`;
}

export const APP_MARKETING_COPY: Record<Lang, AppMarketingCopy> = {
  he: {
    headerAction: "פתיחת האפליקציה",
    hero: {
      eyebrow: "Cloud & Core Studio · חורפיש",
      title: "יוגה אווירית ופילאטיס בחורפיש — הרשמה קלה דרך האפליקציה",
      body: "צפי בלוח השיעורים, בחרי את החוג שמתאים לך, הזמיני מקום ועקבי אחרי המנוי והקרדיטים — הכול במקום אחד.",
      primaryCta: "צפייה בלוח והרשמה",
      storeCta: "הורדה מ־App Store",
      trust: "מתאים למתחילות · קבוצות קטנות · יחס אישי",
      offer: "שיעור ניסיון ב־80 ₪",
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
      support: "תמיכה",
      privacy: "פרטיות",
      terms: "תנאי שימוש",
      signIn: "פתיחת האפליקציה",
    },
  },
  ar: {
    headerAction: "افتحي التطبيق",
    hero: {
      eyebrow: "Cloud & Core Studio · حرفيش",
      title: "يوغا هوائية وبيلاتس بحرفيش — الحجز بسهولة من التطبيق",
      body: "شوفي جدول الحصص، اختاري الحصة المناسبة، احجزي مكانك وتابعي اشتراكك ورصيدك — كله بمكان واحد.",
      primaryCta: "شوفي الجدول واحجزي",
      storeCta: "حمّلي من App Store",
      trust: "مناسب للمبتدئات · مجموعات صغيرة · اهتمام شخصي",
      offer: "حصة تجريبية بـ80 ₪",
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
      support: "الدعم",
      privacy: "الخصوصية",
      terms: "شروط الاستخدام",
      signIn: "افتحي التطبيق",
    },
  },
  en: {
    headerAction: "Open the app",
    hero: {
      eyebrow: "Cloud & Core Studio · Hurfeish",
      title: "Aerial Yoga and Pilates in Hurfeish — Easy Booking Through the App",
      body: "View the schedule, choose your class, reserve your place, and track your membership and credits in one place.",
      primaryCta: "View Schedule and Book",
      storeCta: "Download on the App Store",
      trust: "Beginner friendly · Small groups · Personal attention",
      offer: "Trial class for ₪80",
      memberCta: "Already a member? Sign in",
    },
    features: {
      eyebrow: "Everything close",
      title: "Your studio, at your pace",
      items: [
        ["Live Class Schedule", "View upcoming classes, times, and availability."],
        ["Easy Class Booking", "Choose a class and reserve your place in a few steps."],
        [
          "Booking management",
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
      body: "Open Cloud & Core, view the schedule and reserve your place.",
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
      support: "Support",
      privacy: "Privacy",
      terms: "Terms of Use",
      signIn: "Open the app",
    },
  },
};

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
    locale: "ar_AR",
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
    { hrefLang: "ar", href: APP_MARKETING_LOCALE_URLS.ar },
    { hrefLang: "he", href: APP_MARKETING_LOCALE_URLS.he },
    { hrefLang: "en", href: APP_MARKETING_LOCALE_URLS.en },
    { hrefLang: "x-default", href: APP_MARKETING_LOCALE_URLS.ar },
  ] as const;
}

export type AppMarketingStructuredDataInput = {
  lang: AppMarketingLang;
  installUrl?: string;
  /** @deprecated Use installUrl; retained for existing route compatibility. */
  appStoreUrl?: string;
  profile?: AppMarketingPublicProfile;
};

export function buildAppMarketingStructuredData({
  lang,
  installUrl,
  appStoreUrl,
  profile = {
    address: null,
    contactEmail: null,
    instagramUrl: null,
    publicPhone: null,
    whatsappNumber: null,
  },
}: AppMarketingStructuredDataInput) {
  const resolvedInstallUrl = installUrl ?? appStoreUrl ?? APP_MARKETING_INSTALL_URL;
  const meta = getAppMarketingMeta(lang);
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
          ...(profile.address ? { name: profile.address } : {}),
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 33.016109,
          longitude: 35.349285,
        },
        availableLanguage: ["ar", "he", "en"],
        makesOffer: APP_MARKETING_COPY[lang].classes.items.map((name) => ({
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
        image: meta.ogImage,
        publisher: { "@id": studioId },
      },
      {
        "@type": "FAQPage",
        "@id": `${meta.canonical}#faq`,
        url: meta.canonical,
        mainEntity: APP_MARKETING_COPY[lang].faq.map(([name, text]) => ({
          "@type": "Question",
          name,
          acceptedAnswer: { "@type": "Answer", text },
        })),
      },
    ],
  };
}
