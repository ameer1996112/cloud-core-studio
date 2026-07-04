import { renderTemplate } from "@/lib/messageTemplate";

export type NotificationLanguage = "he" | "ar" | "en";
export type NotificationChannel = "whatsapp" | "email";
export type NotificationAudience = "member" | "admin";

export type NotificationEventKey =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_cancelled_by_member"
  | "waitlist_joined"
  | "waitlist_spot_available"
  | "payment_request_received"
  | "payment_confirmed"
  | "receipt_issued"
  | "class_cancelled_by_admin"
  | "class_time_changed"
  | "class_reminder_24h"
  | "class_reminder_2h"
  | "no_show_followup"
  | "registered_no_action"
  | "package_approved_no_booking"
  | "first_lesson_followup"
  | "low_credits"
  | "package_expiring_soon"
  | "no_upcoming_booking_14d";

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
    body: "{{member_name}}, איזה כיף שהמקום שלך נשמר 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nעם {{instructor_name}}\n\nמחכה לראות אותך בסטודיו\nירין",
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
    body: "{{member_name}}، تم حفظ حجزك 🕊️\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nمع {{instructor_name}}\n\nننتظرك في {{studio_name}}",
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
    body: "Hi {{member_name}}, your spot is saved 🕊️\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nWith {{instructor_name}}\n\nSee you at {{studio_name}}",
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
    he: "{{member_name}}, איזה כיף שהמקום שלך נשמר 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nעם {{instructor_name}}\n\nמחכה לראות אותך בסטודיו\nירין",
    ar: "{{member_name}}، تم حفظ حجزك 🕊️\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nمع {{instructor_name}}\n\nننتظرك في {{studio_name}}",
    en: "Hi {{member_name}}, your spot is saved 🕊️\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nWith {{instructor_name}}\n\nSee you at {{studio_name}}",
  },
  booking_cancelled: {
    he: "{{member_name}}, ההזמנה בוטלה\n\n{{class_name}}\n\nאם תרצי לבחור שיעור אחר, אני כאן.",
    ar: "تم إلغاء الحجز\n\n{{class_name}}\nإذا احتجت مساعدة في اختيار حصة أخرى، نحن هنا.",
    en: "Your booking was cancelled\n\n{{class_name}}\nIf you need help choosing another class, we are here.",
  },
  booking_cancelled_by_member: {
    he: "{{member_name}}, הביטול נקלט\n\n{{class_name}}\n\nאם מגיע לך זיכוי, הוא עודכן בחשבון שלך.\nירין",
    ar: "تم استلام الإلغاء\n\n{{class_name}}\nإذا كان هناك رصيد مستحق، فقد تم تحديثه في حسابك.",
    en: "Your cancellation is confirmed\n\n{{class_name}}\nIf a credit is due, it has been returned to your account.",
  },
  waitlist_joined: {
    he: "{{member_name}}, נכנסת לרשימת ההמתנה\n\n{{class_name}}\n\nאם יתפנה מקום, אעדכן אותך.",
    ar: "تمت إضافتك إلى قائمة الانتظار\n\n{{class_name}}\nسنخبرك إذا توفر مكان.",
    en: "You joined the waitlist\n\n{{class_name}}\nWe will let you know if a spot opens.",
  },
  waitlist_spot_available: {
    he: "{{member_name}}, התפנה לך מקום 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nאם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו.\nירין",
    ar: "أصبح هناك مكان متاح لك 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nيمكنك إكمال الحجز الآن إذا كان الموعد مناسباً.",
    en: "A spot opened for you 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nYou can complete the booking now if it works for you.",
  },
  payment_request_received: {
    he: "{{member_name}}, ראיתי את בקשת התשלום שלך\n\n{{package_name}}\nאאשר אותה בהקדם ואעדכן אותך כשהחבילה תהיה פעילה.\nירין",
    ar: "تم استلام طلب الدفع\n\n{{package_name}}\nسيقوم الفريق بتأكيده قريباً.",
    en: "Your payment request was received\n\n{{package_name}}\nThe studio team will confirm it soon.",
  },
  payment_confirmed: {
    he: "{{member_name}}, התשלום אושר והחבילה שלך פעילה ✨\n\n{{package_name}}\n\nתוכלי לבחור שיעור ולהמשיך בקצב שמתאים לך.\nירין",
    ar: "تم تأكيد الدفع ✨\n\n{{package_name}}\nتم تحديث الباقة في حسابك.\n\nشكراً لاختيارك {{studio_name}}",
    en: "Payment confirmed ✨\n\n{{package_name}}\nYour package has been updated in your account.\n\nThank you for continuing with {{studio_name}}.",
  },
  receipt_issued: {
    he: "{{member_name}}, הקבלה הונפקה\n\n{{receipt_number}}\nאפשר לצפות בה באזור האישי.",
    ar: "تم إصدار الإيصال\n\n{{receipt_number}}\nيمكنك مشاهدته في حسابك.",
    en: "Receipt issued\n\n{{receipt_number}}\nYou can view it in your member area.",
  },
  class_cancelled_by_admin: {
    he: "{{member_name}}, עדכון מהסטודיו\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nהשיעור לא יתקיים הפעם.\nאם תרצי, אעזור לך למצוא שיעור חלופי.\nירין",
    ar: "تحديث من الاستوديو\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nلن تقام الحصة.\n\nسنخبرك إذا توفر موعد بديل.",
    en: "Studio update\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nThis class will not take place.\n\nWe will let you know if an alternative opens.",
  },
  class_time_changed: {
    he: "{{member_name}}, עדכון קטן לשעת השיעור\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nאם השעה החדשה לא מסתדרת לך, כתבי לי.\nירין",
    ar: "تم تحديث وقت الحصة\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nننتظرك في {{studio_name}}",
    en: "Class time updated\n\n{{class_name}}\n{{class_date}} · {{class_time}}\n\nSee you at {{studio_name}}",
  },
  class_reminder_24h: {
    he: "{{member_name}}, תזכורת קטנה למחר 🤍\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nעם {{instructor_name}}\n\nמחכה לראות אותך בסטודיו\nירין",
    ar: "تذكير لطيف للغد ⏰\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nمع {{instructor_name}}\n\nننتظرك في {{studio_name}}",
    en: "A gentle reminder for tomorrow ⏰\n\n{{class_name}}\n{{class_date}} · {{class_time}}\nWith {{instructor_name}}\n\nSee you at {{studio_name}}",
  },
  class_reminder_2h: {
    he: "{{member_name}}, תזכורת קטנה להיום\n\n{{class_name}} מתחיל ב-{{class_time}}.\nנתראה ממש בקרוב.\nירין",
    ar: "تذكير قصير\n\n{{class_name}} تبدأ اليوم الساعة {{class_time}}.\nنراك قريباً.",
    en: "Quick reminder\n\n{{class_name}} starts today at {{class_time}}.\nSee you soon.",
  },
  no_show_followup: {
    he: "{{member_name}}, התגעגענו אלייך בשיעור 🤍\n\n{{class_name}}\n\nמקווה שהכול בסדר. כשתרצי לחזור, אני כאן לעזור לבחור שיעור מתאים.\nירין",
    ar: "افتقدناك في الحصة\n\n{{class_name}}\nنأمل أن نراك قريباً.",
    en: "We missed you in class\n\n{{class_name}}\nWe hope to see you again soon.",
  },
  registered_no_action: {
    he: "{{member_name}}, ברוכה הבאה ל-{{studio_name}} 🤍\n\nראיתי שפתחת חשבון ועדיין לא בחרת שיעור.\nאם תרצי, אעזור לך למצוא התחלה שמתאימה לקצב שלך.\n\nירין",
    ar: "{{member_name}}، أهلاً بك في {{studio_name}} 🕊️\n\nلاحظنا أنك فتحت حساباً ولم تختاري حصة بعد.\nإذا رغبت، يسعدنا مساعدتك في اختيار بداية مناسبة لك.",
    en: "Hi {{member_name}}, welcome to {{studio_name}} 🕊️\n\nWe saw you opened an account but have not chosen a class yet.\nWhen you are ready, we can help you find the right first step.",
  },
  package_approved_no_booking: {
    he: "{{member_name}}, החבילה שלך כבר מחכה לך ✨\n\n{{package_name}}\n\nנשאר רק לבחור שיעור ראשון. אם תרצי עזרה להתחיל, אני כאן.\nירין",
    ar: "{{member_name}}، أصبحت باقتك فعالة ✨\n\n{{package_name}}\nتبقى فقط اختيار الحصة الأولى والبدء بالحركة.",
    en: "Hi {{member_name}}, your package is active ✨\n\n{{package_name}}\nAll that is left is choosing your first class.",
  },
  first_lesson_followup: {
    he: "{{member_name}}, שמחתי לראות אותך היום בסטודיו 🤍\n\nמקווה שהשיעור הרגיש נעים וטוב בגוף.\nכשתרצי להמשיך, אעזור לך לבחור את השיעור הבא.\n\nירין",
    ar: "{{member_name}}، سعدنا بلقائك اليوم في الاستوديو 🤍\n\nنتمنى أن تكون الحصة مريحة ولطيفة.\nعندما ترغبين بالاستمرار، نساعدك في اختيار الحصة التالية.",
    en: "Hi {{member_name}}, it was lovely seeing you in the studio today 🤍\n\nWe hope class felt good.\nWhen you are ready to continue, we can help you choose the next one.",
  },
  low_credits: {
    he: "{{member_name}}, נשארו לך {{credits_remaining}} כניסות בחבילה\n\nאם תרצי לשמור על רצף, אפשר לבחור את החבילה הבאה בזמן שנוח לך.\nאני כאן אם תרצי עזרה.\nירין",
    ar: "{{member_name}}، تبقى لديك {{credits_remaining}} دخول في الباقة\n\nإذا رغبت بالاستمرار، نساعدك في اختيار الباقة التالية.",
    en: "Hi {{member_name}}, you have {{credits_remaining}} credits left\n\nIf you want to keep your rhythm, we can help you choose the next package.",
  },
  package_expiring_soon: {
    he: "{{member_name}}, החבילה שלך מסתיימת בקרוב\n\n{{package_name}}\nבתוקף עד {{expires_on}}\n\nאם תרצי להמשיך ברצף, אני כאן לעזור.\nירין",
    ar: "{{member_name}}، باقتك تنتهي قريباً\n\n{{package_name}}\nصالحة حتى {{expires_on}}\n\nإذا رغبت بالاستمرار، نحن هنا للمساعدة.",
    en: "Hi {{member_name}}, your package expires soon\n\n{{package_name}}\nValid until {{expires_on}}\n\nIf you want to keep going, we are here to help.",
  },
  no_upcoming_booking_14d: {
    he: "{{member_name}}, התגעגענו אלייך בסטודיו 🤍\n\nאם מתאים לך לחזור השבוע, אעזור לך למצוא שיעור שמתאים לקצב שלך.\nירין",
    ar: "{{member_name}}، افتقدناك في الاستوديو 🤍\n\nإذا كان مناسباً أن تعودي هذا الأسبوع، نساعدك في إيجاد حصة تناسبك.",
    en: "Hi {{member_name}}, we missed you at the studio 🤍\n\nIf this week feels right, we can help you find a class that fits your rhythm.",
  },
};

