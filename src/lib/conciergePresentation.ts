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

export type ConciergeWhatsappPresentation = {
  key: string;
  version: 3;
  templateKey: string;
  locale: ConciergePresentationLocale;
  providerTemplateName: string;
  requiredVariables: readonly string[];
  optionalVariables: readonly string[];
  bodyTemplate: string;
  orderedParameters: readonly ["member_name", "details_block"];
  parameters: [string, string];
  action: ConciergeAction;
};

const ACTION_PATHS = {
  booking: "/member/bookings",
  payment_outcome: "/member/packages",
  class_change: "/member/schedule",
  weekly_schedule: "/member/schedule",
  waitlist: "/member/schedule",
  recommendation: "/member/schedule",
} as const;

const ACTION_LABELS = {
  booking: { he: "צפייה בהזמנה", ar: "عرض الحجز", en: "View booking" },
  payment_outcome: { he: "בדיקת התשלום", ar: "مراجعة الدفع", en: "Review payment" },
  class_change: {
    he: "צפייה בלוח השיעורים",
    ar: "عرض جدول الحصص",
    en: "View schedule",
  },
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
    { key: "instructor_name", label: { he: "מדריכה", ar: "المدربة", en: "Instructor" } },
    { key: "location_name", label: { he: "מיקום", ar: "المكان", en: "Location" } },
  ],
  payment: [
    { key: "amount", label: { he: "סכום", ar: "المبلغ", en: "Amount" }, ltr: true },
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
    actionKind: "class_change",
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
  contentMode?: "template" | "final";
}): ConciergePresentation {
  const definition = JOURNEYS[input.journeyType] ?? DEFAULT_JOURNEY;

  return {
    key: `${input.templateKey}:email:v2`,
    version: 2,
    journeyType: input.journeyType,
    categoryLabel: definition.categoryLabel[input.locale],
    subject:
      input.contentMode === "final"
        ? (input.subject ?? "")
        : renderCopy(input.subject, input.variables),
    body: input.contentMode === "final" ? input.body : renderCopy(input.body, input.variables),
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

const BOOKING_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, המקום שלך נשמר 🤍\n\n{{2}}\n\nהכול מוכן לקראת השיעור.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، تم حفظ مكانك 🤍\n\n{{2}}\n\nكل شيء جاهز للحصة.\nيارين | Cloud & Core",
  en: "Hi {{1}}, your place is reserved 🤍\n\n{{2}}\n\nEverything is ready for class.\nYareen | Cloud & Core",
};

const CLASS_CANCELLED_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, עדכון חשוב לגבי השיעור שלך:\n\n{{2}}\n\nהשיעור לא יתקיים הפעם. אשמח לעזור לך למצוא חלופה.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، تحديث مهم بخصوص حصتك:\n\n{{2}}\n\nلن تقام الحصة هذه المرة. يسعدني مساعدتك في إيجاد بديل.\nيارين | Cloud & Core",
  en: "Hi {{1}}, an important update about your class:\n\n{{2}}\n\nThis class will not take place. I’m happy to help you find an alternative.\nYareen | Cloud & Core",
};

const CLASS_CHANGED_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, שעת השיעור שלך עודכנה:\n\n{{2}}\n\nאם השעה החדשה לא מסתדרת, אני כאן לעזור.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، تم تحديث موعد حصتك:\n\n{{2}}\n\nإذا لم يناسبك الموعد الجديد، أنا هنا للمساعدة.\nيارين | Cloud & Core",
  en: "Hi {{1}}, your class time has been updated:\n\n{{2}}\n\nIf the new time does not work, I’m here to help.\nYareen | Cloud & Core",
};

const PAYMENT_ACTION_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, צריך להשלים עדכון קטן בתשלום:\n\n{{2}}\n\nאני כאן אם תצטרכי עזרה.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، يلزم تحديث بسيط للدفع:\n\n{{2}}\n\nأنا هنا إذا احتجتِ إلى مساعدة.\nيارين | Cloud & Core",
  en: "Hi {{1}}, your payment needs a quick update:\n\n{{2}}\n\nI’m here if you need help.\nYareen | Cloud & Core",
};

