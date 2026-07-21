import type { MessageEventType, MessageLanguage, TemplateVersion } from "@/lib/messaging.types";

export type MetaTemplateVariant = {
  eventType: MessageEventType;
  version: TemplateVersion;
  name: string;
  language: MessageLanguage;
  metaLanguage: "he" | "ar" | "en_US";
  category: "UTILITY";
  body: string;
  parameters: readonly string[];
  examples: readonly string[];
};

type LocalizedTemplate = {
  name: string | null;
  parameters: readonly string[];
  examples: readonly string[];
  bodies: Record<MessageLanguage, string>;
};

const DEFINITIONS: Record<MessageEventType, LocalizedTemplate> = {
  booking_confirmed: {
    name: "cc_booking_confirmed_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time", "instructor_name"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "18:00", "ירין"],
    bodies: {
      he: "היי {{1}}, איזה כיף שהמקום שלך נשמר 🤍\n\n{{2}}\n{{3}} · {{4}}\nעם {{5}}\n\nמחכה לראות אותך בסטודיו\nירין",
      ar: "مرحباً {{1}}، تم حفظ مكانك 🤍\n\n{{2}}\n{{3}} · {{4}}\nمع {{5}}\n\nننتظرك في Cloud & Core",
      en: "Hi {{1}}, your spot is saved 🤍\n\n{{2}}\n{{3}} · {{4}}\nWith {{5}}\n\nSee you at Cloud & Core",
    },
  },
  booking_cancelled: {
    name: "cc_booking_cancelled_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "18:00"],
    bodies: {
      he: "היי {{1}}, הביטול נקלט.\n\n{{2}}\n{{3}} · {{4}}\n\nאם מגיע לך זיכוי, הוא עודכן בחשבון שלך.\nירין",
      ar: "مرحباً {{1}}، تم تأكيد الإلغاء.\n\n{{2}}\n{{3}} · {{4}}\n\nإذا كان لك رصيد مستحق فقد تم تحديثه في حسابك.",
      en: "Hi {{1}}, your cancellation is confirmed.\n\n{{2}}\n{{3}} · {{4}}\n\nIf a credit is due, it has been returned to your account.",
    },
  },
  class_cancelled_by_admin: {
    name: "cc_class_cancelled_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "18:00"],
    bodies: {
      he: "היי {{1}}, עדכון מהסטודיו:\n\n{{2}}\n{{3}} · {{4}}\n\nהשיעור לא יתקיים הפעם. אם תרצי, אעזור לך למצוא שיעור חלופי.\nירין",
      ar: "مرحباً {{1}}، تحديث من الاستوديو:\n\n{{2}}\n{{3}} · {{4}}\n\nلن تقام الحصة. يسعدنا مساعدتك في اختيار موعد بديل.",
      en: "Hi {{1}}, a studio update:\n\n{{2}}\n{{3}} · {{4}}\n\nThis class will not take place. We can help you find an alternative.",
    },
  },
  class_time_changed: {
    name: "cc_class_time_changed_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "19:00"],
    bodies: {
      he: "היי {{1}}, שעת השיעור עודכנה:\n\n{{2}}\n{{3}} · {{4}}\n\nאם השעה החדשה לא מסתדרת לך, כתבי לי.\nירין",
      ar: "مرحباً {{1}}، تم تحديث موعد الحصة:\n\n{{2}}\n{{3}} · {{4}}\n\nإذا لم يناسبك الموعد الجديد، اكتبي لنا.",
      en: "Hi {{1}}, your class time was updated:\n\n{{2}}\n{{3}} · {{4}}\n\nIf the new time does not work, reply and we will help.",
    },
  },
  class_reminder_planning: {
    name: "cc_class_reminder_planning_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "18:00"],
    bodies: {
      he: "היי {{1}}, תזכורת קטנה לקראת השיעור 🤍\n\n{{2}}\n{{3}} · {{4}}\n\nאם משהו השתנה, עדיין אפשר לעדכן דרך האפליקציה.\nירין",
      ar: "مرحباً {{1}}، تذكير لطيف قبل الحصة 🤍\n\n{{2}}\n{{3}} · {{4}}\n\nإذا تغير شيء، يمكنك تحديث الحجز من التطبيق.",
      en: "Hi {{1}}, a gentle class reminder 🤍\n\n{{2}}\n{{3}} · {{4}}\n\nIf plans changed, you can still update your booking in the app.",
    },
  },
  class_reminder_final: {
    name: "cc_class_reminder_final_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time", "instructor_name"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "18:00", "ירין"],
    bodies: {
      he: "היי {{1}}, נתראה ממש בקרוב 🤍\n\nהנה הפרטים של השיעור שלך:\n{{2}}\nבתאריך {{3}} בשעה {{4}}\nעם {{5}}\n\nזוהי תזכורת אחרונה לקראת השיעור. כל הפרטים זמינים גם באפליקציה.\nירין",
      ar: "مرحباً {{1}}، نراك قريباً 🤍\n\n{{2}}\n{{3}} · {{4}}\nمع {{5}}\n\nننتظرك في Cloud & Core.",
      en: "Hi {{1}}, see you very soon 🤍\n\n{{2}}\n{{3}} · {{4}}\nWith {{5}}\n\nSee you at Cloud & Core.",
    },
  },
  class_open_spots: {
    name: null,
    parameters: ["member_name", "class_name", "class_date", "class_time", "spots_available"],
    examples: ["נועה", "פילאטיס מזרן", "22/07/2026", "18:00", "3"],
    bodies: {
      he: "{{1}}, נשארו {{5}} מקומות ב{{2}} ב-{{3}} בשעה {{4}}. אפשר להירשם עכשיו באפליקציה.",
      ar: "مرحباً {{1}}، بقيت {{5}} أماكن متاحة في {{2}} بتاريخ {{3}} الساعة {{4}}. يمكنك الحجز الآن من التطبيق.",
      en: "Hi {{1}}, {{5}} spots are still open in {{2}} on {{3}} at {{4}}. You can book now in the app.",
    },
  },
  waitlist_spot_available: {
    name: "cc_waitlist_spot_available_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time", "offer_expires_at"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "18:00", "17:15"],
    bodies: {
      he: "היי {{1}}, התפנה לך מקום 🤍\n\n{{2}}\n{{3}} · {{4}}\n\nאפשר להשלים את ההזמנה עד {{5}} דרך האפליקציה.\nירין",
      ar: "مرحباً {{1}}، أصبح مكان متاحاً لك 🤍\n\n{{2}}\n{{3}} · {{4}}\n\nيمكنك إكمال الحجز عبر التطبيق حتى {{5}}. المكان محفوظ لك حتى ذلك الوقت.",
      en: "Hi {{1}}, a spot opened for you 🤍\n\n{{2}}\n{{3}} · {{4}}\n\nComplete the booking in the app by {{5}}. The spot is held until then.",
    },
  },
  waitlist_joined: {
    name: null,
    parameters: ["member_name", "class_name"],
    examples: ["נועה", "פילאטיס מזרן"],
    bodies: {
      he: "{{1}}, הצטרפת לרשימת ההמתנה של {{2}}. נעדכן אותך מיד אם יתפנה מקום.",
      ar: "{{1}}، انضممت إلى قائمة الانتظار لحصة {{2}}. سنبلغك فور توفر مكان.",
      en: "Hi {{1}}, you joined the waitlist for {{2}}. We will let you know if a spot opens.",
    },
  },
  payment_request_received: {
    name: null,
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "{{1}}, קיבלנו את בקשת התשלום עבור {{2}}. נעדכן אותך כשהיא תושלם.",
      ar: "{{1}}، استلمنا طلب الدفع الخاص بـ {{2}}. سنبلغك عند اكتماله.",
      en: "Hi {{1}}, we received your payment request for {{2}}. We will update you when it completes.",
    },
  },
  payment_pending_reminder: {
    name: "cc_payment_pending_v2",
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "היי {{1}}, התשלום עבור {{2}} עדיין מחכה להשלמה. אפשר לחזור לאפליקציה כשנוח לך. אם משהו לא ברור, אני כאן לעזור.\nירין",
      ar: "مرحباً {{1}}، ما زال دفع {{2}} بانتظار الإكمال. يمكنك المتابعة من التطبيق، ونحن هنا للمساعدة.",
      en: "Hi {{1}}, payment for {{2}} is still awaiting completion. You can continue in the app, and we are here to help.",
    },
  },
  payment_confirmed: {
    name: "cc_payment_confirmed_v2",
    parameters: ["member_name", "package_name", "amount"],
    examples: ["נועה", "מינוי חודשי", "₪350"],
    bodies: {
      he: "היי {{1}}, התשלום אושר ✨\n\n{{2}} · {{3}}\n\nהחבילה עודכנה בחשבון שלך. תודה שבחרת ב-Cloud & Core.\nירין",
      ar: "مرحباً {{1}}، تم تأكيد الدفع ✨\n\n{{2}} · {{3}}\n\nتم تحديث الباقة في حسابك. شكراً لاختيارك Cloud & Core.",
      en: "Hi {{1}}, payment confirmed ✨\n\n{{2}} · {{3}}\n\nYour package has been updated. Thank you for choosing Cloud & Core.",
    },
  },
  payment_failed: {
    name: "cc_payment_failed_v2",
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "היי {{1}}, לא הצלחנו להשלים את התשלום עבור {{2}}. אפשר לנסות שוב באפליקציה או לכתוב לי ואעזור.\nירין",
      ar: "مرحباً {{1}}، لم نتمكن من إكمال دفع {{2}}. يمكنك المحاولة مجدداً في التطبيق أو الكتابة لنا للمساعدة.",
      en: "Hi {{1}}, we could not complete payment for {{2}}. Try again in the app or reply and we will help.",
    },
  },
  receipt_issued: {
    name: null,
    parameters: ["member_name", "receipt_number", "amount", "receipt_url"],
    examples: ["נועה", "CC-1001", "₪350", "https://cloudandcorestudio.com/receipts/receipt-id"],
    bodies: {
      he: "{{1}}, הקבלה {{2}} על סך {{3}} מוכנה. אפשר לצפות בה באופן מאובטח כאן: {{4}}",
      ar: "{{1}}، الإيصال {{2}} بقيمة {{3}} جاهز. يمكنك مشاهدته بأمان هنا: {{4}}",
      en: "Hi {{1}}, receipt {{2}} for {{3}} is ready. View it securely here: {{4}}",
    },
  },
  human_handoff: {
    name: "cc_human_handoff_v2",
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, ראיתי את ההודעה שלך ואשמח להמשיך לעזור לך כאן. אפשר להשיב להודעה הזו.\nירין",
      ar: "مرحباً {{1}}، وصلتنا رسالتك ويسعدنا متابعة المساعدة هنا. يمكنك الرد على هذه الرسالة.",
      en: "Hi {{1}}, we received your message and are happy to continue helping here. You can reply to this message.",
    },
  },
};