const ADMIN_FALLBACK_BODIES: Partial<
  Record<NotificationEventKey, Record<NotificationLanguage, string>>
> = {
  payment_request_received: {
    he: "בקשת תשלום חדשה התקבלה עבור {{member_name}}: {{package_name}}.",
    ar: "تم استلام طلب دفع جديد للعضو {{member_name}}: {{package_name}}.",
    en: "A new payment request was received for {{member_name}}: {{package_name}}.",
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
  booking_cancelled_by_member: {
    he: "הביטול שלך אושר · {{class_name}}",
    ar: "تم تأكيد إلغاء الحجز · {{class_name}}",
    en: "Your cancellation is confirmed · {{class_name}}",
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
  payment_request_received: {
    he: "בקשת התשלום התקבלה · {{package_name}}",
    ar: "تم استلام طلب الدفع · {{package_name}}",
    en: "Payment request received · {{package_name}}",
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
  class_cancelled_by_admin: {
    he: "השיעור בוטל · {{class_name}}",
    ar: "تم إلغاء الحصة · {{class_name}}",
    en: "Class cancelled · {{class_name}}",
  },
  class_time_changed: {
    he: "שעת השיעור עודכנה · {{class_name}}",
    ar: "تم تحديث وقت الحصة · {{class_name}}",
    en: "Class time changed · {{class_name}}",
  },
  class_reminder_24h: {
    he: "תזכורת לשיעור הקרוב · {{class_name}}",
    ar: "تذكير بالحصة القادمة · {{class_name}}",
    en: "Reminder for your upcoming class · {{class_name}}",
  },
  class_reminder_2h: {
    he: "תזכורת אחרונה לשיעור · {{class_name}}",
    ar: "تذكير أخير بالحصة · {{class_name}}",
    en: "Final class reminder · {{class_name}}",
  },
  no_show_followup: {
    he: "נשמח לראות אותך שוב · {{class_name}}",
    ar: "نأمل أن نراك قريباً · {{class_name}}",
    en: "We hope to see you again · {{class_name}}",
  },
  registered_no_action: {
    he: "ברוכה הבאה ל-{{studio_name}}",
    ar: "أهلاً بك في {{studio_name}}",
    en: "Welcome to {{studio_name}}",
  },
  package_approved_no_booking: {
    he: "החבילה שלך פעילה · {{package_name}}",
    ar: "باقتك فعالة · {{package_name}}",
    en: "Your package is active · {{package_name}}",
  },
  first_lesson_followup: {
    he: "שמחנו לפגוש אותך בסטודיו",
    ar: "سعدنا بلقائك في الاستوديو",
    en: "Lovely seeing you in the studio",
  },
  low_credits: {
    he: "נשארו לך {{credits_remaining}} כניסות",
    ar: "تبقى لديك {{credits_remaining}} دخول",
    en: "{{credits_remaining}} credits left",
  },
  package_expiring_soon: {
    he: "החבילה מסתיימת בקרוב · {{package_name}}",
    ar: "الباقة تنتهي قريباً · {{package_name}}",
    en: "Package expiring soon · {{package_name}}",
  },
  no_upcoming_booking_14d: {
    he: "התגעגענו אלייך בסטודיו",
    ar: "افتقدناك في الاستوديو",
    en: "We missed you at the studio",
  },
};

const ADMIN_EMAIL_SUBJECTS: Partial<
  Record<NotificationEventKey, Record<NotificationLanguage, string>>
> = {
  payment_request_received: {
    he: "בקשת תשלום חדשה מחכה לטיפול · {{package_name}}",
    ar: "طلب دفع جديد بانتظار المتابعة · {{package_name}}",
    en: "New payment request awaiting review · {{package_name}}",
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

  const adminBody = input.audience === "admin" ? ADMIN_FALLBACK_BODIES[input.eventKey] : undefined;
  const adminSubject =
    input.audience === "admin" ? ADMIN_EMAIL_SUBJECTS[input.eventKey] : undefined;

  return {
    eventKey: input.eventKey,
    channel: input.channel,
    language: input.language,
    audience,
    subject:
      input.channel === "email"
        ? (adminSubject?.[input.language] ?? EMAIL_SUBJECTS[input.eventKey][input.language])
        : null,
    body: adminBody?.[input.language] ?? FALLBACK_BODIES[input.eventKey][input.language],
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
  audience?: NotificationAudience,
): "operational" | "admin_only" {
  return eventKey === "payment_confirmed" ||
    eventKey === "receipt_issued" ||
    (eventKey === "payment_request_received" && audience === "admin")
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
    memberId?: string | null;
    memberPlanId?: string | null;
    classId?: string | null;
  };
}): string {
  const audience = input.audience ?? "member";
  if (input.eventKey === "registered_no_action") {
    return `member:${input.relatedIds.memberId}:registered_no_action:${input.channel}`;
  }
  if (input.eventKey === "package_approved_no_booking") {
    return `member_plan:${input.relatedIds.memberPlanId}:package_approved_no_booking:${input.channel}`;
  }
  if (input.eventKey === "first_lesson_followup") {
    return `member:${input.relatedIds.memberId}:first_lesson_followup:${input.channel}`;
  }
  if (input.eventKey === "low_credits") {
    return `member:${input.relatedIds.memberId}:low_credits:${input.channel}`;
  }
  if (input.eventKey === "package_expiring_soon") {
    return `member_plan:${input.relatedIds.memberPlanId}:package_expiring_soon:${input.channel}`;
  }
  if (input.eventKey === "no_upcoming_booking_14d") {
    return `member:${input.relatedIds.memberId}:no_upcoming_booking_14d:${input.channel}`;
  }
  if (input.eventKey === "payment_request_received") {
    const sourceId = input.relatedIds.packageRequestId ?? input.relatedIds.paymentId;
    return `payment_request:${sourceId}:payment_request_received:${input.channel}:${audience}`;
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