const PAYMENT_CONFIRMED_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, התשלום התקבל והכול מעודכן 🤍\n\n{{2}}\n\nתודה שבחרת ב-Cloud & Core.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، تم استلام الدفع وتحديث كل شيء 🤍\n\n{{2}}\n\nشكراً لاختيارك Cloud & Core.\nيارين | Cloud & Core",
  en: "Hi {{1}}, your payment was received and everything is updated 🤍\n\n{{2}}\n\nThank you for choosing Cloud & Core.\nYareen | Cloud & Core",
};

const WAITLIST_OFFER_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, התפנה עבורך מקום 🤍\n\n{{2}}\n\nהמקום שמור לזמן קצר.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، أصبح مكان متاحاً لك 🤍\n\n{{2}}\n\nالمكان محفوظ لفترة قصيرة.\nيارين | Cloud & Core",
  en: "Hi {{1}}, a place opened for you 🤍\n\n{{2}}\n\nThe place is held for a short time.\nYareen | Cloud & Core",
};

const RECOMMENDATION_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, מצאתי משהו שעשוי להתאים לך 🤍\n\n{{2}}\n\nאם תרצי, אפשר לשמור מקום דרך האפליקציה.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، وجدت خياراً قد يناسبك 🤍\n\n{{2}}\n\nيمكنك حجز مكان عبر التطبيق إذا رغبتِ.\nيارين | Cloud & Core",
  en: "Hi {{1}}, I found something that may suit you 🤍\n\n{{2}}\n\nYou can reserve a place in the app if you’d like.\nYareen | Cloud & Core",
};

const RETENTION_WHATSAPP_BODY: Record<ConciergePresentationLocale, string> = {
  he: "היי {{1}}, רק רציתי לבדוק מה שלומך 🤍\n\n{{2}}\n\nאם תרצי עזרה לבחור את השיעור הבא, אני כאן.\nירין | Cloud & Core",
  ar: "مرحباً {{1}}، أردت فقط الاطمئنان عليكِ 🤍\n\n{{2}}\n\nأنا هنا لمساعدتك في اختيار حصتك القادمة.\nيارين | Cloud & Core",
  en: "Hi {{1}}, I just wanted to check in 🤍\n\n{{2}}\n\nI’m here if you’d like help choosing your next class.\nYareen | Cloud & Core",
};

function requireWhatsappValue(variables: Record<string, unknown>, key: string) {
  const value = factValue(variables[key]);
  if (value === null) throw new Error(`missing_whatsapp_presentation_variable:${key}`);
  return value;
}

function bookingDetails(
  locale: ConciergePresentationLocale,
  variables: Record<string, unknown>,
) {
  const className = requireWhatsappValue(variables, "class_name");
  const classDate = requireWhatsappValue(variables, "class_date");
  const classTime = requireWhatsappValue(variables, "class_time");
  const instructor = factValue(variables.instructor_name);
  const location = factValue(variables.location_name);
  const withInstructor =
    instructor === null
      ? null
      : locale === "he"
        ? `עם ${instructor}`
        : locale === "ar"
          ? `مع ${instructor}`
          : `With ${instructor}`;
  const context = [withInstructor, location].filter(Boolean).join(" · ");
  return [className, `${classDate} · ${classTime}`, context].filter(Boolean).join("\n");
}

function cancelledClassDetails(
  _locale: ConciergePresentationLocale,
  variables: Record<string, unknown>,
) {
  const className = requireWhatsappValue(variables, "class_name");
  const classDate = requireWhatsappValue(variables, "class_date");
  const classTime = requireWhatsappValue(variables, "class_time");
  const location = factValue(variables.location_name);
  return [className, `${classDate} · ${classTime}`, location].filter(Boolean).join("\n");
}