const META_LANGUAGES = {
  he: "he",
  ar: "ar",
  en: "en_US",
} as const;

export const META_TEMPLATE_CATALOG: readonly MetaTemplateVariant[] = Object.entries(
  DEFINITIONS,
).flatMap(([eventType, definition]) =>
  definition.name
    ? (["he", "ar", "en"] as const).map((language) => ({
        eventType: eventType as MetaTemplateVariant["eventType"],
        version: "v2" as const,
        name: definition.name as string,
        language,
        metaLanguage: META_LANGUAGES[language],
        category: "UTILITY" as const,
        body: definition.bodies[language],
        parameters: definition.parameters,
        examples: definition.examples,
      }))
    : [],
);

const SUBJECTS: Record<MessageLanguage, Partial<Record<MessageEventType, string>>> = {
  he: {
    booking_confirmed: "ההזמנה אושרה",
    booking_cancelled: "ההזמנה בוטלה",
    class_cancelled_by_admin: "השיעור בוטל",
    class_time_changed: "שעת השיעור השתנתה",
    class_reminder_planning: "תזכורת לקראת השיעור",
    class_reminder_final: "השיעור מתחיל בקרוב",
    class_open_spots: "נשארו מקומות בשיעור",
    waitlist_joined: "הצטרפת לרשימת ההמתנה",
    waitlist_spot_available: "התפנה לך מקום",
    payment_request_received: "בקשת התשלום התקבלה",
    payment_pending_reminder: "התשלום ממתין להשלמה",
    payment_confirmed: "התשלום אושר",
    payment_failed: "התשלום לא הושלם",
    receipt_issued: "הקבלה שלך מוכנה",
    human_handoff: "הודעה מהסטודיו",
  },
  ar: {
    booking_confirmed: "تم تأكيد الحجز",
    booking_cancelled: "تم إلغاء الحجز",
    class_cancelled_by_admin: "تم إلغاء الحصة",
    class_time_changed: "تم تغيير موعد الحصة",
    class_reminder_planning: "تذكير بالحصة",
    class_reminder_final: "الحصة ستبدأ قريباً",
    class_open_spots: "أماكن متاحة في الحصة",
    waitlist_joined: "انضممت إلى قائمة الانتظار",
    waitlist_spot_available: "أصبح مكان متاحاً",
    payment_request_received: "تم استلام طلب الدفع",
    payment_pending_reminder: "الدفع بانتظار الإكمال",
    payment_confirmed: "تم تأكيد الدفع",
    payment_failed: "تعذر إكمال الدفع",
    receipt_issued: "إيصالك جاهز",
    human_handoff: "رسالة من الاستوديو",
  },
  en: {
    booking_confirmed: "Booking confirmed",
    booking_cancelled: "Booking cancelled",
    class_cancelled_by_admin: "Class cancelled",
    class_time_changed: "Class time changed",
    class_reminder_planning: "Class reminder",
    class_reminder_final: "Class starts soon",
    class_open_spots: "Open spots in class",
    waitlist_joined: "Waitlist joined",
    waitlist_spot_available: "A spot is available",
    payment_request_received: "Payment request received",
    payment_pending_reminder: "Payment awaiting completion",
    payment_confirmed: "Payment confirmed",
    payment_failed: "Payment could not be completed",
    receipt_issued: "Your receipt is ready",
    human_handoff: "A message from the studio",
  },
};

