import type { MemberNotificationCategory } from "@/lib/memberNotificationPolicy";

export type MemberAutomationEvent =
  | "class_cancelled_by_admin"
  | "class_reminder_2h"
  | "class_reminder_planning"
  | "class_time_changed"
  | "first_lesson_followup"
  | "low_credits"
  | "no_upcoming_booking_14d"
  | "package_approved_no_booking"
  | "package_expiring_soon"
  | "payment_failed"
  | "payment_confirmed"
  | "payment_pending"
  | "registered_no_action"
  | "schedule_opened"
  | "waitlist_spot_available";

export type MemberNotificationLanguage = "he" | "ar" | "en";

type CopyVariables = Record<string, string | number | null | undefined>;

export type MemberNotificationCopy = {
  category: MemberNotificationCategory;
  title: string;
  body: string;
  actionUrl: string;
};

function value(variables: CopyVariables, key: string, fallback = "") {
  const result = String(variables[key] ?? "").trim();
  return result || fallback;
}

function scheduleUrl(variables: CopyVariables) {
  const classId = value(variables, "class_id");
  return classId ? `/member/schedule?class=${encodeURIComponent(classId)}` : "/member/schedule";
}

export function normalizeMemberNotificationLanguage(
  language: string | null | undefined,
): MemberNotificationLanguage {
  return language === "ar" || language === "en" ? language : "he";
}