function paymentDetails(
  locale: ConciergePresentationLocale,
  variables: Record<string, unknown>,
) {
  const packageName = requireWhatsappValue(variables, "package_name");
  const amount = factValue(variables.amount);
  const renewalDate = factValue(variables.renewal_date);
  const renewalLabel =
    renewalDate === null
      ? null
      : locale === "he"
        ? `חידוש ${renewalDate}`
        : locale === "ar"
          ? `التجديد ${renewalDate}`
          : `Renewal ${renewalDate}`;
  const context = [amount, renewalLabel].filter(Boolean).join(" · ");
  return [packageName, context].filter(Boolean).join("\n");
}

function waitlistDetails(
  locale: ConciergePresentationLocale,
  variables: Record<string, unknown>,
) {
  const className = requireWhatsappValue(variables, "class_name");
  const classDate = requireWhatsappValue(variables, "class_date");
  const classTime = requireWhatsappValue(variables, "class_time");
  const expiresAt = requireWhatsappValue(variables, "offer_expires_at");
  const expiryLabel =
    locale === "he"
      ? `שמור עד ${expiresAt}`
      : locale === "ar"
        ? `محفوظ حتى ${expiresAt}`
        : `Held until ${expiresAt}`;
  return [className, `${classDate} · ${classTime}`, expiryLabel].join("\n");
}

function recommendationDetails(
  _locale: ConciergePresentationLocale,
  variables: Record<string, unknown>,
) {
  return requireWhatsappValue(variables, "recommendation_summary");
}

function retentionDetails(
  locale: ConciergePresentationLocale,
  variables: Record<string, unknown>,
) {
  const packageName = factValue(variables.package_name);
  const credits = factValue(variables.credits_remaining);
  if (packageName && credits) {
    const creditsLabel =
      locale === "he"
        ? `${credits} קרדיטים זמינים`
        : locale === "ar"
          ? `${credits} أرصدة متاحة`
          : `${credits} credits available`;
    return `${packageName}\n${creditsLabel}`;
  }
  if (packageName) return packageName;
  if (credits) {
    return locale === "he"
      ? `${credits} קרדיטים זמינים`
      : locale === "ar"
        ? `${credits} أرصدة متاحة`
        : `${credits} credits available`;
  }
  return locale === "he"
    ? "לוח השיעורים החדש מחכה לך באפליקציה"
    : locale === "ar"
      ? "جدول الحصص الجديد بانتظارك في التطبيق"
      : "The latest class schedule is waiting in the app";
}

type WhatsappPresentationDefinition = {
  body: Record<ConciergePresentationLocale, string>;
  requiredVariables: readonly string[];
  optionalVariables: readonly string[];
  details: (
    locale: ConciergePresentationLocale,
    variables: Record<string, unknown>,
  ) => string;
  actionKind?: keyof typeof ACTION_PATHS;
};

