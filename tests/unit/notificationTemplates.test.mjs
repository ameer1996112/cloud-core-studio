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

assert.ok(rendered.body.includes("נועה"));
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

const premiumBookingTemplate = findNotificationTemplate({
  eventKey: "booking_confirmed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumBookingTemplate, premiumHebrewVariables).body,
  "🕊️ ההזמנה שלך אושרה\nCore Flow · 29/06/2026 · 18:00\nעם Maya\nנשמח לראות אותך ב-Cloud & Core",
);

const premiumPaymentTemplate = findNotificationTemplate({
  eventKey: "payment_confirmed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumPaymentTemplate, premiumHebrewVariables).body,
  "✨ התשלום שלך אושר\nעבור מינוי חודשי\nנשמח להמשיך לארח אותך ב-Cloud & Core",
);

const premiumReminderTemplate = findNotificationTemplate({
  eventKey: "class_reminder_24h",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumReminderTemplate, premiumHebrewVariables).body,
  "⏰ תזכורת עדינה לקראת השיעור שלך\nCore Flow · 29/06/2026 · 18:00\nעם Maya\nנשמח לראות אותך ב-Cloud & Core",
);

const premiumWaitlistTemplate = findNotificationTemplate({
  eventKey: "waitlist_spot_available",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumWaitlistTemplate, premiumHebrewVariables).body,
  "🤍 התפנה מקום עבורך\nCore Flow · 29/06/2026 · 18:00\nאם זה מתאים לך, אפשר להשלים את ההזמנה עכשיו",
);

const premiumCancelledTemplate = findNotificationTemplate({
  eventKey: "class_cancelled_by_admin",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumCancelledTemplate, premiumHebrewVariables).body,
  "עדכון לגבי השיעור שלך\nCore Flow בתאריך 29/06/2026 בשעה 18:00 לא יתקיים\nנעדכן אותך בכל אפשרות חלופית רלוונטית",
);

const premiumTimeChangedTemplate = findNotificationTemplate({
  eventKey: "class_time_changed",
  channel: "whatsapp",
  language: "he",
  audience: "member",
});

assert.equal(
  renderNotificationCopy(premiumTimeChangedTemplate, premiumHebrewVariables).body,
  "השעה של השיעור שלך עודכנה\nCore Flow · 29/06/2026 · 18:00\nנשמח לראות אותך ב-Cloud & Core",
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

console.log("notification template helpers OK");
