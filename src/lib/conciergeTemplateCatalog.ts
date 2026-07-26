import type { ConciergeChannel } from "@/lib/conciergePolicy";

export type ConciergeTemplateLocale = "en" | "he" | "ar";

export type ConciergeTemplateCatalogEntry = {
  templateKey: string;
  channel: ConciergeChannel;
  locale: ConciergeTemplateLocale;
  version: number;
  requiredVariables: string[];
  subjectTemplate: string | null;
  bodyTemplate: string;
  firstPersonVoiceApproved: boolean;
};

type LocalizedCopy = Record<ConciergeTemplateLocale, { subject: string; body: string }>;

type TemplateDefinition = {
  channels: ConciergeChannel[];
  copy: LocalizedCopy;
  firstPersonVoiceApproved?: boolean;
};

const DEFINITIONS: Record<string, TemplateDefinition> = {
  booking_confirmed_first: {
    channels: ["in_app", "push", "whatsapp"],
    copy: {
      en: {
        subject: "Your first class is booked",
        body: "Hi {{member_name}}, your first class at Cloud & Core is confirmed. Your booking details are available in the app. We look forward to welcoming you.",
      },
      he: {
        subject: "השיעור הראשון שלך הוזמן",
        body: "היי {{member_name}}, השיעור הראשון שלך ב-Cloud & Core אושר. פרטי ההזמנה זמינים באפליקציה. מחכות לראותך בסטודיו.",
      },
      ar: {
        subject: "تم حجز حصتك الأولى",
        body: "مرحباً {{member_name}}، تم تأكيد حصتك الأولى في Cloud & Core. تفاصيل الحجز متاحة في التطبيق. نتطلع لاستقبالك.",
      },
    },
  },
  booking_confirmed_repeat: {
    channels: ["in_app", "push", "whatsapp"],
    copy: {
      en: {
        subject: "Your class is booked",
        body: "Hi {{member_name}}, your class booking is confirmed. You can review the class details in the Cloud & Core app.",
      },
      he: {
        subject: "השיעור שלך הוזמן",
        body: "היי {{member_name}}, ההזמנה שלך לשיעור אושרה. אפשר לצפות בפרטי השיעור באפליקציית Cloud & Core.",
      },
      ar: {
        subject: "تم حجز حصتك",
        body: "مرحباً {{member_name}}، تم تأكيد حجز حصتك. يمكنك مراجعة تفاصيل الحصة في تطبيق Cloud & Core.",
      },
    },
  },
  booking_cancelled: {
    channels: ["in_app"],
    copy: {
      en: {
        subject: "Your cancellation is confirmed",
        body: "Hi {{member_name}}, your class cancellation is confirmed. Any applicable credit has been returned according to the studio policy.",
      },
      he: {
        subject: "הביטול שלך אושר",
        body: "היי {{member_name}}, ביטול השיעור אושר. זיכוי מתאים, אם קיים, הוחזר בהתאם למדיניות הסטודיו.",
      },
      ar: {
        subject: "تم تأكيد الإلغاء",
        body: "مرحباً {{member_name}}، تم تأكيد إلغاء الحصة. تمت إعادة أي رصيد مستحق وفق سياسة الاستوديو.",
      },
    },
  },
  class_cancelled: {
    channels: ["in_app", "push", "email", "whatsapp"],
    copy: {
      en: {
        subject: "Studio update: class cancelled",
        body: "Hi {{member_name}}, a class on your schedule has been cancelled. Please open the Cloud & Core app for the latest details or contact the studio for help.",
      },
      he: {
        subject: "עדכון מהסטודיו: השיעור בוטל",
        body: "היי {{member_name}}, שיעור בלוח שלך בוטל. אפשר לפתוח את אפליקציית Cloud & Core לפרטים העדכניים או לפנות לסטודיו לעזרה.",
      },
      ar: {
        subject: "تحديث من الاستوديو: تم إلغاء الحصة",
        body: "مرحباً {{member_name}}، تم إلغاء حصة في جدولك. افتحي تطبيق Cloud & Core للاطلاع على التفاصيل المحدثة أو تواصلي مع الاستوديو للمساعدة.",
      },
    },
  },
  class_time_changed: {
    channels: ["in_app", "push", "email", "whatsapp"],
    copy: {
      en: {
        subject: "Studio update: class time changed",
        body: "Hi {{member_name}}, the time of a class on your schedule has changed. Please open the Cloud & Core app to review the updated time.",
      },
      he: {
        subject: "עדכון מהסטודיו: שעת השיעור השתנתה",
        body: "היי {{member_name}}, השעה של שיעור בלוח שלך השתנתה. אפשר לפתוח את אפליקציית Cloud & Core כדי לראות את השעה המעודכנת.",
      },
      ar: {
        subject: "تحديث من الاستوديو: تغيّر موعد الحصة",
        body: "مرحباً {{member_name}}، تغيّر موعد حصة في جدولك. افتحي تطبيق Cloud & Core لمراجعة الموعد المحدث.",
      },
    },
  },
  weekly_schedule: {
    channels: ["in_app", "push"],
    copy: {
      en: {
        subject: "Your weekly schedule is ready",
        body: "Hi {{member_name}}, the latest Cloud & Core schedule is ready. Open the app to find and book the classes that suit you.",
      },
      he: {
        subject: "המערכת השבועית מוכנה",
        body: "היי {{member_name}}, המערכת העדכנית של Cloud & Core מוכנה. אפשר לפתוח את האפליקציה, למצוא ולהזמין שיעורים שמתאימים לך.",
      },
      ar: {
        subject: "الجدول الأسبوعي جاهز",
        body: "مرحباً {{member_name}}، جدول Cloud & Core المحدث جاهز. افتحي التطبيق لاختيار وحجز الحصص المناسبة لك.",
      },
    },
  },
  payment_outcome: {
    channels: ["in_app", "push", "email"],
    copy: {
      en: {
        subject: "Payment update",
        body: "Hi {{member_name}}, there is an update about a payment on your Cloud & Core account. Open the app to review the current status and any next step.",
      },
      he: {
        subject: "עדכון תשלום",
        body: "היי {{member_name}}, יש עדכון לגבי תשלום בחשבון Cloud & Core שלך. אפשר לפתוח את האפליקציה כדי לבדוק את הסטטוס והמשך הטיפול.",
      },
      ar: {
        subject: "تحديث بشأن الدفع",
        body: "مرحباً {{member_name}}، يوجد تحديث بشأن دفعة في حساب Cloud & Core. افتحي التطبيق لمراجعة الحالة الحالية وأي خطوة مطلوبة.",
      },
    },
  },
  retention: {
    channels: ["in_app", "push", "whatsapp"],
    firstPersonVoiceApproved: true,
    copy: {
      en: {
        subject: "We would love to see you again",
        body: "Hi {{member_name}}, we have missed seeing you at Cloud & Core. When the time feels right, open the app to find a class that suits you. We are here if you need help.",
      },
      he: {
        subject: "נשמח לראותך שוב",
        body: "היי {{member_name}}, התגעגענו לראותך ב-Cloud & Core. כשיתאים לך, אפשר לפתוח את האפליקציה ולמצוא שיעור שנכון לך. אנחנו כאן אם תרצי עזרה.",
      },
      ar: {
        subject: "يسعدنا رؤيتك من جديد",
        body: "مرحباً {{member_name}}، اشتقنا لرؤيتك في Cloud & Core. عندما يناسبك، افتحي التطبيق للعثور على حصة مناسبة. نحن هنا إذا احتجتِ للمساعدة.",
      },
    },
  },
  waitlist_offer: {
    channels: ["in_app", "push", "whatsapp"],
    copy: {
      en: {
        subject: "A waitlist spot is available",
        body: "Hi {{member_name}}, a spot may now be available for a class on your waitlist. Open the Cloud & Core app promptly to review and claim the offer before it expires.",
      },
      he: {
        subject: "התפנה מקום מרשימת ההמתנה",
        body: "היי {{member_name}}, ייתכן שהתפנה מקום בשיעור מרשימת ההמתנה שלך. כדאי לפתוח את אפליקציית Cloud & Core בהקדם כדי לבדוק ולממש את ההצעה לפני שתפוג.",
      },
      ar: {
        subject: "توفر مكان من قائمة الانتظار",
        body: "مرحباً {{member_name}}، قد يتوفر الآن مكان في حصة من قائمة الانتظار. افتحي تطبيق Cloud & Core سريعاً لمراجعة العرض وحجز المكان قبل انتهاء صلاحيته.",
      },
    },
  },
};

