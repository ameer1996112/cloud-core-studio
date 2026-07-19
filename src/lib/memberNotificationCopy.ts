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
  const className = value(
    variables,
    "class_name",
    language === "he" ? "השיעור" : language === "ar" ? "الحصة" : "Your class",
  );
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
        title: `עדכון חשוב: ${className} בוטל`,
        body: "השיעור לא יתקיים הפעם. לחצי כדי לבחור שיעור חלופי שמתאים לך.",
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "urgent_class_change",
        title: `تحديث مهم: تم إلغاء ${className}`,
        body: "لن تُقام الحصة هذه المرة. اضغطي لاختيار موعد بديل يناسبك.",
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "urgent_class_change",
        title: `Important update: ${className} was cancelled`,
        body: "This class won’t take place. Tap to choose another time that works for you.",
        actionUrl: scheduleUrl(variables),
      },
    },
    class_time_changed: {
      he: {
        category: "urgent_class_change",
        title: `שעה חדשה ל-${className}`,
        body: `${classTime} היא השעה החדשה. לחצי לבדוק את פרטי השיעור המעודכנים.`,
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "urgent_class_change",
        title: `موعد جديد لـ ${className}`,
        body: `${classTime} هو الموعد الجديد. اضغطي لمراجعة تفاصيل الحصة المحدثة.`,
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "urgent_class_change",
        title: `A new time for ${className}`,
        body: `${classTime} is the new start time. Tap to review the updated class details.`,
        actionUrl: scheduleUrl(variables),
      },
    },
    waitlist_spot_available: {
      he: {
        category: "waitlist",
        title: `המקום שלך התפנה ב-${className} 🤍`,
        body: "הוא שמור לזמן מוגבל. לחצי עכשיו כדי לתפוס אותו.",
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "waitlist",
        title: `أصبح مكانك متاحاً في ${className} 🤍`,
        body: "المكان محفوظ لوقت محدود. اضغطي الآن لتأكيده.",
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "waitlist",
        title: `Your spot opened in ${className} 🤍`,
        body: "It’s held for a limited time. Tap now to claim it.",
        actionUrl: scheduleUrl(variables),
      },
    },
    schedule_opened: {
      he: {
        category: "schedule",
        title: `חדש במערכת: ${className} ✨`,
        body: `${classTime} · המקומות פתוחים עכשיו. לחצי לשמור את המקום שלך.`,
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "schedule",
        title: `جديد في الجدول: ${className} ✨`,
        body: `${classTime} · التسجيل مفتوح الآن. اضغطي لحفظ مكانك.`,
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "schedule",
        title: `New in the schedule: ${className} ✨`,
        body: `${classTime} · Spots are open now. Tap to save yours.`,
        actionUrl: scheduleUrl(variables),
      },
    },
    registered_no_action: {
      he: {
        category: "activation",
        title: "רגע קטן לעצמך מחכה ✨",
        body:
          notificationStage === "day3"
            ? "התחלה טובה יכולה להיות פשוטה. לחצי לבחור שיעור שמתאים לקצב שלך."
            : notificationStage === "day7"
              ? "שבוע חדש, הזדמנות חדשה לנוע. לחצי למצוא את השיעור שלך."
              : alternateWeeklyCopy
                ? "כשתרגישי שזה הזמן, השיעור הנכון מחכה לך במערכת."
                : "השיעורים הקרובים כבר פתוחים. לחצי לבחור את הרגע שלך השבוע.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "activation",
        title: "لحظة جميلة لنفسك بانتظارك ✨",
        body:
          notificationStage === "day3"
            ? "البداية الجميلة قد تكون بسيطة. اضغطي لاختيار حصة تناسب إيقاعك."
            : notificationStage === "day7"
              ? "أسبوع جديد وفرصة جديدة للحركة. اضغطي لتجدي حصتك."
              : alternateWeeklyCopy
                ? "عندما يحين الوقت المناسب، ستجدين حصتك في الجدول."
                : "الحصص القادمة مفتوحة الآن. اضغطي لاختيار لحظتك هذا الأسبوع.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "activation",
        title: "A little time for yourself is waiting ✨",
        body:
          notificationStage === "day3"
            ? "A good beginning can be simple. Tap to choose a class at your pace."
            : notificationStage === "day7"
              ? "A new week, a fresh chance to move. Tap to find your class."
              : alternateWeeklyCopy
                ? "When the time feels right, your class will be waiting in the schedule."
                : "The next classes are open. Tap to choose your moment this week.",
        actionUrl: "/member/schedule",
      },
    },
    package_approved_no_booking: {
      he: {
        category: "activation",
        title: "החבילה שלך מוכנה ✨",
        body: "נשאר רק לבחור שיעור ראשון. לחצי למצוא את הזמן שמתאים לך.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "activation",
        title: "باقتك جاهزة ✨",
        body: "تبقى فقط اختيار حصتك الأولى. اضغطي لإيجاد الوقت المناسب لك.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "activation",
        title: "Your package is ready ✨",
        body: "All that’s left is choosing your first class. Tap to find your time.",
        actionUrl: "/member/schedule",
      },
    },
    first_lesson_followup: {
      he: {
        category: "retention",
        title: "היה נפלא לפגוש אותך 🤍",
        body: "רוצה לשמור על התחושה? לחצי לבחור את השיעור הבא שלך.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "retention",
        title: "سعدنا بلقائك 🤍",
        body: "هل ترغبين بالحفاظ على هذا الشعور؟ اضغطي لاختيار حصتك التالية.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "retention",
        title: "It was lovely seeing you 🤍",
        body: "Want to keep that feeling going? Tap to choose your next class.",
        actionUrl: "/member/schedule",
      },
    },
    low_credits: {
      he: {
        category: "package",
        title: `נשארו לך ${credits || "מעט"} אימונים בחבילה`,
        body: "זה הזמן לשמור על הרצף. לחצי לבחור את החבילה הבאה שלך.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "package",
        title: `تبقى لديك ${credits || "بضعة"} حصص في الباقة`,
        body: "حافظي على استمراريتك. اضغطي لاختيار باقتك التالية.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "package",
        title: `${credits || "A few"} classes left in your package`,
        body: "Keep your rhythm going. Tap to choose your next package.",
        actionUrl: "/member/packages",
      },
    },
    package_expiring_soon: {
      he: {
        category: "package",
        title: expires ? `החבילה בתוקף עד ${expires}` : "החבילה מסתיימת בקרוב",
        body: "רוצה להמשיך בלי לעצור? לחצי לחידוש מהיר מהאפליקציה.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "package",
        title: expires ? `باقتك صالحة حتى ${expires}` : "باقتك تنتهي قريباً",
        body: "هل ترغبين بالاستمرار دون توقف؟ اضغطي للتجديد السريع.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "package",
        title: expires ? `Your package is valid until ${expires}` : "Your package expires soon",
        body: "Want to keep moving without a pause? Tap for a quick renewal.",
        actionUrl: "/member/packages",
      },
    },
    no_upcoming_booking_14d: {
      he: {
        category: "retention",
        title: "הגיע הזמן לחזור לעצמך 🤍",
        body: alternateWeeklyCopy
          ? "אפשר לחזור בעדינות ובקצב שלך. לחצי לראות מה מחכה השבוע."
          : "השיעורים הקרובים כבר מחכים. לחצי לבחור את הרגע שלך השבוע.",
        actionUrl: "/member/schedule",
      },
      ar: {
        category: "retention",
        title: "حان الوقت للعودة إلى نفسك 🤍",
        body: alternateWeeklyCopy
          ? "يمكنك العودة بلطف وبإيقاعك. اضغطي لترَي ما ينتظرك هذا الأسبوع."
          : "الحصص القادمة بانتظارك. اضغطي لاختيار لحظتك هذا الأسبوع.",
        actionUrl: "/member/schedule",
      },
      en: {
        category: "retention",
        title: "A little return to yourself 🤍",
        body: alternateWeeklyCopy
          ? "Come back gently, at your pace. Tap to see what’s waiting this week."
          : "The next classes are waiting. Tap to choose your moment this week.",
        actionUrl: "/member/schedule",
      },
    },
    class_reminder_planning: {
      he: {
        category: "lesson_reminder",
        title: `${className} מחכה לך`,
        body: "רק לוודא שהזמן עדיין מתאים. לחצי לפרטים לפני שמועד הביטול נסגר.",
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "lesson_reminder",
        title: `${className} بانتظارك`,
        body: "للتأكد فقط أن الوقت ما زال مناسباً. اضغطي للتفاصيل قبل انتهاء مهلة الإلغاء.",
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "lesson_reminder",
        title: `${className} is waiting for you`,
        body: "Just checking the time still works. Tap for details before cancellation closes.",
        actionUrl: scheduleUrl(variables),
      },
    },
    class_reminder_2h: {
      he: {
        category: "lesson_reminder",
        title: `עוד מעט מתחילות — ${className}`,
        body: `${classTime} · הכול מוכן לקראתך. לחצי לפרטי השיעור.`,
        actionUrl: scheduleUrl(variables),
      },
      ar: {
        category: "lesson_reminder",
        title: `سنبدأ قريباً — ${className}`,
        body: `${classTime} · كل شيء جاهز لاستقبالك. اضغطي لتفاصيل الحصة.`,
        actionUrl: scheduleUrl(variables),
      },
      en: {
        category: "lesson_reminder",
        title: `Starting soon — ${className}`,
        body: `${classTime} · Everything is ready for you. Tap for class details.`,
        actionUrl: scheduleUrl(variables),
      },
    },
    payment_pending: {
      he: {
        category: "package",
        title: "החבילה שלך כמעט מוכנה",
        body: "נשאר רק להשלים את התשלום. לחצי להמשיך בדיוק מהמקום שעצרת.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "package",
        title: "باقتك أصبحت شبه جاهزة",
        body: "تبقى فقط إكمال الدفع. اضغطي للمتابعة من حيث توقفتِ.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "package",
        title: "Your package is almost ready",
        body: "Only payment is left. Tap to continue exactly where you stopped.",
        actionUrl: "/member/packages",
      },
    },
    payment_confirmed: {
      he: {
        category: "payment_confirmed",
        title: "הכול מוכן — התשלום אושר ✨",
        body: "החבילה שלך פעילה והקבלה מחכה באזור האישי. לחצי לצפייה.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "payment_confirmed",
        title: "كل شيء جاهز — تم تأكيد الدفع ✨",
        body: "باقتك فعالة والإيصال موجود في حسابك. اضغطي لعرضه.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "payment_confirmed",
        title: "Everything’s ready — payment confirmed ✨",
        body: "Your package is active and the receipt is in your account. Tap to view it.",
        actionUrl: "/member/packages",
      },
    },
    payment_failed: {
      he: {
        category: "payment_failed",
        title: "צריך לעדכן את התשלום",
        body: "החבילה עדיין מחכה לך. לחצי לבדיקה מהירה או לניסיון נוסף.",
        actionUrl: "/member/packages",
      },
      ar: {
        category: "payment_failed",
        title: "يجب تحديث الدفع",
        body: "باقتك ما زالت بانتظارك. اضغطي للمراجعة السريعة أو للمحاولة مجدداً.",
        actionUrl: "/member/packages",
      },
      en: {
        category: "payment_failed",
        title: "Your payment needs an update",
        body: "Your package is still waiting. Tap for a quick review or to try again.",
        actionUrl: "/member/packages",
      },
    },
  };

  return copy[event][language];
}
