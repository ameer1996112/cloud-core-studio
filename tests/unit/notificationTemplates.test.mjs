import { strict as assert } from "node:assert";
import {
  buildNotificationIdempotencyKey,
  findNotificationTemplate,
  notificationStaffVisibility,
  renderNotificationCopy,
  resolveNotificationLanguage,
} from "../../src/lib/notificationTemplates.ts";

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: "ar",
    appLanguage: "en",
    studioDefaultLanguage: "he",
  }),
  "ar",
);

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: null,
    appLanguage: "en",
    studioDefaultLanguage: "he",
  }),
  "en",
);

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: "fr",
    appLanguage: null,
    studioDefaultLanguage: "en",
  }),
  "en",
);

assert.equal(
  resolveNotificationLanguage({
    memberPreferredLanguage: undefined,
    appLanguage: "fr",
    studioDefaultLanguage: undefined,
  }),
  "he",
);

const template = findNotificationTemplate({
  eventKey: "booking_confirmed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

const rendered = renderNotificationCopy(template, {
  member_name: "נועה",
  class_name: "Core Flow",
  class_date: "29/06/2026",
  class_time: "18:00",
  instructor_name: "Maya",
  studio_name: "Cloud & Core",
});

assert.ok(rendered.body.includes("איזה כיף שהמקום שלך נשמר"));
assert.ok(rendered.body.includes("Core Flow"));
assert.equal(rendered.subject, null);

const premiumHebrewVariables = {
  member_name: "נועה",
  class_name: "Core Flow",
  class_date: "29/06/2026",
  class_time: "18:00",
  instructor_name: "Maya",
  studio_name: "Cloud & Core",
  package_name: "מינוי חודשי",
  credits_remaining: 2,
  expires_on: "20/07/2026",
  receipt_number: "R-1001",
};

const adminPackageTemplate = findNotificationTemplate({
  eventKey: "payment_request_received",
  channel: "email",
  language: "en",
  audience: "admin",
});

const adminRendered = renderNotificationCopy(adminPackageTemplate, {
  member_name: "Noa",
  package_name: "10 Class Pack",
});

assert.ok(adminRendered.subject?.includes("awaiting review"));
assert.ok(adminRendered.body.includes("A new payment request was received"));

assert.equal(notificationStaffVisibility("payment_confirmed"), "admin_only");
assert.equal(notificationStaffVisibility("receipt_issued"), "admin_only");
assert.equal(notificationStaffVisibility("payment_request_received", "member"), "operational");
assert.equal(notificationStaffVisibility("payment_request_received", "admin"), "admin_only");
assert.equal(notificationStaffVisibility("booking_confirmed"), "operational");

assert.equal(
  buildNotificationIdempotencyKey({
    eventKey: "payment_request_received",
    channel: "email",
    audience: "admin",
    relatedIds: { packageRequestId: "pkg-1" },
  }),
  "payment_request:pkg-1:payment_request_received:email:admin",
);

assert.equal(
  buildNotificationIdempotencyKey({
    eventKey: "booking_confirmed",
    channel: "whatsapp",
    audience: "member",
    relatedIds: { bookingId: "book-1" },
  }),
  "booking:book-1:booking_confirmed:whatsapp",
);

assert.equal(
  buildNotificationIdempotencyKey({
    eventKey: "registered_no_action",
    channel: "whatsapp",
    audience: "member",
    relatedIds: { memberId: "member-1" },
  }),
  "member:member-1:registered_no_action:whatsapp",
);

assert.equal(
  buildNotificationIdempotencyKey({
    eventKey: "package_expiring_soon",
    channel: "whatsapp",
    audience: "member",
    relatedIds: { memberPlanId: "member-plan-1" },
  }),
  "member_plan:member-plan-1:package_expiring_soon:whatsapp",
);

const premiumBookingTemplate = findNotificationTemplate({
  eventKey: "booking_confirmed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumBookingTemplate, premiumHebrewVariables).body,
  "נועה, איזה כיף שהמקום שלך נשמר 🤍\n\nCore Flow\n29/06/2026 · 18:00\nעם Maya\n\nמחכה לראות אותך בסטודיו\nירין",
);

const premiumPaymentTemplate = findNotificationTemplate({
  eventKey: "payment_confirmed",
  channel: "email",
  language: "en",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumPaymentTemplate, premiumHebrewVariables).subject,
  "You're all set · מינוי חודשי",
);
assert.equal(
  renderNotificationCopy(premiumPaymentTemplate, premiumHebrewVariables).body,
  "Hi נועה, you're all set ✨\n\nPayment is complete and מינוי חודשי is now active.\nChoose your next class whenever you're ready.\n\nSee you at the studio.",
);

const premiumReminderTemplate = findNotificationTemplate({
  eventKey: "class_reminder_24h",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumReminderTemplate, premiumHebrewVariables).body,
  "נועה, תזכורת קטנה למחר 🤍\n\nCore Flow\n29/06/2026 · 18:00\nעם Maya\n\nמחכה לראות אותך בסטודיו\nירין",
);

const premiumWaitlistTemplate = findNotificationTemplate({
  eventKey: "waitlist_spot_available",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumWaitlistTemplate, premiumHebrewVariables).body,
  "נועה, התפנה לך מקום 🤍\n\nCore Flow\n29/06/2026 · 18:00\n\nאם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו.\nירין",
);

const premiumCancelledTemplate = findNotificationTemplate({
  eventKey: "class_cancelled_by_admin",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumCancelledTemplate, premiumHebrewVariables).body,
  "נועה, עדכון מהסטודיו\n\nCore Flow\n29/06/2026 · 18:00\n\nהשיעור לא יתקיים הפעם.\nאם תרצי, אעזור לך למצוא שיעור חלופי.\nירין",
);

const premiumTimeChangedTemplate = findNotificationTemplate({
  eventKey: "class_time_changed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumTimeChangedTemplate, premiumHebrewVariables).body,
  "נועה, עדכון קטן לשעת השיעור\n\nCore Flow\n29/06/2026 · 18:00\n\nאם השעה החדשה לא מסתדרת לך, כתבי לי.\nירין",
);

const englishEmailTemplate = findNotificationTemplate({
  eventKey: "booking_confirmed",
  channel: "email",
  language: "en",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(englishEmailTemplate, premiumHebrewVariables).body,
  "Hi נועה, your spot is saved for Core Flow on 29/06/2026 at 18:00. See you at Cloud & Core.",
);

const registeredNoActionTemplate = findNotificationTemplate({
  eventKey: "registered_no_action",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(registeredNoActionTemplate, premiumHebrewVariables).body,
  "נועה, ברוכה הבאה ל-Cloud & Core 🤍\n\nראיתי שפתחת חשבון ועדיין לא בחרת שיעור.\nאם תרצי, אעזור לך למצוא התחלה שמתאימה לקצב שלך.\n\nירין",
);

const firstLessonFollowupTemplate = findNotificationTemplate({
  eventKey: "first_lesson_followup",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(firstLessonFollowupTemplate, premiumHebrewVariables).body,
  "נועה, שמחתי לראות אותך היום בסטודיו 🤍\n\nמקווה שהשיעור הרגיש נעים וטוב בגוף.\nכשתרצי להמשיך, אעזור לך לבחור את השיעור הבא.\n\nירין",
);

const packageApprovedNoBookingTemplate = findNotificationTemplate({
  eventKey: "package_approved_no_booking",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(packageApprovedNoBookingTemplate, premiumHebrewVariables).body,
  "נועה, החבילה שלך כבר מחכה לך ✨\n\nמינוי חודשי\n\nנשאר רק לבחור שיעור ראשון. אם תרצי עזרה להתחיל, אני כאן.\nירין",
);

const lowCreditsTemplate = findNotificationTemplate({
  eventKey: "low_credits",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(lowCreditsTemplate, premiumHebrewVariables).body,
  "נועה, נשארו לך 2 כניסות בחבילה\n\nאם תרצי לשמור על רצף, אפשר לבחור את החבילה הבאה בזמן שנוח לך.\nאני כאן אם תרצי עזרה.\nירין",
);

const packageExpiringTemplate = findNotificationTemplate({
  eventKey: "package_expiring_soon",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(packageExpiringTemplate, premiumHebrewVariables).body,
  "נועה, החבילה שלך מסתיימת בקרוב\n\nמינוי חודשי\nבתוקף עד 20/07/2026\n\nאם תרצי להמשיך ברצף, אני כאן לעזור.\nירין",
);

const noUpcomingBookingTemplate = findNotificationTemplate({
  eventKey: "no_upcoming_booking_14d",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(noUpcomingBookingTemplate, premiumHebrewVariables).body,
  "נועה, התגעגענו אלייך בסטודיו 🤍\n\nאם מתאים לך לחזור השבוע, אעזור לך למצוא שיעור שמתאים לקצב שלך.\nירין",
);

const paymentPendingReminderTemplate = findNotificationTemplate({
  eventKey: "payment_pending_reminder",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(paymentPendingReminderTemplate, premiumHebrewVariables).body,
  "נועה, התשלום עדיין מחכה להשלמה. אפשר לחזור לאפליקציה ולהמשיך כשנוח לך. אם משהו לא ברור, אני כאן לעזור.\nירין",
);

const paymentFailedTemplate = findNotificationTemplate({
  eventKey: "payment_failed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(paymentFailedTemplate, premiumHebrewVariables).body,
  "נועה, לא הצלחנו להשלים את התשלום. אפשר לנסות שוב באפליקציה או לכתוב לי ואעזור.\nירין",
);

const waitlistJoinedTemplate = findNotificationTemplate({
  eventKey: "waitlist_joined",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(waitlistJoinedTemplate, premiumHebrewVariables).body,
  "נועה, נכנסת לרשימת ההמתנה\n\nCore Flow\n\nאם יתפנה מקום, אעדכן אותך מיד.\nירין",
);

const reminder2hTemplate = findNotificationTemplate({
  eventKey: "class_reminder_2h",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(reminder2hTemplate, premiumHebrewVariables).body,
  "נועה, תזכורת קטנה להיום\n\nCore Flow מתחיל ב-18:00.\nנתראה ממש בקרוב.\nירין",
);

const noShowTemplate = findNotificationTemplate({
  eventKey: "no_show_followup",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(noShowTemplate, premiumHebrewVariables).body,
  "נועה, התגעגענו אלייך בשיעור 🤍\n\nCore Flow\n\nמקווה שהכול בסדר. כשתרצי לחזור, אני כאן לעזור לבחור שיעור מתאים.\nירין",
);

const bookingCancelledByMemberTemplate = findNotificationTemplate({
  eventKey: "booking_cancelled_by_member",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(bookingCancelledByMemberTemplate, premiumHebrewVariables).body,
  "נועה, הביטול נקלט\n\nCore Flow\n\nאם מגיע לך זיכוי, הוא עודכן בחשבון שלך.\nירין",
);

const bookingCancelledTemplate = findNotificationTemplate({
  eventKey: "booking_cancelled",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(bookingCancelledTemplate, premiumHebrewVariables).body,
  "נועה, ההזמנה בוטלה\n\nCore Flow\n\nאם תרצי לבחור שיעור אחר, אני כאן לעזור.\nירין",
);

const receiptIssuedTemplate = findNotificationTemplate({
  eventKey: "receipt_issued",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(receiptIssuedTemplate, premiumHebrewVariables).body,
  "נועה, הקבלה הונפקה\n\nR-1001\nאפשר לצפות בה באזור האישי.\nירין",
);

const paymentRequestReceivedTemplate = findNotificationTemplate({
  eventKey: "payment_request_received",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(paymentRequestReceivedTemplate, premiumHebrewVariables).body,
  "נועה, ראיתי את בקשת התשלום שלך\n\nמינוי חודשי\nאאשר אותה בהקדם ואעדכן אותך כשהחבילה תהיה פעילה.\nירין",
);

console.log("notification template helpers OK");