const LOCALES = ["en", "he", "ar"] as const;

export const CONCIERGE_TEMPLATE_CATALOG: ConciergeTemplateCatalogEntry[] = Object.entries(
  DEFINITIONS,
).flatMap(([templateKey, definition]) =>
  definition.channels.flatMap((channel) =>
    LOCALES.map((locale) => ({
      templateKey,
      channel,
      locale,
      version: 1,
      requiredVariables: ["member_name"],
      subjectTemplate: channel === "email" ? definition.copy[locale].subject : null,
      bodyTemplate: definition.copy[locale].body,
      firstPersonVoiceApproved: definition.firstPersonVoiceApproved === true,
    })),
  ),
);

const META_LOCALES: Record<ConciergeTemplateLocale, "en_US" | "he" | "ar"> = {
  en: "en_US",
  he: "he",
  ar: "ar",
};

export const CONCIERGE_META_TEMPLATE_CATALOG = CONCIERGE_TEMPLATE_CATALOG.filter(
  (template) => template.channel === "whatsapp",
).map((template) => ({
  name: template.templateKey,
  language: META_LOCALES[template.locale],
  category: template.templateKey === "retention" ? ("MARKETING" as const) : ("UTILITY" as const),
  components: [
    {
      type: "BODY",
      text: template.bodyTemplate.replaceAll("{{member_name}}", "{{1}}"),
      example: { body_text: [["Test"]] },
    },
  ],
}));

function placeholders(value: string | null) {
  if (!value) return [];
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
}

export function validateConciergeTemplateCatalog() {
  const errors: string[] = [];
  const identities = new Set<string>();

  for (const template of CONCIERGE_TEMPLATE_CATALOG) {
    const identity = `${template.templateKey}:${template.channel}:${template.locale}:${template.version}`;
    if (identities.has(identity)) errors.push(`duplicate:${identity}`);
    identities.add(identity);

    const referenced = new Set([
      ...placeholders(template.subjectTemplate),
      ...placeholders(template.bodyTemplate),
    ]);
    const required = new Set(template.requiredVariables);
    if (
      referenced.size !== required.size ||
      [...referenced].some((variable) => !required.has(variable))
    ) {
      errors.push(`variable_mismatch:${identity}`);
    }
    if (template.channel === "email" && !template.subjectTemplate) {
      errors.push(`email_subject_missing:${identity}`);
    }
    if (template.channel !== "email" && template.subjectTemplate) {
      errors.push(`unexpected_subject:${identity}`);
    }
    if (
      template.templateKey === "retention" &&
      template.channel === "whatsapp" &&
      !template.firstPersonVoiceApproved
    ) {
      errors.push(`retention_voice_not_approved:${identity}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
