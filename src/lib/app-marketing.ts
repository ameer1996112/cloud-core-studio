import { DEFAULT_LOCALE, type Lang } from "@/lib/i18n";

export const APP_MARKETING_CANONICAL_URL = "https://cloudandcorestudio.com/app";
export const APP_MARKETING_OG_IMAGE =
  "https://cloudandcorestudio.com/images/auth/cloud-core-auth-hero.webp";
export const APP_STORE_BADGE_ASSETS: Record<Lang, { src: string; width: number; height: number }> =
  {
    he: { src: "/brand/app-store-badges/he.svg", width: 122, height: 42 },
    ar: { src: "/brand/app-store-badges/ar.svg", width: 120, height: 40 },
    en: { src: "/brand/app-store-badges/en.svg", width: 120, height: 40 },
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
  hero: { eyebrow: string; title: string; body: string; primaryCta: string; storeCta: string };
  features: { eyebrow: string; title: string; items: [string, string][] };
  screenshots: { eyebrow: string; title: string };
  classes: { eyebrow: string; title: string; body: string; items: string[] };
  steps: { eyebrow: string; title: string; items: [string, string, string] };
  finalCta: { title: string; body: string };
  footer: { location: string; support: string; privacy: string; terms: string; signIn: string };
};

export type AppMarketingMeta = {
  title: string;
  description: string;
  locale: "he_IL" | "ar_AR" | "en_US";
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

export const APP_MARKETING_COPY: Record<Lang, AppMarketingCopy> = {
  he: {
    headerAction: "פתיחת האפליקציה",
    hero: {
      eyebrow: "האפליקציה של Cloud & Core",
      title: "כל השיעורים, ההזמנות והמנוי שלך במקום אחד.",
      body: "צפייה בלו״ז, הרשמה לשיעורים, ניהול הזמנות ומעקב אחרי המנוי — בקלות ובכל זמן.",
      primaryCta: "פתיחת האפליקציה",
      storeCta: "הורדה מ־App Store",
    },
    features: {
      eyebrow: "הכול קרוב",
      title: "הסטודיו שלך, בקצב שלך",
      items: [
        ["לוח שיעורים מעודכן", "לראות את השיעורים הקרובים ואת מספר המקומות הזמינים."],
        ["הרשמה קלה לשיעורים", "לבחור שיעור פנוי ולשמור מקום בכמה צעדים פשוטים."],
        ["ניהול הזמנות", "לצפות בהזמנות הקרובות ולהשתמש באפשרויות השינוי או הביטול הזמינות."],
        ["מעקב אחרי המנוי", "לראות את פרטי המנוי וכמה קרדיטים נשארו."],
      ],
    },
    screenshots: { eyebrow: "בתוך האפליקציה", title: "כל מה שצריך, ברור ונגיש" },
    classes: {
      eyebrow: "Cloud & Core בחורפיש",
      title: "תנועה, כוח ורוגע בקבוצות קטנות",
      body: "סטודיו בוטיק בחורפיש, עם קבוצות קטנות ויחס אישי בכל שיעור.",
      items: ["יוגה אווירית לנשים", "יוגה אווירית לילדים", "פילאטיס מזרן", "HOT Pilates"],
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
      eyebrow: "تطبيق Cloud & Core",
      title: "كل الحصص، الحجوزات والاشتراك بمكان واحد.",
      body: "شاهدي الجدول، احجزي الحصص، ديري حجوزاتك وتابعي اشتراكك بسهولة وبأي وقت.",
      primaryCta: "افتحي التطبيق",
      storeCta: "حمّلي من App Store",
    },
    features: {
      eyebrow: "كل شيء قريب",
      title: "الاستوديو معك، على إيقاعك",
      items: [
        ["جدول حصص محدّث", "شوفي الحصص الجاية والأماكن المتاحة بكل لحظة."],
        ["حجز سهل للحصص", "اختاري حصة متاحة وثبّتي مكانك بخطوات بسيطة."],
        ["إدارة الحجوزات", "راجعي حجوزاتك الجاية واستخدمي خيارات التعديل أو الإلغاء المتاحة."],
        ["متابعة الاشتراك", "شوفي تفاصيل اشتراكك وعدد أرصدة الحصص المتبقية."],
      ],
    },
    screenshots: { eyebrow: "داخل التطبيق", title: "كل اللي تحتاجيه، واضح وقريب" },
    classes: {
      eyebrow: "Cloud & Core في حرفيش",
      title: "حركة، قوة وهدوء بمجموعات صغيرة",
      body: "استوديو بوتيك بحرفيش، بمجموعات صغيرة واهتمام شخصي بكل حصة.",
      items: ["يوغا هوائية للنساء", "يوغا هوائية للأطفال", "بيلاتس فرشات", "HOT Pilates"],
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
      eyebrow: "The Cloud & Core App",
      title: "Classes, bookings and membership in one place.",
      body: "View the schedule, reserve classes, manage bookings and track your membership with ease.",
      primaryCta: "Open the app",
      storeCta: "Download on the App Store",
    },
    features: {
      eyebrow: "Everything close",
      title: "Your studio, at your pace",
      items: [
        ["Live class schedule", "See upcoming classes and current availability."],
        ["Easy class booking", "Reserve an available class in a few simple steps."],
        [
          "Booking management",
          "Review upcoming bookings and use the available change or cancellation options.",
        ],
        ["Membership tracking", "View membership details and remaining class credits."],
      ],
    },
    screenshots: { eyebrow: "Inside the app", title: "Everything you need, clear and close" },
    classes: {
      eyebrow: "Cloud & Core in Hurfeish",
      title: "Movement, strength and calm in small groups",
      body: "A boutique studio in Hurfeish, with small groups and personal attention in every class.",
      items: ["Aerial Yoga for Women", "Kids Aerial Yoga", "Mat Pilates", "HOT Pilates"],
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

const APP_MARKETING_META: Record<Lang, AppMarketingMeta> = {
  he: {
    title: "אפליקציית Cloud & Core | יוגה אווירית ופילאטיס",
    description:
      "צפייה בלוח השיעורים של Cloud & Core, הרשמה ליוגה אווירית ופילאטיס, ניהול הזמנות ומעקב אחרי המנוי.",
    locale: "he_IL",
  },
  ar: {
    title: "تطبيق Cloud & Core | يوغا هوائية وبيلاتس",
    description:
      "شاهدي جدول Cloud & Core، احجزي اليوغا الهوائية والبيلاتس، ديري حجوزاتك وتابعي اشتراكك.",
    locale: "ar_AR",
  },
  en: {
    title: "Cloud & Core App | Aerial Yoga & Pilates",
    description:
      "View the Cloud & Core class schedule, book aerial yoga and Pilates sessions, manage reservations and track your membership.",
    locale: "en_US",
  },
};

export function getAppMarketingMeta(lang: Lang): AppMarketingMeta {
  return APP_MARKETING_META[lang];
}

type AppMarketingStructuredDataInput = {
  lang: Lang;
  appStoreUrl: string;
  profile: AppMarketingPublicProfile;
};

export function buildAppMarketingStructuredData({
  lang,
  appStoreUrl,
  profile,
}: AppMarketingStructuredDataInput) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${APP_MARKETING_CANONICAL_URL}#app`,
        name:
          lang === "he"
            ? "אפליקציית Cloud & Core"
            : lang === "ar"
              ? "تطبيق Cloud & Core"
              : "Cloud & Core App",
        description: getAppMarketingMeta(lang).description,
        applicationCategory: "HealthApplication",
        operatingSystem: "iPhone",
        url: APP_MARKETING_CANONICAL_URL,
        downloadUrl: appStoreUrl,
        image: APP_MARKETING_OG_IMAGE,
        publisher: { "@id": `${APP_MARKETING_CANONICAL_URL}#studio` },
      },
      {
        "@type": "HealthAndBeautyBusiness",
        "@id": `${APP_MARKETING_CANONICAL_URL}#studio`,
        name: "Cloud & Core Studio",
        url: "https://cloudandcorestudio.com",
        image: APP_MARKETING_OG_IMAGE,
        ...(profile.address ? { address: profile.address } : {}),
        ...(profile.publicPhone ? { telephone: profile.publicPhone } : {}),
        ...(profile.contactEmail ? { email: profile.contactEmail } : {}),
        ...(profile.instagramUrl ? { sameAs: [profile.instagramUrl] } : {}),
      },
    ],
  };
}
