import { renderTemplate } from "@/lib/messageTemplate";

export type NotificationLanguage = "he" | "ar" | "en";
export type NotificationChannel = "whatsapp" | "email";
export type NotificationAudience = "member" | "admin";

export type NotificationEventKey =
  | "booking_confirmed"
  | "booking_cancelled"
  | "waitlist_joined"
  | "waitlist_spot_available"
  | "package_request_received"
  | "payment_confirmed"
  | "receipt_issued"
  | "class_reminder_24h"
  | "no_show_followup";

export type NotificationTemplateDefinition = {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  language: NotificationLanguage;
  audience: NotificationAudience;
  subject: string | null;
  body: string;
};

export type NotificationVariables = Record<string, string | number | null | undefined>;

const LANGUAGES: NotificationLanguage[] = ["he", "ar", "en"];

function normalizeNotificationLanguage(value?: string | null): NotificationLanguage | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return LANGUAGES.includes(normalized as NotificationLanguage)
    ? (normalized as NotificationLanguage)
    : null;
}

export function resolveNotificationLanguage(input: {
  memberPreferredLanguage?: string | null;
  appLanguage?: string | null;
  studioDefaultLanguage?: string | null;
}): NotificationLanguage {
  return (
    normalizeNotificationLanguage(input.memberPreferredLanguage) ??
    normalizeNotificationLanguage(input.appLanguage) ??
    normalizeNotificationLanguage(input.studioDefaultLanguage) ??
    "he"
  );
}

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplateDefinition[] = [
  {
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    language: "he",
    audience: "member",
    subject: null,
    body: "שלום {{member_name}}, ההרשמה שלך לשיעור {{class_name}} אושרה.\nתאריך: {{class_date}}\nשעה: {{class_time}}\nמדריכה: {{instructor_name}}\nנתראה ב-{{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "email",
    language: "he",
    audience: "member",
    subject: "ההרשמה שלך אושרה · {{class_name}}",
    body: "שלום {{member_name}}, המקום שלך נשמר לשיעור {{class_name}} בתאריך {{class_date}} בשעה {{class_time}}. נתראה ב-{{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    language: "ar",
    audience: "member",
    subject: null,
    body: "مرحباً {{member_name}}، تم تأكيد حجزك لحصة {{class_name}}.\nالتاريخ: {{class_date}}\nالساعة: {{class_time}}\nالمدربة: {{instructor_name}}\nنراك في {{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "email",
    language: "ar",
    audience: "member",
    subject: "تم تأكيد حجزك · {{class_name}}",
    body: "مرحباً {{member_name}}، تم حفظ مكانك في حصة {{class_name}} بتاريخ {{class_date}} الساعة {{class_time}}. نراك في {{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    language: "en",
    audience: "member",
    subject: null,
    body: "Hi {{member_name}}, your booking for {{class_name}} is confirmed.\nDate: {{class_date}}\nTime: {{class_time}}\nInstructor: {{instructor_name}}\nSee you at {{studio_name}}.",
  },
  {
    eventKey: "booking_confirmed",
    channel: "email",
    language: "en",
    audience: "member",
    subject: "Your class booking is confirmed · {{class_name}}",
    body: "Hi {{member_name}}, your spot is saved for {{class_name}} on {{class_date}} at {{class_time}}. See you at {{studio_name}}.",
  },
];

const FALLBACK_BODIES: Record<NotificationEventKey, Record<NotificationLanguage, string>> = {
  booking_confirmed: {
    he: "שלום {{member_name}}, ההרשמה שלך לשיעור {{class_name}} אושרה.",
    ar: "مرحباً {{member_name}}، تم تأكيد حجزك لحصة {{class_name}}.",
    en: "Hi {{member_name}}, your booking for {{class_name}} is confirmed.",
  },
  booking_cancelled: {
    he: "שלום {{member_name}}, ההזמנה שלך לשיעור {{class_name}} בוטלה.",
    ar: "مرحباً {{member_name}}، تم إلغاء حجزك لحصة {{class_name}}.",
    en: "Hi {{member_name}}, your booking for {{class_name}} was cancelled.",
  },
  waitlist_joined: {
    he: "שלום {{member_name}}, הצטרפת לרשימת ההמתנה לשיעור {{class_name}}.",
    ar: "مرحباً {{member_name}}، تمت إضافتك إلى قائمة الانتظار لحصة {{class_name}}.",
    en: "Hi {{member_name}}, you joined the waitlist for {{class_name}}.",
  },
  waitlist_spot_available: {
    he: "שלום {{member_name}}, התפנה מקום בשיעור {{class_name}}.",
    ar: "مرحباً {{member_name}}، أصبح هناك مكان متاح في حصة {{class_name}}.",
    en: "Hi {{member_name}}, a spot is available in {{class_name}}.",
  },
  package_request_received: {
    he: "שלום {{member_name}}, בקשת החבילה {{package_name}} התקבלה וממתינה לאישור הסטודיו.",
    ar: "مرحباً {{member_name}}، تم استلام طلب باقة {{package_name}} وهو بانتظار تأكيد الاستوديو.",
    en: "Hi {{member_name}}, your {{package_name}} package request was received and is pending studio confirmation.",
  },
  payment_confirmed: {
    he: "שלום {{member_name}}, התשלום עבור {{package_name}} אושר.",
    ar: "مرحباً {{member_name}}، تم تأكيد الدفع مقابل {{package_name}}.",
    en: "Hi {{member_name}}, your payment for {{package_name}} is confirmed.",
  },
  receipt_issued: {
    he: "שלום {{member_name}}, הקבלה {{receipt_number}} הונפקה וזמינה באזור האישי.",
    ar: "مرحباً {{member_name}}، تم إصدار الإيصال {{receipt_number}} وهو متاح في حسابك.",
    en: "Hi {{member_name}}, receipt {{receipt_number}} was issued and is available in your account.",
  },
  class_reminder_24h: {
    he: "שלום {{member_name}}, תזכורת לשיעור {{class_name}} מחר בשעה {{class_time}}.",
    ar: "مرحباً {{member_name}}، تذكير بحصة {{class_name}} غداً الساعة {{class_time}}.",
    en: "Hi {{member_name}}, reminder: {{class_name}} is tomorrow at {{class_time}}.",
  },
  no_show_followup: {
    he: "שלום {{member_name}}, ראינו שלא הגעת לשיעור {{class_name}}. נשמח לראות אותך שוב בקרוב.",
    ar: "مرحباً {{member_name}}، لاحظنا أنك لم تحضر حصة {{class_name}}. نأمل أن نراك قريباً.",
    en: "Hi {{member_name}}, we noticed you missed {{class_name}}. We hope to see you again soon.",
  },
};

