import type { Lang } from "@/lib/i18n";
const GUEST_SCHEDULE_WINDOW_DAYS = 14;

type GuestScheduleCopy = {
  eyebrow: string;
  title: string;
  body: string;
  panelEyebrow: string;
  panelTitle: string;
  panelBody: string;
  scheduleHint: string;
  primaryCta: string;
  secondaryCta: string;
  statClasses: string;
  statWindow: string;
  statAccess: string;
};

export const GUEST_SCHEDULE_COPY: Record<Lang, GuestScheduleCopy> = {
  en: {
    eyebrow: "Guest schedule preview",
    title: "See the studio rhythm before you sign in.",
    body: "Browse the next two weeks of movement, filter the live schedule, and step into Cloud & Core when you are ready to book.",
    panelEyebrow: "Schedule preview",
    panelTitle: "Current availability",
    panelBody:
      "Full classes stay visible here, and signing in is the next step before booking or waitlist access.",
    scheduleHint:
      "Use filters to scan the live schedule. Sign in only when you are ready to reserve.",
    primaryCta: "Sign in to book",
    secondaryCta: "Talk to support",
    statClasses: "Open classes",
    statWindow: "Preview window",
    statAccess: "Guest access",
  },
  he: {
    eyebrow: "תצוגת לו״ז לאורחות",
    title: "לראות את קצב הסטודיו עוד לפני ההתחברות.",
    body: "אפשר לעבור על השבועיים הקרובים, לסנן את הלו״ז החי, ולהתחבר ל-Cloud & Core כשתרצי להזמין.",
    panelEyebrow: "תצוגת לו״ז",
    panelTitle: "זמינות נוכחית",
    panelBody: "שיעורים מלאים נשארים גלויים כאן, והשלב הבא לפני הזמנה או רשימת המתנה הוא התחברות.",
    scheduleHint: "המסננים פתוחים לצפייה חיה. מתחברות רק כשמוכנות להשלים הזמנה.",
    primaryCta: "התחברות להזמנה",
    secondaryCta: "שיחה עם התמיכה",
    statClasses: "שיעורים פתוחים",
    statWindow: "חלון צפייה",
    statAccess: "גישת אורחת",
  },
  ar: {
    eyebrow: "معاينة جدول للضيفة",
    title: "شاهدي إيقاع الاستوديو قبل تسجيل الدخول.",
    body: "تصفحي الأسبوعين القادمين، صفّي الجدول المباشر، وادخلي إلى Cloud & Core عندما تكونين جاهزة للحجز.",
    panelEyebrow: "معاينة الجدول",
    panelTitle: "التوفر الحالي",
    panelBody:
      "تبقى الحصص الممتلئة ظاهرة هنا، وتسجيل الدخول هو الخطوة التالية قبل الحجز أو الانتظار.",
    scheduleHint:
      "استخدمي الفلاتر لمراجعة الجدول المباشر. سجلي الدخول فقط عندما تكونين جاهزة للحجز.",
    primaryCta: "تسجيل الدخول للحجز",
    secondaryCta: "التواصل مع الدعم",
    statClasses: "حصص متاحة",
    statWindow: "مدة المعاينة",
    statAccess: "دخول الضيفة",
  },
};

export const GUEST_SCHEDULE_STATS: Record<
  Lang,
  { windowValue: string; accessValue: string; accessNote: string }
> = {
  en: {
    windowValue: `${GUEST_SCHEDULE_WINDOW_DAYS} days`,
    accessValue: "Open preview",
    accessNote: "Public browsing now, sign-in ready booking when you want to reserve.",
  },
  he: {
    windowValue: `${GUEST_SCHEDULE_WINDOW_DAYS} ימים`,
    accessValue: "פתוחה",
    accessNote: "צפייה פתוחה עכשיו, והתחברות אחת כשרוצים לעבור להזמנה.",
  },
  ar: {
    windowValue: `${GUEST_SCHEDULE_WINDOW_DAYS} يومًا`,
    accessValue: "مفتوح",
    accessNote: "تصفح عام الآن، وتسجيل دخول جاهز عندما ترغبين في تثبيت الحجز.",
  },
};