const WHATSAPP_PRESENTATIONS: Record<string, WhatsappPresentationDefinition> = {
  booking_confirmed_first: {
    body: BOOKING_WHATSAPP_BODY,
    requiredVariables: ["member_name", "class_name", "class_date", "class_time"],
    optionalVariables: ["instructor_name", "location_name"],
    details: bookingDetails,
    actionKind: "booking",
  },
  booking_confirmed_repeat: {
    body: BOOKING_WHATSAPP_BODY,
    requiredVariables: ["member_name", "class_name", "class_date", "class_time"],
    optionalVariables: ["instructor_name", "location_name"],
    details: bookingDetails,
    actionKind: "booking",
  },
  class_cancelled: {
    body: CLASS_CANCELLED_WHATSAPP_BODY,
    requiredVariables: ["member_name", "class_name", "class_date", "class_time"],
    optionalVariables: ["location_name"],
    details: cancelledClassDetails,
    actionKind: "class_change",
  },
  class_time_changed: {
    body: CLASS_CHANGED_WHATSAPP_BODY,
    requiredVariables: ["member_name", "class_name", "class_date", "class_time"],
    optionalVariables: ["instructor_name", "location_name"],
    details: bookingDetails,
    actionKind: "class_change",
  },
  payment_one_time_succeeded: {
    body: PAYMENT_CONFIRMED_WHATSAPP_BODY,
    requiredVariables: ["member_name", "package_name"],
    optionalVariables: ["amount"],
    details: paymentDetails,
  },
  payment_subscription_renewal_succeeded: {
    body: PAYMENT_CONFIRMED_WHATSAPP_BODY,
    requiredVariables: ["member_name", "package_name"],
    optionalVariables: ["amount", "renewal_date"],
    details: paymentDetails,
  },
  payment_requires_action: {
    body: PAYMENT_ACTION_WHATSAPP_BODY,
    requiredVariables: ["member_name", "package_name"],
    optionalVariables: ["amount", "renewal_date"],
    details: paymentDetails,
    actionKind: "payment_outcome",
  },
  payment_terminally_failed: {
    body: PAYMENT_ACTION_WHATSAPP_BODY,
    requiredVariables: ["member_name", "package_name"],
    optionalVariables: ["amount", "renewal_date"],
    details: paymentDetails,
    actionKind: "payment_outcome",
  },
  waitlist_offer: {
    body: WAITLIST_OFFER_WHATSAPP_BODY,
    requiredVariables: [
      "member_name",
      "class_name",
      "class_date",
      "class_time",
      "offer_expires_at",
    ],
    optionalVariables: [],
    details: waitlistDetails,
    actionKind: "waitlist",
  },
  recommendation: {
    body: RECOMMENDATION_WHATSAPP_BODY,
    requiredVariables: ["member_name", "recommendation_summary"],
    optionalVariables: [],
    details: recommendationDetails,
    actionKind: "recommendation",
  },
  retention: {
    body: RETENTION_WHATSAPP_BODY,
    requiredVariables: ["member_name"],
    optionalVariables: ["package_name", "credits_remaining"],
    details: retentionDetails,
  },
};

export function conciergePremiumWhatsappTemplateDefinition(
  templateKey: string,
  locale: ConciergePresentationLocale,
) {
  const definition = WHATSAPP_PRESENTATIONS[templateKey];
  if (!definition) return null;
  return {
    providerTemplateName: `${templateKey}_premium_v3`,
    bodyTemplate: definition.body[locale],
    requiredVariables: definition.requiredVariables,
    optionalVariables: definition.optionalVariables,
    orderedParameters: ["member_name", "details_block"] as const,
    actionKind: definition.actionKind ?? null,
  };
}

export function buildConciergeWhatsappPresentation(input: {
  templateKey: string;
  locale: ConciergePresentationLocale;
  variables: Record<string, unknown>;
}): ConciergeWhatsappPresentation {
  const definition = WHATSAPP_PRESENTATIONS[input.templateKey];
  if (!definition) {
    throw new Error(`unsupported_whatsapp_presentation:${input.templateKey}`);
  }
  const memberName = requireWhatsappValue(input.variables, "member_name");
  return {
    key: `${input.templateKey}:whatsapp:v3`,
    version: 3,
    templateKey: input.templateKey,
    locale: input.locale,
    providerTemplateName: `${input.templateKey}_premium_v3`,
    requiredVariables: definition.requiredVariables,
    optionalVariables: definition.optionalVariables,
    bodyTemplate: definition.body[input.locale],
    orderedParameters: ["member_name", "details_block"],
    parameters: [memberName, definition.details(input.locale, input.variables)],
    action: definition.actionKind
      ? {
          label: ACTION_LABELS[definition.actionKind][input.locale],
          url: new URL(
            ACTION_PATHS[definition.actionKind],
            "https://cloudandcorestudio.com",
          ).toString(),
        }
      : null,
  };
}