export const MESSAGE_CONTENT_CATALOG = DEFINITIONS;

export function renderMessageContent(
  eventType: MessageEventType,
  language: MessageLanguage,
  variables: Record<string, unknown>,
) {
  const definition = DEFINITIONS[eventType];
  let body = definition.bodies[language];
  definition.parameters.forEach((parameter, index) => {
    const value = variables[parameter];
    if (value == null || String(value).trim() === "")
      throw new Error(`missing_template_variable:${parameter}`);
    body = body.replaceAll(`{{${index + 1}}}`, String(value));
  });
  return {
    subject: SUBJECTS[language][eventType] ?? eventType,
    body,
    parameters: [...definition.parameters],
    metaTemplate: definition.name,
    version: "v2" as const,
  };
}

export function validateMessageContentCatalog() {
  const errors: string[] = [];
  for (const eventType of Object.keys(DEFINITIONS) as MessageEventType[]) {
    const definition = DEFINITIONS[eventType];
    for (const language of ["he", "ar", "en"] as const) {
      if (!definition.bodies[language]?.trim())
        errors.push(`missing_body:${eventType}:${language}`);
      if (!SUBJECTS[language][eventType]?.trim())
        errors.push(`missing_subject:${eventType}:${language}`);
      if (placeholderCount(definition.bodies[language]) !== definition.parameters.length) {
        errors.push(`parameter_count:${eventType}:${language}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function getMetaTemplateVariant(eventType: MessageEventType, language: MessageLanguage) {
  return META_TEMPLATE_CATALOG.find(
    (variant) => variant.eventType === eventType && variant.language === language,
  );
}

function placeholderCount(body: string) {
  const values = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
  return values.length ? Math.max(...values) : 0;
}

export function validateMetaTemplateCatalog(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const keys = new Set<string>();
  const events = new Map<string, MetaTemplateVariant[]>();

  for (const variant of META_TEMPLATE_CATALOG) {
    const key = `${variant.name}:${variant.metaLanguage}`;
    if (keys.has(key)) errors.push(`duplicate:${key}`);
    keys.add(key);
    if (!/^cc_[a-z0-9_]+_v\d+$/.test(variant.name)) errors.push(`invalid_name:${variant.name}`);
    if (variant.category !== "UTILITY") errors.push(`invalid_category:${key}`);
    if (placeholderCount(variant.body) !== variant.parameters.length) {
      errors.push(`parameter_count:${key}`);
    }
    if (/^\s*\{\{\d+\}\}/.test(variant.body)) errors.push(`parameter_at_start:${key}`);
    if (/\{\{\d+\}\}\s*[.!?,:؛،؟。、]*\s*$/.test(variant.body)) {
      errors.push(`parameter_at_end:${key}`);
    }
    if (variant.examples.length !== variant.parameters.length) errors.push(`examples:${key}`);
    events.set(variant.eventType, [...(events.get(variant.eventType) ?? []), variant]);
  }

  for (const [eventType, variants] of events) {
    const languages = variants
      .map((variant) => variant.language)
      .sort()
      .join(",");
    if (languages !== "ar,en,he") errors.push(`language_parity:${eventType}`);
    const schemas = new Set(variants.map((variant) => variant.parameters.join(",")));
    if (schemas.size !== 1) errors.push(`parameter_schema:${eventType}`);
    const names = new Set(variants.map((variant) => variant.name));
    if (names.size !== 1) errors.push(`semantic_name:${eventType}`);
  }

  return { ok: errors.length === 0, errors };
}

export function toMetaTemplateJson(variant: MetaTemplateVariant) {
  return {
    name: variant.name,
    language: variant.metaLanguage,
    category: variant.category,
    components: [
      {
        type: "BODY",
        text: variant.body,
        ...(variant.parameters.length ? { example: { body_text: [variant.examples] } } : {}),
      },
    ],
  };
}