const EMAIL_SUBJECTS: Record<NotificationEventKey, Record<NotificationLanguage, string>> = {
  booking_confirmed: {
    he: "ההרשמה שלך אושרה · {{class_name}}",
    ar: "تم تأكيد حجزك · {{class_name}}",
    en: "Your class booking is confirmed · {{class_name}}",
  },
  booking_cancelled: {
    he: "ההזמנה לשיעור בוטלה · {{class_name}}",
    ar: "تم إلغاء حجز الحصة · {{class_name}}",
    en: "Your class booking was cancelled · {{class_name}}",
  },
  waitlist_joined: {
    he: "הצטרפת לרשימת ההמתנה · {{class_name}}",
    ar: "تمت إضافتك إلى قائمة الانتظار · {{class_name}}",
    en: "You joined the waitlist · {{class_name}}",
  },
  waitlist_spot_available: {
    he: "התפנה מקום בשיעור · {{class_name}}",
    ar: "أصبح هناك مكان متاح · {{class_name}}",
    en: "A class spot is available · {{class_name}}",
  },
  package_request_received: {
    he: "בקשת החבילה התקבלה · {{package_name}}",
    ar: "تم استلام طلب الباقة · {{package_name}}",
    en: "Package request received · {{package_name}}",
  },
  payment_confirmed: {
    he: "התשלום אושר · {{package_name}}",
    ar: "تم تأكيد الدفع · {{package_name}}",
    en: "Payment confirmed · {{package_name}}",
  },
  receipt_issued: {
    he: "הקבלה הונפקה · {{receipt_number}}",
    ar: "تم إصدار الإيصال · {{receipt_number}}",
    en: "Receipt issued · {{receipt_number}}",
  },
  class_reminder_24h: {
    he: "תזכורת לשיעור הקרוב · {{class_name}}",
    ar: "تذكير بالحصة القادمة · {{class_name}}",
    en: "Reminder for your upcoming class · {{class_name}}",
  },
  no_show_followup: {
    he: "נשמח לראות אותך שוב · {{class_name}}",
    ar: "نأمل أن نراك قريباً · {{class_name}}",
    en: "We hope to see you again · {{class_name}}",
  },
};

export function findNotificationTemplate(input: {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  language: NotificationLanguage;
  audience?: NotificationAudience;
}): NotificationTemplateDefinition {
  const audience = input.audience ?? "member";
  const existing = DEFAULT_NOTIFICATION_TEMPLATES.find(
    (template) =>
      template.eventKey === input.eventKey &&
      template.channel === input.channel &&
      template.language === input.language &&
      template.audience === audience,
  );
  if (existing) return existing;

  return {
    eventKey: input.eventKey,
    channel: input.channel,
    language: input.language,
    audience,
    subject: input.channel === "email" ? EMAIL_SUBJECTS[input.eventKey][input.language] : null,
    body: FALLBACK_BODIES[input.eventKey][input.language],
  };
}

export function renderNotificationCopy(
  template: NotificationTemplateDefinition,
  variables: NotificationVariables,
): { subject: string | null; body: string } {
  return {
    subject: template.subject ? renderTemplate(template.subject, variables) : null,
    body: renderTemplate(template.body, variables),
  };
}

export function notificationStaffVisibility(
  eventKey: NotificationEventKey,
): "operational" | "admin_only" {
  return eventKey === "payment_confirmed" ||
    eventKey === "receipt_issued" ||
    eventKey === "package_request_received"
    ? "admin_only"
    : "operational";
}

export function buildNotificationIdempotencyKey(input: {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  audience?: NotificationAudience;
  relatedIds: {
    bookingId?: string | null;
    waitlistEntryId?: string | null;
    packageRequestId?: string | null;
    paymentId?: string | null;
    receiptId?: string | null;
  };
}): string {
  const audience = input.audience ?? "member";
  if (input.eventKey === "package_request_received") {
    return `package_request:${input.relatedIds.packageRequestId}:package_request_received:${input.channel}:${audience}`;
  }
  if (input.eventKey === "payment_confirmed") {
    return `payment:${input.relatedIds.paymentId}:payment_confirmed:${input.channel}`;
  }
  if (input.eventKey === "receipt_issued") {
    return `receipt:${input.relatedIds.receiptId}:receipt_issued:${input.channel}`;
  }
  if (input.eventKey === "waitlist_joined" || input.eventKey === "waitlist_spot_available") {
    return `waitlist:${input.relatedIds.waitlistEntryId}:${input.eventKey}:${input.channel}`;
  }
  return `booking:${input.relatedIds.bookingId}:${input.eventKey}:${input.channel}`;
}
