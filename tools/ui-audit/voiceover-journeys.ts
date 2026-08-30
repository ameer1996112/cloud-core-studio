import type { AuditLanguage } from "./types";
import type { InteractionJourney } from "./InteractionFixture";

export const VOICEOVER_JOURNEYS = [
  "auth",
  "booking",
  "cancellation",
  "payment-result",
  "instructor-attendance",
  "admin-destructive-confirmation",
  "global-navigation",
] as const;

export type VoiceOverJourney = (typeof VOICEOVER_JOURNEYS)[number];

type AccessibleControl = {
  role: "button" | "field" | "group" | "link" | "textbox";
  name: string;
};
type VoiceOverJourneyCopy = {
  heading: string;
  controls: readonly AccessibleControl[];
  status?: string;
  primaryAction?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  dialogKeep?: string;
  dialogConfirm?: string;
  outcome?: string;
  tableName?: string;
  tableHeaders?: readonly string[];
  imageAlt?: string;
};

export const voiceOverJourneyCopy = {
  auth: {
    he: {
      heading: "כניסה לסטודיו",
      controls: [
        { role: "textbox", name: "אימייל" },
        { role: "field", name: "סיסמה" },
        { role: "button", name: "כניסה לסטודיו" },
      ],
    },
    ar: {
      heading: "دخول الاستوديو",
      controls: [
        { role: "textbox", name: "البريد الإلكتروني" },
        { role: "field", name: "كلمة المرور" },
        { role: "button", name: "دخول الاستوديو" },
      ],
    },
    en: {
      heading: "Enter the studio",
      controls: [
        { role: "textbox", name: "Email" },
        { role: "field", name: "Password" },
        { role: "button", name: "Enter the studio" },
      ],
    },
  },
  booking: {
    he: {
      heading: "מסלול הזמנה",
      controls: [
        { role: "button", name: "יוגה אווירית, 12:00, פרטים והרשמה" },
        { role: "button", name: "הזמנת שיעור" },
      ],
      status: "4 מתוך 8 מקומות זמינים.",
      primaryAction: "הזמנת שיעור",
      outcome: "ההזמנה נקלטה",
    },
    ar: {
      heading: "مسار الحجز",
      controls: [
        { role: "button", name: "يوغا هوائية, 12:00, التفاصيل والتسجيل" },
        { role: "button", name: "حجز الحصة" },
      ],
      status: "4 من أصل 8 أماكن متاحة.",
      primaryAction: "حجز الحصة",
      outcome: "تم استلام الحجز",
    },
    en: {
      heading: "Booking journey",
      controls: [
        { role: "button", name: "Aerial Yoga, 12:00, Details & booking" },
        { role: "button", name: "Book class" },
      ],
      status: "4 of 8 spots available.",
      primaryAction: "Book class",
      outcome: "Booking received",
    },
  },
  cancellation: {
    he: {
      heading: "מסלול ביטול",
      controls: [{ role: "button", name: "פתיחת ביטול הזמנה" }],
      status: "אפשר לבטל עד שבת בשעה 05:00.",
      dialogTitle: "לבטל את ההזמנה?",
      dialogDescription: "קרדיט אחד יחזור ליתרה שלך.",
      dialogKeep: "להשאיר הזמנה",
      dialogConfirm: "ביטול הזמנה",
      outcome: "ההזמנה בוטלה",
    },
    ar: {
      heading: "مسار الإلغاء",
      controls: [{ role: "button", name: "فتح إلغاء الحجز" }],
      status: "يمكن الإلغاء حتى السبت الساعة 05:00.",
      dialogTitle: "إلغاء هذا الحجز؟",
      dialogDescription: "سيعود رصيد واحد إلى رصيدك.",
      dialogKeep: "الإبقاء على الحجز",
      dialogConfirm: "إلغاء الحجز",
      outcome: "تم إلغاء الحجز",
    },
    en: {
      heading: "Cancellation journey",
      controls: [{ role: "button", name: "Open booking cancellation" }],
      status: "Cancellation is available until Saturday at 05:00.",
      dialogTitle: "Cancel this booking?",
      dialogDescription: "One credit will be returned to your balance.",
      dialogKeep: "Keep booking",
      dialogConfirm: "Cancel booking",
      outcome: "Booking cancelled",
    },
  },
  "payment-result": {
    he: { heading: "התשלום התקבל", controls: [], status: "סטטוס התשלום מאושר." },
    ar: { heading: "تم استلام الدفع", controls: [], status: "حالة الدفع مؤكدة." },
    en: {
      heading: "Payment received",
      controls: [],
      status: "The payment status is confirmed.",
    },
  },
  "instructor-attendance": {
    he: {
      heading: "רשימת נוכחות",
      controls: [{ role: "textbox", name: "סינון רשימת נוכחות" }],
      status: "מוזמן/ת",
      tableName: "רשימת נוכחות",
      tableHeaders: ["חבר/ה", "טלפון", "סטטוס"],
    },
    ar: {
      heading: "قائمة الحضور",
      controls: [{ role: "textbox", name: "تصفية قائمة الحضور" }],
      status: "محجوز",
      tableName: "قائمة الحضور",
      tableHeaders: ["العضو/ة", "الهاتف", "الحالة"],
    },
    en: {
      heading: "Attendance roster",
      controls: [{ role: "textbox", name: "Filter attendance roster" }],
      status: "Booked",
      tableName: "Attendance roster",
      tableHeaders: ["Member", "Phone", "Status"],
    },
  },
  "admin-destructive-confirmation": {
    he: {
      heading: "מסלול אישור ניהולי",
      controls: [{ role: "button", name: "פתיחת אישור ביטול" }],
      dialogTitle: "לבטל את שיעור הבדיקה?",
      dialogDescription: "התרחיש בודק רק מקלדת ומיקוד. לא משתנים נתונים.",
      dialogKeep: "ביטול",
      dialogConfirm: "אישור ביטול",
    },
    ar: {
      heading: "مسار التأكيد الإداري",
      controls: [{ role: "button", name: "فتح تأكيد الإلغاء" }],
      dialogTitle: "إلغاء حصة الاختبار؟",
      dialogDescription: "يفحص هذا المسار لوحة المفاتيح والتركيز فقط. لا تتغير أي بيانات.",
      dialogKeep: "إلغاء",
      dialogConfirm: "تأكيد الإلغاء",
    },
    en: {
      heading: "Admin confirmation journey",
      controls: [{ role: "button", name: "Open cancellation confirmation" }],
      dialogTitle: "Cancel the test class?",
      dialogDescription: "This flow checks keyboard and focus behavior only. No data is changed.",
      dialogKeep: "Cancel",
      dialogConfirm: "Confirm cancellation",
    },
  },
  "global-navigation": {
    he: {
      heading: "כל השיעורים, ההזמנות והמנוי שלך במקום אחד.",
      controls: [
        { role: "group", name: "בחירת שפה" },
        { role: "link", name: "פתיחת האפליקציה" },
        { role: "link", name: "הורדה מ־App Store" },
      ],
      imageAlt: "סטודיו Cloud & Core עם ערסלי יוגה אווירית",
    },
    ar: {
      heading: "كل الحصص، الحجوزات والاشتراك بمكان واحد.",
      controls: [
        { role: "group", name: "اختيار اللغة" },
        { role: "link", name: "افتحي التطبيق" },
        { role: "link", name: "حمّلي من App Store" },
      ],
      imageAlt: "استوديو Cloud & Core لليوغا الهوائية",
    },
    en: {
      heading: "Classes, bookings and membership in one place.",
      controls: [
        { role: "group", name: "Choose language" },
        { role: "link", name: "Open the app" },
        { role: "link", name: "Download on the App Store" },
      ],
      imageAlt: "Cloud & Core aerial yoga studio",
    },
  },
} as const satisfies Record<VoiceOverJourney, Record<AuditLanguage, VoiceOverJourneyCopy>>;