export function buildMemberNotificationCopy(
  event: MemberAutomationEvent,
  language: MemberNotificationLanguage,
  variables: CopyVariables,
): MemberNotificationCopy {
  const className = value(variables, "class_name", language === "he" ? "השיעור" : "Class");
  const classTime = value(variables, "class_time");
  const credits = value(variables, "credits_remaining");
  const expires = value(variables, "expires_on");
  const notificationStage = value(variables, "notification_stage");
  const weeklyStage = Number(notificationStage.replace("week", ""));
  const alternateWeeklyCopy = Number.isFinite(weeklyStage) && weeklyStage % 2 === 1;

  const copy: Record<
    MemberAutomationEvent,
    Record<MemberNotificationLanguage, MemberNotificationCopy>
  > = {
    class_cancelled_by_admin: {
      he: {
        category: "urgent_class_change",
        title: `${className} בוטל`,
        body: "השיעור לא יתקיים. פתחי את האפליקציה כדי לראות את פרטי ההזמנה.",
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "urgent_class_change",
        title: `تم إلغاء ${className}`,
        body: "لن تقام الحصة. افتحي التطبيق لمراجعة تفاصيل الحجز.",
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "urgent_class_change",
        title: `${className} was cancelled`,
        body: "This class will not take place. Open the app to review your booking.",
        actionUrl: scheduleUrl(variables),
      },
    },
    class_time_changed: {
      he: {
        category: "urgent_class_change",
        title: `השעה של ${className} השתנתה`,
        body: `השעה החדשה היא ${classTime}. פתחי את האפליקציה לפרטים.`,
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "urgent_class_change",
        title: `تغير وقت ${className}`,
        body: `الوقت الجديد هو ${classTime}. افتحي التطبيق للتفاصيل.`,
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "urgent_class_change",
        title: `${className} has a new time`,
        body: `The new time is ${classTime}. Open the app for details.`,
        actionUrl: scheduleUrl(variables),
      },
    },
    waitlist_spot_available: {
      he: {
        category: "waitlist",
        title: `התפנה מקום ב-${className}`,
        body: "פתחי את האפליקציה עכשיו כדי לשמור אותו לפני שההצעה מסתיימת.",
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "waitlist",
        title: `توفر مكان في ${className}`,
        body: "افتحي التطبيق الآن لحجزه قبل انتهاء العرض.",
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "waitlist",
        title: `A place opened in ${className}`,
        body: "Open the app now to claim it before the offer expires.",
        actionUrl: scheduleUrl(variables),
      },
    },
    schedule_opened: {
      he: {
        category: "schedule",
        title: `${className} נפתח להרשמה`,
        body: `שיעור חדש בשעה ${classTime} מחכה לך במערכת.`,
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "schedule",
        title: `فُتح التسجيل في ${className}`,
        body: `حصة جديدة الساعة ${classTime} متاحة الآن في الجدول.`,
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "schedule",
        title: `${className} is now open`,
        body: `A new lesson at ${classTime} is available in the schedule.`,
        actionUrl: scheduleUrl(variables),
      },
    },
    registered_no_action: {
      he: {
        category: "activation",
        title: "השיעור הראשון שלך מחכה",
        body:
          notificationStage === "day3"
            ? "אפשר להתחיל בקצב שלך — פתחי את המערכת ובחרי זמן שנוח לך."
            : notificationStage === "day7"
              ? "שבוע חדש הוא הזדמנות נעימה להתחיל. השיעורים הפתוחים מחכים במערכת."
              : alternateWeeklyCopy
                ? "כשתרגישי שזה הזמן להתחיל, תוכלי לראות במערכת מה מתאים לשבוע שלך."
                : "פתחי את המערכת ובחרי את השיעור שמתאים לשבוע שלך.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "activation",
        title: "حصتك الأولى بانتظارك",
        body:
          notificationStage === "day3"
            ? "ابدئي بإيقاعك — افتحي الجدول واختاري الوقت المناسب لك."
            : notificationStage === "day7"
              ? "أسبوع جديد فرصة لطيفة للبدء. الحصص المفتوحة بانتظارك في الجدول."
              : alternateWeeklyCopy
                ? "عندما تشعرين أن الوقت مناسب، ستجدين في الجدول ما يلائم أسبوعك."
                : "افتحي الجدول واختاري الحصة المناسبة لأسبوعك.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "activation",
        title: "Your first lesson is waiting",
        body:
          notificationStage === "day3"
            ? "Start at your pace—open the schedule and choose a time that suits you."
            : notificationStage === "day7"
              ? "A new week is a gentle chance to begin. Open classes are waiting in the schedule."
              : alternateWeeklyCopy
                ? "When the time feels right, the schedule can help you find what fits your week."
                : "Open the schedule and choose the class that fits your week.",
        actionUrl: "/member/schedule",
      },
    },
    package_approved_no_booking: {
      he: {
        category: "activation",
        title: "החבילה שלך מוכנה",
        body: "נשאר רק לבחור שיעור ראשון ולהתחיל.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "activation",
        title: "باقتك جاهزة",
        body: "تبقى فقط اختيار حصتك الأولى والبدء.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "activation",
        title: "Your package is ready",
        body: "Choose your first class and begin when it suits you.",
        actionUrl: "/member/schedule",
      },
    },
    first_lesson_followup: {
      he: {
        category: "retention",
        title: "שמחנו לראות אותך בסטודיו",
        body: "כשתרצי להמשיך, השיעור הבא שלך מחכה במערכת.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "retention",
        title: "سعدنا برؤيتك في الاستوديو",
        body: "عندما ترغبين بالاستمرار، حصتك التالية بانتظارك في الجدول.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "retention",
        title: "It was lovely seeing you",
        body: "When you are ready, your next class is waiting in the schedule.",
        actionUrl: "/member/schedule",
      },
    },
    low_credits: {
      he: {
        category: "package",
        title: `נשארו לך ${credits || "מעט"} קרדיטים`,
        body: "אפשר לחדש את החבילה ולשמור על רצף האימונים.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "package",
        title: `تبقى لديك ${credits || "عدد قليل من"} أرصدة`,
        body: "يمكنك تجديد الباقة والحفاظ على استمرارية التمارين.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "package",
        title: `${credits || "A few"} credits remaining`,
        body: "Renew your package when you are ready to keep your practice moving.",
        actionUrl: "/member/packages",
      },
    },
    package_expiring_soon: {
      he: {
        category: "package",
        title: "החבילה שלך מסתיימת בקרוב",
        body: expires ? `בתוקף עד ${expires}. אפשר לחדש מהאפליקציה.` : "אפשר לחדש מהאפליקציה.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "package",
        title: "باقتك تنتهي قريباً",
        body: expires
          ? `صالحة حتى ${expires}. يمكنك التجديد من التطبيق.`
          : "يمكنك التجديد من التطبيق.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "package",
        title: "Your package expires soon",
        body: expires ? `Valid until ${expires}. Renew from the app.` : "Renew from the app.",
        actionUrl: "/member/packages",
      },
    },
    no_upcoming_booking_14d: {
      he: {
        category: "retention",
        title: "התגעגענו אלייך בסטודיו",
        body: alternateWeeklyCopy
          ? "אפשר לחזור בעדינות ובקצב שלך — השיעורים הקרובים מחכים במערכת."
          : "רוצה לחזור השבוע? בחרי שיעור שמתאים לקצב שלך.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "retention",
        title: "افتقدناك في الاستوديو",
        body: alternateWeeklyCopy
          ? "يمكنك العودة بلطف وبإيقاعك — الحصص القريبة بانتظارك في الجدول."
          : "هل ترغبين بالعودة هذا الأسبوع؟ اختاري حصة تناسب إيقاعك.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "retention",
        title: "We missed you at the studio",
        body: alternateWeeklyCopy
          ? "Come back gently, at your pace—the next classes are waiting in the schedule."
          : "Ready to return this week? Choose a class that fits your rhythm.",
        actionUrl: "/member/schedule",
      },
    },
    class_reminder_planning: {
      he: {
        category: "lesson_reminder",
        title: `מתכננות את ${className}`,
        body: "זה הזמן לוודא שהשיעור עדיין מתאים, לפני שמועד הביטול נסגר.",
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "lesson_reminder",
        title: `تأكيد ${className}`,
        body: "تأكدي أن الموعد ما زال مناسباً قبل انتهاء فترة الإلغاء.",
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "lesson_reminder",
        title: `Planning for ${className}`,
        body: "Confirm the class still works before the cancellation window closes.",
        actionUrl: scheduleUrl(variables),
      },
    },
    class_reminder_2h: {
      he: {
        category: "lesson_reminder",
        title: `${className} מתחיל בקרוב`,
        body: `השיעור מתחיל ב-${classTime}. נתראה בסטודיו.`,
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "lesson_reminder",
        title: `${className} تبدأ قريباً`,
        body: `تبدأ الحصة الساعة ${classTime}. نراك في الاستوديو.`,
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "lesson_reminder",
        title: `${className} starts soon`,
        body: `Your lesson begins at ${classTime}. See you at the studio.`,
        actionUrl: scheduleUrl(variables),
      },
    },
    payment_pending: {
      he: {
        category: "package",
        title: "התשלום שלך עדיין ממתין",
        body: "פתחי את האפליקציה כדי להשלים את התשלום ולהפעיל את החבילה.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "package",
        title: "دفعتك ما زالت معلقة",
        body: "افتحي التطبيق لإكمال الدفع وتفعيل الباقة.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "package",
        title: "Your payment is still pending",
        body: "Open the app to complete payment and activate your package.",
        actionUrl: "/member/packages",
      },
    },
    payment_confirmed: {
      he: {
        category: "payment_confirmed",
        title: "התשלום אושר",
        body: "החבילה והקבלה מחכות לך באזור האישי.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "payment_confirmed",
        title: "تم تأكيد الدفع",
        body: "الباقة والإيصال متاحان في حسابك.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "payment_confirmed",
        title: "Payment confirmed",
        body: "Your package and receipt are available in your account.",
        actionUrl: "/member/packages",
      },
    },
    payment_failed: {
      he: {
        category: "payment_failed",
        title: "התשלום דורש תשומת לב",
        body: "פתחי את האפליקציה כדי לבדוק את התשלום ולשמור על החבילה פעילה.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "payment_failed",
        title: "دفعتك تحتاج إلى مراجعة",
        body: "افتحي التطبيق لمراجعة الدفع والحفاظ على تفعيل الباقة.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "payment_failed",
        title: "Your payment needs attention",
        body: "Open the app to review your payment and keep your package active.",
        actionUrl: "/member/packages",
      },
    },
  };

  return copy[event][language];
}
