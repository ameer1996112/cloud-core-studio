import type { MessageEventType, MessageLanguage, TemplateVersion } from "@/lib/messaging.types";

export type MetaTemplateVariant = {
  eventType: MessageEventType;
  version: TemplateVersion;
  name: string;
  language: MessageLanguage;
  metaLanguage: "he" | "ar" | "en_US";
  category: "UTILITY" | "MARKETING";
  body: string;
  parameters: readonly string[];
  examples: readonly string[];
};

type MetaTemplateJsonComponent =
  | { type: "HEADER"; format: "IMAGE"; example: { header_handle: string[] } }
  | { type: "BODY"; text: string; example?: { body_text: readonly (readonly string[])[] } }
  | { type: "FOOTER"; text: string }
  | {
      type: "BUTTONS";
      buttons: Array<{ type: "URL"; text: string; url: string }>;
    };

type LocalizedTemplate = {
  name: string | null;
  category?: MetaTemplateVariant["category"];
  parameters: readonly string[];
  examples: readonly string[];
  bodies: Record<MessageLanguage, string>;
};

const DEFINITIONS: Partial<Record<MessageEventType, LocalizedTemplate>> = {
  member_welcome: {
    name: "cc_member_welcome_v2",
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, ברוכה הבאה ל-Cloud & Core 🤍 המקום שלך להתחזק, לנשום ולהתקדם בקצב שלך. לוח השיעורים כבר מחכה לך באפליקציה.",
      ar: "مرحباً {{1}}، أهلاً بك في Cloud & Core 🤍 مساحتك للقوة والتنفس والتقدم بوتيرتك. جدول الحصص بانتظارك في التطبيق.",
      en: "Hi {{1}}, welcome to Cloud & Core 🤍 Your space to grow stronger, breathe, and move at your pace. The class schedule is ready in the app.",
    },
  },
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
  booking_registered_admin: {
    name: null,
    parameters: [
      "member_name",
      "class_name",
      "class_date",
      "class_time",
      "instructor_name",
      "member_phone",
      "first_booking_label",
    ],
    examples: [
      "נועה",
      "פילאטיס מזרן",
      "24/07/2026",
      "18:00",
      "ירין",
      "+972501234567",
      "הרשמה ראשונה",
    ],
    bodies: {
      he: "{{1}} נרשמה לשיעור {{2}}.\n\nתאריך: {{3}}\nשעה: {{4}}\nמדריכה: {{5}}\nטלפון: {{6}}\nסטטוס: {{7}}",
      ar: "سجّلت {{1}} في حصة {{2}}.\n\nالتاريخ: {{3}}\nالوقت: {{4}}\nالمدربة: {{5}}\nالهاتف: {{6}}\nالحالة: {{7}}",
      en: "{{1}} registered for {{2}}.\n\nDate: {{3}}\nTime: {{4}}\nInstructor: {{5}}\nPhone: {{6}}\nStatus: {{7}}",
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
      he: "{{1}}, נשארו {{5}} מקומות ב{{2}} ב-{{3}} בשעה {{4}}. כל הפרטים והאפשרויות מחכים לך באפליקציה.",
      ar: "مرحباً {{1}}، بقيت {{5}} أماكن متاحة في {{2}} بتاريخ {{3}} الساعة {{4}}. التفاصيل والخيارات متاحة في التطبيق.",
      en: "Hi {{1}}, {{5}} spots are still open in {{2}} on {{3}} at {{4}}. View the details and available options in the app.",
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
    name: "cc_payment_confirmed_v3",
    parameters: ["member_name", "package_name", "amount"],
    examples: ["נועה", "מינוי חודשי", "₪350"],
    bodies: {
      he: "היי {{1}}, הכול מוכן ✨\n\nהתשלום הושלם ו-{{2}} פעילה עכשיו.\n{{3}}\n\nאפשר לבחור את השיעור הבא כשנוח לך.\n\nנתראה בסטודיו,\nירין",
      ar: "مرحباً {{1}}، كل شيء جاهز ✨\n\nاكتملت الدفعة وأصبحت {{2}} فعّالة الآن.\n{{3}}\n\nيمكنك اختيار حصتك القادمة عندما يناسبك.\n\nنراك في الاستوديو.",
      en: "Hi {{1}}, you're all set ✨\n\nPayment is complete and {{2}} is now active.\n{{3}}\n\nChoose your next class whenever you're ready.\n\nSee you at the studio.",
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
  booking_changed: {
    name: null,
    parameters: ["member_name", "class_name", "class_date", "class_time"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "19:00"],
    bodies: {
      he: "היי {{1}}, פרטי ההזמנה שלך עודכנו: {{2}}, ב-{{3}} בשעה {{4}}. כל הפרטים מחכים לך באפליקציה.",
      ar: "مرحباً {{1}}، تم تحديث تفاصيل حجزك: {{2}} بتاريخ {{3}} الساعة {{4}}. تجدين كل التفاصيل في التطبيق.",
      en: "Hi {{1}}, your booking was updated: {{2}} on {{3}} at {{4}}. All details are in the app.",
    },
  },
  booking_checked_in: {
    name: null,
    parameters: ["member_name", "class_name"],
    examples: ["נועה", "פילאטיס מזרן"],
    bodies: {
      he: "היי {{1}}, סימנו שהגעת ל{{2}}. אימון נעים 🤍",
      ar: "مرحباً {{1}}، تم تسجيل حضورك في {{2}}. نتمنى لك تمريناً ممتعاً 🤍",
      en: "Hi {{1}}, you are checked in for {{2}}. Have a beautiful practice 🤍",
    },
  },
  booking_no_show_followup: {
    name: null,
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, היה חסר לנו לראות אותך. אם משהו הפריע להגיע, אנחנו כאן לעזור לך למצוא את השיעור הבא שמתאים.",
      ar: "مرحباً {{1}}، افتقدناك في الحصة. إذا منعك شيء من الحضور، نحن هنا لمساعدتك في اختيار موعد أنسب.",
      en: "Hi {{1}}, we missed you in class. If something got in the way, we can help you find a better next session.",
    },
  },
  class_location_changed: {
    name: "cc_class_location_changed_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time", "location_name"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "19:00", "סטודיו ראשי"],
    bodies: {
      he: "היי {{1}}, המיקום של {{2}} ב-{{3}} בשעה {{4}} השתנה ל{{5}}. כדאי לבדוק את הפרטים לפני היציאה.",
      ar: "مرحباً {{1}}، تغير مكان {{2}} بتاريخ {{3}} الساعة {{4}} إلى {{5}}. راجعي التفاصيل قبل الانطلاق.",
      en: "Hi {{1}}, the location for {{2}} on {{3}} at {{4}} changed to {{5}}. Please review it before leaving.",
    },
  },
  class_instructor_changed: {
    name: null,
    parameters: ["member_name", "class_name", "instructor_name"],
    examples: ["נועה", "פילאטיס מזרן", "ירין"],
    bodies: {
      he: "היי {{1}}, עדכון קטן: את {{2}} תעביר הפעם {{3}}. שאר פרטי השיעור נשארו ללא שינוי.",
      ar: "مرحباً {{1}}، تحديث صغير: ستقدم {{3}} حصة {{2}} هذه المرة. باقي التفاصيل لم تتغير.",
      en: "Hi {{1}}, a small update: {{3}} will lead {{2}} this time. Everything else stays the same.",
    },
  },
  class_published: {
    name: null,
    parameters: ["member_name", "class_name", "class_date", "class_time"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "19:00"],
    bodies: {
      he: "היי {{1}}, נוסף שיעור חדש למערכת: {{2}}, ב-{{3}} בשעה {{4}}. אפשר לצפות ולהירשם באפליקציה.",
      ar: "مرحباً {{1}}، أضيفت حصة جديدة إلى الجدول: {{2}} بتاريخ {{3}} الساعة {{4}}. يمكنك الحجز من التطبيق.",
      en: "Hi {{1}}, a new class is on the schedule: {{2}} on {{3}} at {{4}}. View and book it in the app.",
    },
  },
  class_recommendation: {
    name: "cc_class_recommendation_v2",
    category: "MARKETING",
    parameters: ["member_name", "recommendation_summary"],
    examples: [
      "נועה",
      "פילאטיס מזרן ביום 20/07/2026 בשעה 19:00 או יוגה ביום 22/07/2026 בשעה 18:00",
    ],
    bodies: {
      he: "היי {{1}}, חשבנו שהאפשרויות האלה עשויות להתאים לשבוע שלך: {{2}}. הפרטים מחכים באפליקציה.",
      ar: "مرحباً {{1}}، نعتقد أن هذه الخيارات قد تناسب أسبوعك: {{2}}. التفاصيل في التطبيق.",
      en: "Hi {{1}}, we thought these options may fit your week: {{2}}. The details are waiting in the app.",
    },
  },
  waitlist_position_changed: {
    name: null,
    parameters: ["member_name", "class_name", "waitlist_position"],
    examples: ["נועה", "פילאטיס מזרן", "2"],
    bodies: {
      he: "היי {{1}}, התקדמת למקום {{3}} ברשימת ההמתנה של {{2}}. נעדכן אותך מיד אם יתפנה מקום.",
      ar: "مرحباً {{1}}، أصبحت في المرتبة {{3}} على قائمة انتظار {{2}}. سنبلغك فور توفر مكان.",
      en: "Hi {{1}}, you moved to position {{3}} on the waitlist for {{2}}. We will alert you if a spot opens.",
    },
  },
  waitlist_accepted: {
    name: "cc_waitlist_accepted_v2",
    parameters: ["member_name", "class_name", "class_date", "class_time"],
    examples: ["נועה", "פילאטיס מזרן", "20/07/2026", "19:00"],
    bodies: {
      he: "היי {{1}}, המקום שלך ב{{2}} אושר ל-{{3}} בשעה {{4}}. נתראה בסטודיו 🤍",
      ar: "مرحباً {{1}}، تم تأكيد مكانك في {{2}} بتاريخ {{3}} الساعة {{4}}. نراك في الاستوديو 🤍",
      en: "Hi {{1}}, your place in {{2}} is confirmed for {{3}} at {{4}}. See you at the studio 🤍",
    },
  },
  waitlist_offer_expired: {
    name: null,
    parameters: ["member_name", "class_name"],
    examples: ["נועה", "פילאטיס מזרן"],
    bodies: {
      he: "היי {{1}}, זמן השמירה למקום שהתפנה ב{{2}} הסתיים. אפשר לבדוק שיעורים אחרים במערכת.",
      ar: "مرحباً {{1}}، انتهت مهلة حجز المكان المتاح في {{2}}. يمكنك الاطلاع على حصص أخرى في الجدول.",
      en: "Hi {{1}}, the hold for the open spot in {{2}} has expired. You can explore other classes in the schedule.",
    },
  },
  waitlist_removed: {
    name: null,
    parameters: ["member_name", "class_name"],
    examples: ["נועה", "פילאטיס מזרן"],
    bodies: {
      he: "היי {{1}}, הוסרת מרשימת ההמתנה של {{2}}. אפשר לבחור שיעור אחר באפליקציה.",
      ar: "مرحباً {{1}}، تمت إزالتك من قائمة انتظار {{2}}. يمكنك اختيار حصة أخرى من التطبيق.",
      en: "Hi {{1}}, you were removed from the waitlist for {{2}}. You can choose another class in the app.",
    },
  },
  payment_refunded: {
    name: null,
    parameters: ["member_name", "package_name", "amount"],
    examples: ["נועה", "מינוי חודשי", "₪350"],
    bodies: {
      he: "היי {{1}}, הזיכוי עבור {{2}} בסך {{3}} אושר. זמן ההופעה בחשבון תלוי באמצעי התשלום.",
      ar: "مرحباً {{1}}، تمت الموافقة على استرداد {{3}} مقابل {{2}}. وقت ظهوره يعتمد على وسيلة الدفع.",
      en: "Hi {{1}}, your {{3}} refund for {{2}} was approved. Posting time depends on your payment method.",
    },
  },
  membership_activated: {
    name: null,
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "היי {{1}}, {{2}} פעיל עכשיו ✨ אפשר לבחור את השיעור הבא שלך באפליקציה.",
      ar: "مرحباً {{1}}، أصبح {{2}} فعالاً الآن ✨ يمكنك اختيار حصتك القادمة من التطبيق.",
      en: "Hi {{1}}, {{2}} is active now ✨ You can choose your next class in the app.",
    },
  },
  credits_low: {
    name: null,
    parameters: ["member_name", "credits_remaining"],
    examples: ["נועה", "2"],
    bodies: {
      he: "היי {{1}}, נשארו לך {{2}} קרדיטים. אפשר להמשיך להתאמן ולבחור חבילה בזמן שנוח לך.",
      ar: "مرحباً {{1}}، بقي لديك {{2}} رصيد. يمكنك مواصلة التمرين واختيار باقة في الوقت المناسب.",
      en: "Hi {{1}}, you have {{2}} credits left. Keep practicing and choose a package whenever it suits you.",
    },
  },
  credits_depleted: {
    name: null,
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, הקרדיטים בחשבון הסתיימו. כדי להזמין שיעור נוסף אפשר לבחור חבילה באפליקציה.",
      ar: "مرحباً {{1}}، انتهى رصيدك الحالي. لحجز حصة أخرى يمكنك اختيار باقة من التطبيق.",
      en: "Hi {{1}}, your current credits are used. Choose a package in the app when you are ready to book again.",
    },
  },
  membership_expiring: {
    name: null,
    parameters: ["member_name", "package_name", "expiry_date"],
    examples: ["נועה", "מינוי חודשי", "31/07/2026"],
    bodies: {
      he: "היי {{1}}, {{2}} יסתיים ב-{{3}}. אפשר לעבור על האפשרויות בחשבון שלך.",
      ar: "مرحباً {{1}}، سينتهي {{2}} بتاريخ {{3}}. يمكنك مراجعة الخيارات في حسابك.",
      en: "Hi {{1}}, {{2}} ends on {{3}}. You can review your options in your account.",
    },
  },
  membership_expired: {
    name: null,
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "היי {{1}}, {{2}} הסתיים. כשתרצי לחזור להתאמן, אפשר לבחור את האפשרות שמתאימה לך באפליקציה.",
      ar: "مرحباً {{1}}، انتهى {{2}}. عندما ترغبين بالعودة، يمكنك اختيار الخيار المناسب من التطبيق.",
      en: "Hi {{1}}, {{2}} has ended. When you are ready to return, choose the option that fits you in the app.",
    },
  },
  subscription_renewal_upcoming: {
    name: null,
    parameters: ["member_name", "package_name", "renewal_date"],
    examples: ["נועה", "מינוי חודשי", "31/07/2026"],
    bodies: {
      he: "היי {{1}}, החידוש הבא של {{2}} מתוכנן ל-{{3}}. אפשר לבדוק את הפרטים בחשבון.",
      ar: "مرحباً {{1}}، التجديد القادم لـ {{2}} مقرر بتاريخ {{3}}. يمكنك مراجعة التفاصيل في حسابك.",
      en: "Hi {{1}}, the next renewal for {{2}} is scheduled for {{3}}. Review the details in your account.",
    },
  },
  subscription_renewal_succeeded: {
    name: "cc_subscription_renewal_succeeded_v2",
    parameters: ["member_name", "package_name", "amount"],
    examples: ["נועה", "מינוי חודשי", "₪350"],
    bodies: {
      he: "היי {{1}}, {{2}} חודש בהצלחה בסך {{3}}. המנוי שלך ממשיך כרגיל ✨",
      ar: "مرحباً {{1}}، تم تجديد {{2}} بنجاح بقيمة {{3}}. اشتراكك مستمر كالمعتاد ✨",
      en: "Hi {{1}}, {{2}} renewed successfully for {{3}}. Your membership continues as usual ✨",
    },
  },
  subscription_renewal_failed: {
    name: "cc_subscription_renewal_failed_v2",
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "היי {{1}}, לא הצלחנו לחדש את {{2}}. כדאי לבדוק את אמצעי התשלום באפליקציה, ואם צריך אנחנו כאן לעזור.",
      ar: "مرحباً {{1}}، تعذر تجديد {{2}}. راجعي وسيلة الدفع في التطبيق، ونحن هنا للمساعدة.",
      en: "Hi {{1}}, we could not renew {{2}}. Review your payment method in the app, or contact us for help.",
    },
  },
  subscription_paused: {
    name: null,
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "היי {{1}}, {{2}} הושהה. פרטי ההשהיה וההמשך זמינים בחשבון שלך.",
      ar: "مرحباً {{1}}، تم إيقاف {{2}} مؤقتاً. تفاصيل الإيقاف والاستئناف متاحة في حسابك.",
      en: "Hi {{1}}, {{2}} is paused. Pause and restart details are available in your account.",
    },
  },
  subscription_cancelled: {
    name: null,
    parameters: ["member_name", "package_name"],
    examples: ["נועה", "מינוי חודשי"],
    bodies: {
      he: "היי {{1}}, הביטול של {{2}} נקלט. אפשר לראות בחשבון עד מתי הגישה נשארת פעילה.",
      ar: "مرحباً {{1}}، تم تسجيل إلغاء {{2}}. يمكنك رؤية مدة بقاء الاشتراك فعالاً في حسابك.",
      en: "Hi {{1}}, cancellation of {{2}} is confirmed. Your account shows how long access remains active.",
    },
  },
  staff_reply: {
    name: null,
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, מחכה לך תשובה חדשה מצוות Cloud & Core. אפשר לפתוח את האפליקציה כדי להמשיך את השיחה.",
      ar: "مرحباً {{1}}، لديك رد جديد من فريق Cloud & Core. افتحي التطبيق لمتابعة المحادثة.",
      en: "Hi {{1}}, a new reply from the Cloud & Core team is waiting. Open the app to continue the conversation.",
    },
  },
  human_handoff_resolved: {
    name: null,
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, השיחה עם הסטודיו סומנה כטופלה. אם תצטרכי משהו נוסף, אנחנו תמיד כאן.",
      ar: "مرحباً {{1}}، تم اعتبار محادثتك مع الاستوديو مكتملة. نحن هنا دائماً إذا احتجت شيئاً آخر.",
      en: "Hi {{1}}, your studio conversation was marked resolved. We are always here if you need anything else.",
    },
  },
  urgent_studio_announcement: {
    name: "cc_urgent_studio_announcement_v2",
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, מחכה לך עדכון חשוב מהסטודיו. כדאי לפתוח את האפליקציה ולעבור על הפרטים.",
      ar: "مرحباً {{1}}، لديك تحديث مهم من الاستوديو. افتحي التطبيق للاطلاع على التفاصيل.",
      en: "Hi {{1}}, an important studio update is waiting. Open the app to review the details.",
    },
  },
  trial_followup: {
    name: null,
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, היה כיף לפגוש אותך ב-Cloud & Core. כשתרצי, נשמח לעזור לך לבחור את השיעור הבא.",
      ar: "مرحباً {{1}}، سعدنا بلقائك في Cloud & Core. عندما تكونين جاهزة، سنساعدك في اختيار حصتك القادمة.",
      en: "Hi {{1}}, it was lovely meeting you at Cloud & Core. When you are ready, we can help choose your next class.",
    },
  },
  weekly_schedule: {
    name: "cc_weekly_schedule_branded_v5",
    category: "MARKETING",
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, לוח השיעורים לשבוע הבא נפתח 🤍\n\nהשיעורים החדשים מחכים לך באפליקציה.\nבחרי את השיעורים שמתאימים לך ושמרי מקום מראש.\n\nנתראה בסטודיו,\nירין",
      ar: "مرحباً {{1}}، جدول الحصص للأسبوع القادم مفتوح 🤍\n\nالحصص الجديدة بانتظارك في التطبيق.\nاختاري الحصص التي تناسبك واحجزي مكانك مسبقاً.\n\nنراك في الاستوديو،\nيارين",
      en: "Hi {{1}}, next week's class schedule is open 🤍\n\nThe new classes are waiting for you in the app.\nChoose the classes that fit you and save your spot in advance.\n\nSee you at the studio,\nYarin",
    },
  },
  daily_briefing: {
    name: null,
    parameters: ["member_name", "item_count"],
    examples: ["נועה", "2"],
    bodies: {
      he: "היי {{1}}, מחכים לך היום {{2}} פריטים רלוונטיים במקום אחד. אפשר לעבור עליהם בנחת באפליקציה.",
      ar: "مرحباً {{1}}، لديك اليوم {{2}} عناصر مهمة مجمعة في مكان واحد. راجعيها بهدوء في التطبيق.",
      en: "Hi {{1}}, you have {{2}} relevant items together in one place today. Review them calmly in the app.",
    },
  },
  retention_reminder: {
    name: "cc_retention_reminder_v2",
    category: "MARKETING",
    parameters: ["member_name"],
    examples: ["נועה"],
    bodies: {
      he: "היי {{1}}, הרבה זמן לא התראינו 🤍 המערכת פתוחה כשתרצי לחזור לזמן שהוא רק שלך.",
      ar: "مرحباً {{1}}، اشتقنا لرؤيتك 🤍 الجدول مفتوح عندما ترغبين بالعودة إلى وقتك الخاص.",
      en: "Hi {{1}}, we have missed seeing you 🤍 The schedule is open whenever you are ready for time that is yours.",
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
).flatMap(([eventType, definition]) => {
  const name = definition?.name;
  if (!name || !definition) return [];
  return (["he", "ar", "en"] as const).map((language) => ({
    eventType: eventType as MetaTemplateVariant["eventType"],
    version: "v2" as const,
    name,
    language,
    metaLanguage: META_LANGUAGES[language],
    category: definition.category ?? "UTILITY",
    body: definition.bodies[language],
    parameters: definition.parameters,
    examples: definition.examples,
  }));
});

const SUBJECTS: Record<MessageLanguage, Partial<Record<MessageEventType, string>>> = {
  he: {
    member_welcome: "ברוכה הבאה ל-Cloud & Core",
    booking_confirmed: "ההזמנה אושרה",
    booking_registered_admin: "הרשמה חדשה לשיעור",
    booking_cancelled: "ההזמנה בוטלה",
    booking_changed: "פרטי ההזמנה עודכנו",
    booking_checked_in: "הגעת לשיעור",
    booking_no_show_followup: "התגעגענו אלייך",
    class_cancelled_by_admin: "השיעור בוטל",
    class_time_changed: "שעת השיעור השתנתה",
    class_location_changed: "מיקום השיעור השתנה",
    class_instructor_changed: "עדכון מדריכה",
    class_reminder_planning: "תזכורת לקראת השיעור",
    class_reminder_final: "השיעור מתחיל בקרוב",
    class_open_spots: "נשארו מקומות בשיעור",
    class_published: "שיעור חדש במערכת",
    class_recommendation: "שיעור שעשוי להתאים לך",
    waitlist_joined: "הצטרפת לרשימת ההמתנה",
    waitlist_spot_available: "התפנה לך מקום",
    waitlist_position_changed: "התקדמת ברשימת ההמתנה",
    waitlist_accepted: "המקום שלך אושר",
    waitlist_offer_expired: "זמן שמירת המקום הסתיים",
    waitlist_removed: "עדכון רשימת המתנה",
    payment_request_received: "בקשת התשלום התקבלה",
    payment_pending_reminder: "התשלום ממתין להשלמה",
    payment_confirmed: "התשלום אושר",
    payment_failed: "התשלום לא הושלם",
    payment_refunded: "הזיכוי אושר",
    receipt_issued: "הקבלה שלך מוכנה",
    human_handoff: "הודעה מהסטודיו",
    membership_activated: "המנוי פעיל",
    credits_low: "נשארו מעט קרדיטים",
    credits_depleted: "הקרדיטים הסתיימו",
    membership_expiring: "המנוי מסתיים בקרוב",
    membership_expired: "המנוי הסתיים",
    subscription_renewal_upcoming: "חידוש המנוי מתקרב",
    subscription_renewal_succeeded: "המנוי חודש",
    subscription_renewal_failed: "לא הצלחנו לחדש את המנוי",
    subscription_paused: "המנוי הושהה",
    subscription_cancelled: "המנוי בוטל",
    staff_reply: "תשובה חדשה מהסטודיו",
    human_handoff_resolved: "השיחה טופלה",
    urgent_studio_announcement: "עדכון חשוב מהסטודיו",
    trial_followup: "שמחנו לפגוש אותך",
    weekly_schedule: "המערכת השבועית מוכנה",
    daily_briefing: "העדכון האישי שלך להיום",
    retention_reminder: "התגעגענו אלייך",
  },
  ar: {
    member_welcome: "أهلاً بك في Cloud & Core",
    booking_confirmed: "تم تأكيد الحجز",
    booking_registered_admin: "تسجيل جديد في حصة",
    booking_cancelled: "تم إلغاء الحجز",
    booking_changed: "تم تحديث تفاصيل الحجز",
    booking_checked_in: "تم تسجيل حضورك",
    booking_no_show_followup: "افتقدناك",
    class_cancelled_by_admin: "تم إلغاء الحصة",
    class_time_changed: "تم تغيير موعد الحصة",
    class_location_changed: "تم تغيير مكان الحصة",
    class_instructor_changed: "تحديث المدربة",
    class_reminder_planning: "تذكير بالحصة",
    class_reminder_final: "الحصة ستبدأ قريباً",
    class_open_spots: "أماكن متاحة في الحصة",
    class_published: "حصة جديدة في الجدول",
    class_recommendation: "حصة قد تناسبك",
    waitlist_joined: "انضممت إلى قائمة الانتظار",
    waitlist_spot_available: "أصبح مكان متاحاً",
    waitlist_position_changed: "تقدمت في قائمة الانتظار",
    waitlist_accepted: "تم تأكيد مكانك",
    waitlist_offer_expired: "انتهت مهلة حجز المكان",
    waitlist_removed: "تحديث قائمة الانتظار",
    payment_request_received: "تم استلام طلب الدفع",
    payment_pending_reminder: "الدفع بانتظار الإكمال",
    payment_confirmed: "تم تأكيد الدفع",
    payment_failed: "تعذر إكمال الدفع",
    payment_refunded: "تمت الموافقة على الاسترداد",
    receipt_issued: "إيصالك جاهز",
    human_handoff: "رسالة من الاستوديو",
    membership_activated: "اشتراكك فعال",
    credits_low: "رصيدك منخفض",
    credits_depleted: "انتهى رصيدك",
    membership_expiring: "اشتراكك ينتهي قريباً",
    membership_expired: "انتهى اشتراكك",
    subscription_renewal_upcoming: "موعد التجديد يقترب",
    subscription_renewal_succeeded: "تم تجديد الاشتراك",
    subscription_renewal_failed: "تعذر تجديد الاشتراك",
    subscription_paused: "تم إيقاف الاشتراك مؤقتاً",
    subscription_cancelled: "تم إلغاء الاشتراك",
    staff_reply: "رد جديد من الاستوديو",
    human_handoff_resolved: "اكتملت المحادثة",
    urgent_studio_announcement: "تحديث مهم من الاستوديو",
    trial_followup: "سعدنا بلقائك",
    weekly_schedule: "الجدول الأسبوعي جاهز",
    daily_briefing: "تحديثك الشخصي لليوم",
    retention_reminder: "اشتقنا لرؤيتك",
  },
  en: {
    member_welcome: "Welcome to Cloud & Core",
    booking_confirmed: "Booking confirmed",
    booking_registered_admin: "New class registration",
    booking_cancelled: "Booking cancelled",
    booking_changed: "Booking details updated",
    booking_checked_in: "You are checked in",
    booking_no_show_followup: "We missed you",
    class_cancelled_by_admin: "Class cancelled",
    class_time_changed: "Class time changed",
    class_location_changed: "Class location changed",
    class_instructor_changed: "Instructor update",
    class_reminder_planning: "Class reminder",
    class_reminder_final: "Class starts soon",
    class_open_spots: "Open spots in class",
    class_published: "New class on the schedule",
    class_recommendation: "A class you may enjoy",
    waitlist_joined: "Waitlist joined",
    waitlist_spot_available: "A spot is available",
    waitlist_position_changed: "Waitlist position updated",
    waitlist_accepted: "Your spot is confirmed",
    waitlist_offer_expired: "Spot hold expired",
    waitlist_removed: "Waitlist update",
    payment_request_received: "Payment request received",
    payment_pending_reminder: "Payment awaiting completion",
    payment_confirmed: "Payment confirmed",
    payment_failed: "Payment could not be completed",
    payment_refunded: "Refund approved",
    receipt_issued: "Your receipt is ready",
    human_handoff: "A message from the studio",
    membership_activated: "Membership active",
    credits_low: "Credits running low",
    credits_depleted: "Credits used",
    membership_expiring: "Membership ending soon",
    membership_expired: "Membership ended",
    subscription_renewal_upcoming: "Renewal coming up",
    subscription_renewal_succeeded: "Membership renewed",
    subscription_renewal_failed: "Membership renewal failed",
    subscription_paused: "Membership paused",
    subscription_cancelled: "Membership cancelled",
    staff_reply: "New studio reply",
    human_handoff_resolved: "Conversation resolved",
    urgent_studio_announcement: "Important studio update",
    trial_followup: "Lovely meeting you",
    weekly_schedule: "Your weekly schedule is ready",
    daily_briefing: "Your personal update for today",
    retention_reminder: "We have missed you",
  },
};

export const MESSAGE_CONTENT_CATALOG = DEFINITIONS;

export function renderMessageContent(
  eventType: MessageEventType,
  language: MessageLanguage,
  variables: Record<string, unknown>,
) {
  const definition = DEFINITIONS[eventType];
  if (!definition) throw new Error(`missing_message_content:${eventType}`);
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
    if (!definition) continue;
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
    if (variant.category !== "UTILITY" && variant.category !== "MARKETING") {
      errors.push(`invalid_category:${key}`);
    }
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
  const components: MetaTemplateJsonComponent[] = [];
  if (variant.eventType === "weekly_schedule") {
    components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [""] } });
  }
  components.push({
    type: "BODY",
    text: variant.body,
    ...(variant.parameters.length ? { example: { body_text: [variant.examples] } } : {}),
  });
  if (variant.eventType === "weekly_schedule") {
    components.push(
      { type: "FOOTER", text: "Cloud & Core Studio" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text:
              variant.metaLanguage === "he"
                ? "צפייה בלוח השיעורים"
                : variant.metaLanguage === "ar"
                  ? "عرض جدول الحصص"
                  : "View class schedule",
            url: "https://cloudandcorestudio.com/member/schedule",
          },
        ],
      },
    );
  }
  return {
    name: variant.name,
    language: variant.metaLanguage,
    category: variant.category,
    components,
  };
}