type VoiceOverJourneyTarget = {
  scenarioId: string;
  interactionJourney?: Exclude<InteractionJourney, "all">;
};

export const voiceOverJourneyTargets = {
  auth: { scenarioId: "guest-auth-default" },
  booking: {
    scenarioId: "guest-member-schedule-default",
    interactionJourney: "booking",
  },
  cancellation: {
    scenarioId: "guest-member-schedule-default",
    interactionJourney: "cancellation",
  },
  "payment-result": { scenarioId: "guest-payment-result-status-success-success" },
  "instructor-attendance": {
    scenarioId: "guest-member-schedule-default",
    interactionJourney: "instructor-attendance",
  },
  "admin-destructive-confirmation": {
    scenarioId: "guest-member-schedule-default",
    interactionJourney: "admin-destructive-confirmation",
  },
  "global-navigation": { scenarioId: "guest-app-default" },
} as const satisfies Record<VoiceOverJourney, VoiceOverJourneyTarget>;

export function voiceOverJourneyQuery(journey: VoiceOverJourney, language: AuditLanguage): string {
  const target = voiceOverJourneyTargets[journey];
  const query = new URLSearchParams({
    scenario: target.scenarioId,
    language,
    evidence: "1",
  });
  if ("interactionJourney" in target) {
    query.set("interaction", "1");
    query.set("journey", target.interactionJourney);
  }
  return `/?${query.toString()}`;
}

