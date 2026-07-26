export type ConciergePresentationLocale = "he" | "ar" | "en";
export type ConciergePresentationChannel = "email" | "whatsapp";

export type ConciergePresentationFact = {
  key: string;
  label: string;
  value: string;
  ltr: boolean;
};

export type ConciergeAction = {
  label: string;
  url: string;
} | null;

export type ConciergePresentation = {
  key: string;
  version: 2;
  journeyType: string;
  categoryLabel: string;
  subject: string;
  body: string;
  facts: ConciergePresentationFact[];
  action: ConciergeAction;
};

const ACTION_PATHS = {
  booking: "/member/bookings",
  payment_outcome: "/member/packages",
  weekly_schedule: "/member/schedule",
  waitlist: "/member/schedule",
  recommendation: "/member/schedule",
} as const;

const ACTION_LABELS = {
  booking: { he: "צפייה בהזמנה", ar: "عرض الحجز", en: "View booking" },
  payment_outcome: { he: "בדיקת התשלום", ar: "مراجعة الدفع", en: "Review payment" },
  weekly_schedule: { he: "למערכת השעות", ar: "استكشاف الجدول", en: "Explore schedule" },
  waitlist: { he: "מימוש המקום", ar: "حجز المكان", en: "Claim spot" },
  recommendation: { he: "צפייה בהמלצה", ar: "عرض التوصية", en: "View recommendation" },
} as const;

type LocalizedText = Record<ConciergePresentationLocale, string>;
type FactDefinition = { key: string; label: LocalizedText; ltr?: boolean };

type JourneyDefinition = {
  categoryLabel: LocalizedText;
  facts: FactDefinition[];
  actionKind?: keyof typeof ACTION_PATHS;
};

const FACTS = {
  class: [
    { key: "class_name", label: { he: "שיעור", ar: "الحصة", en: "Class" } },
    { key: "class_date", label: { he: "תאריך", ar: "التاريخ", en: "Date" }, ltr: true },
    { key: "class_time", label: { he: "שעה", ar: "الوقت", en: "Time" }, ltr: true },
  ],
  payment: [
    { key: "payment_amount", label: { he: "סכום", ar: "المبلغ", en: "Amount" }, ltr: true },
    { key: "payment_date", label: { he: "תאריך", ar: "التاريخ", en: "Date" }, ltr: true },
  ],
  schedule: [{ key: "week_of", label: { he: "שבוע של", ar: "أسبوع", en: "Week of" }, ltr: true }],
  waitlist: [
    { key: "class_name", label: { he: "שיעור", ar: "الحصة", en: "Class" } },
    { key: "class_date", label: { he: "תאריך", ar: "التاريخ", en: "Date" }, ltr: true },
    { key: "class_time", label: { he: "שעה", ar: "الوقت", en: "Time" }, ltr: true },
    {
      key: "offer_expires_at",
      label: { he: "בתוקף עד", ar: "صالح حتى", en: "Valid until" },
      ltr: true,
    },
  ],
  recommendation: [
    { key: "recommendation_summary", label: { he: "המלצה", ar: "التوصية", en: "Recommendation" } },
    { key: "class_name", label: { he: "שיעור", ar: "الحصة", en: "Class" } },
  ],
} as const satisfies Record<string, FactDefinition[]>;

const JOURNEYS: Record<string, JourneyDefinition> = {
  booking: {
    categoryLabel: { he: "פרטי ההזמנה", ar: "تفاصيل الحجز", en: "Booking details" },
    facts: FACTS.class,
    actionKind: "booking",
  },
  booking_cancellation: {
    categoryLabel: { he: "פרטי הביטול", ar: "تفاصيل الإلغاء", en: "Cancellation details" },
    facts: FACTS.class,
  },
  class_change: {
    categoryLabel: { he: "עדכון שיעור", ar: "تحديث الحصة", en: "Class update" },
    facts: FACTS.class,
  },
  payment_outcome: {
    categoryLabel: { he: "פרטי התשלום", ar: "تفاصيل الدفع", en: "Payment details" },
    facts: FACTS.payment,
  },
  weekly_schedule: {
    categoryLabel: { he: "המערכת שלך", ar: "جدولك", en: "Your schedule" },
    facts: FACTS.schedule,
    actionKind: "weekly_schedule",
  },
  retention: {
    categoryLabel: { he: "Cloud & Core", ar: "Cloud & Core", en: "Cloud & Core" },
    facts: [],
  },
  waitlist: {
    categoryLabel: { he: "רשימת המתנה", ar: "قائمة الانتظار", en: "Waitlist" },
    facts: FACTS.waitlist,
    actionKind: "waitlist",
  },
  lead_to_trial: {
    categoryLabel: { he: "ברוכה הבאה", ar: "مرحباً بك", en: "Welcome" },
    facts: [],
  },
  recommendation: {
    categoryLabel: { he: "המלצה עבורך", ar: "توصية لك", en: "A recommendation for you" },
    facts: FACTS.recommendation,
    actionKind: "recommendation",
  },
  daily_briefing: {
    categoryLabel: { he: "העדכון שלך", ar: "تحديثك", en: "Your update" },
    facts: [],
  },
};

const DEFAULT_JOURNEY: JourneyDefinition = {
  categoryLabel: { he: "Cloud & Core", ar: "Cloud & Core", en: "Cloud & Core" },
  facts: [],
};

function renderCopy(copy: string | null, variables: Record<string, unknown>) {
  return (copy ?? "").replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function factValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const rendered = String(value).trim();
  return rendered === "" ? null : rendered;
}

function actionFor(
  journeyType: string,
  templateKey: string,
  locale: ConciergePresentationLocale,
  publicBaseUrl: string,
  definition: JourneyDefinition,
): ConciergeAction {
  const paymentNeedsAction =
    templateKey === "payment_requires_action" || templateKey === "payment_terminally_failed";
  const actionKind =
    journeyType === "payment_outcome"
      ? paymentNeedsAction
        ? "payment_outcome"
        : undefined
      : definition.actionKind;

  if (!actionKind) return null;
  return {
    label: ACTION_LABELS[actionKind][locale],
    url: new URL(ACTION_PATHS[actionKind], publicBaseUrl).toString(),
  };
}

export function buildConciergePresentation(input: {
  journeyType: string;
  templateKey: string;
  locale: ConciergePresentationLocale;
  subject: string | null;
  body: string;
  variables: Record<string, unknown>;
  publicBaseUrl: string;
}): ConciergePresentation {
  const definition = JOURNEYS[input.journeyType] ?? DEFAULT_JOURNEY;

  return {
    key: `${input.templateKey}:email:v2`,
    version: 2,
    journeyType: input.journeyType,
    categoryLabel: definition.categoryLabel[input.locale],
    subject: renderCopy(input.subject, input.variables),
    body: renderCopy(input.body, input.variables),
    facts: definition.facts.flatMap((fact) => {
      const value = factValue(input.variables[fact.key]);
      return value === null
        ? []
        : [{ key: fact.key, label: fact.label[input.locale], value, ltr: fact.ltr === true }];
    }),
    action: actionFor(
      input.journeyType,
      input.templateKey,
      input.locale,
      input.publicBaseUrl,
      definition,
    ),
  };
}