export function expectedVoiceOverJourneyChecks(
  journey: VoiceOverJourney,
  language: AuditLanguage,
): string[] {
  const expected = voiceOverJourneyCopy[journey][language];
  const direction = language === "en" ? "ltr" : "rtl";
  const checks = [
    `document:${language}/${direction}`,
    `heading:${expected.heading}`,
    ...expected.controls.map((control) => `${control.role}:${control.name}`),
  ];
  if (expected.status) checks.push(`live-status:${expected.status}`);
  if (expected.tableName) checks.push(`table:${expected.tableName}`);
  for (const header of expected.tableHeaders ?? []) checks.push(`columnheader:${header}`);
  if (expected.imageAlt) checks.push(`image:${expected.imageAlt}`);
  if (journey === "booking") checks.push(`focus:${expected.controls[0].name}`);
  if (journey === "booking" && expected.outcome) checks.push(`outcome-status:${expected.outcome}`);
  if (
    journey === "cancellation" &&
    expected.dialogTitle &&
    expected.dialogDescription &&
    expected.dialogKeep &&
    expected.dialogConfirm &&
    expected.outcome
  )
    checks.push(
      `dialog:${expected.dialogTitle}`,
      `dialog-description:${expected.dialogDescription}`,
      `dialog-control:${expected.dialogKeep}`,
      `dialog-control:${expected.dialogConfirm}`,
      `dialog-initial-focus:${expected.dialogKeep}`,
      `outcome-status:${expected.outcome}`,
    );
  if (
    journey === "admin-destructive-confirmation" &&
    expected.dialogTitle &&
    expected.dialogDescription &&
    expected.dialogKeep &&
    expected.dialogConfirm
  )
    checks.push(
      `alertdialog:${expected.dialogTitle}`,
      `dialog-description:${expected.dialogDescription}`,
      `dialog-control:${expected.dialogKeep}`,
      `dialog-control:${expected.dialogConfirm}`,
      `dialog-initial-focus:${expected.dialogKeep}`,
      "dialog-escape-close",
    );
  checks.push("locale-policy:complete-visible-accessible-strings");
  return checks;
}

export function expectedVoiceOverManualObservations(
  journey: VoiceOverJourney,
  language: AuditLanguage,
): string[] {
  const expected = voiceOverJourneyCopy[journey][language];
  const direction = language === "en" ? "ltr" : "rtl";
  const observations = [`document:${language}/${direction}`, `heading:${expected.heading}`];
  if (journey === "auth") {
    observations.push(
      ...expected.controls.map((control) => `${control.role}:${control.name}`),
      `initial-focus:${expected.controls[0].name}`,
    );
  } else if (journey === "booking") {
    observations.push(
      `focus:${expected.controls[0].name}`,
      `live-status:${expected.status}`,
      `button:${expected.primaryAction}`,
    );
  } else if (journey === "cancellation") {
    observations.push(
      `live-status:${expected.status}`,
      `dialog:${expected.dialogTitle}`,
      `dialog-description:${expected.dialogDescription}`,
      `dialog-control:${expected.dialogKeep}`,
      `dialog-control:${expected.dialogConfirm}`,
      `dialog-initial-focus:${expected.dialogKeep}`,
    );
  } else if (journey === "payment-result") {
    observations.push(`live-status:${expected.status}`);
  } else if (journey === "instructor-attendance") {
    observations.push(
      ...expected.controls.map((control) => `${control.role}:${control.name}`),
      `table:${expected.tableName}`,
      ...(expected.tableHeaders ?? []).map((header) => `columnheader:${header}`),
      `status:${expected.status}`,
    );
  } else if (journey === "admin-destructive-confirmation") {
    observations.push(
      `alertdialog:${expected.dialogTitle}`,
      `dialog-description:${expected.dialogDescription}`,
      `dialog-control:${expected.dialogKeep}`,
      `dialog-control:${expected.dialogConfirm}`,
      `dialog-initial-focus:${expected.dialogKeep}`,
    );
  } else {
    observations.push(
      ...expected.controls.map((control) => `${control.role}:${control.name}`),
      `image:${expected.imageAlt}`,
    );
  }
  return observations;
}
