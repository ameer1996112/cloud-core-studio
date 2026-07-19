import { strict as assert } from "node:assert";
import { buildNotificationDraftRows } from "../../src/lib/notificationDrafts.ts";

const rows = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp", "email"],
  audience: "member",
  member: {
    id: "member-1",
    name: "Noa",
    phone: "+972501234567",
    email: "noa@example.com",
    preferred_language: "en",
  },
  appLanguage: "he",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: "+972400000000",
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-1",
    classId: "class-1",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "29/06/2026",
    class_time: "18:00",
    instructor_name: "Maya",
  },
});

assert.equal(rows.length, 2);
assert.equal(rows[0].status, "queued");
assert.equal(rows[0].language, "en");
assert.equal(rows[0].staff_visibility, "operational");
assert.equal(rows[0].related_booking_id, "booking-1");
assert.equal(rows[0].related_class_id, "class-1");
assert.equal(rows[0].idempotency_key, "booking:booking-1:booking_confirmed:whatsapp");
assert.equal(rows[0].provider, "openwa");
assert.ok(typeof rows[0].scheduled_for === "string");
assert.ok(rows[0].generated_text?.includes("Noa"));
assert.equal(rows[1].channel, "email");
assert.equal(rows[1].language, "en");
assert.equal(rows[1].status, "draft");
assert.ok(rows[1].subject?.includes("Core Flow"));

const bookingRows = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-booking",
    name: "Noa",
    phone: "+972501234567",
    email: "noa@example.com",
    preferred_language: "en",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: "+972400000000",
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-auto-scope",
    classId: "class-auto-scope",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "29/06/2026",
    class_time: "18:00",
    instructor_name: "Maya",
  },
});

assert.equal(bookingRows[0].status, "queued");

const lateBookingRows = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-late-booking",
    name: "Aline",
    phone: "+972501234567",
    email: "aline@example.com",
    preferred_language: "he",
  },
  appLanguage: "he",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: "+972400000000",
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-late",
    classId: "class-late",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "06/07/2026",
    class_time: "16:30",
    instructor_name: "Maya",
  },
  delivery: {
    scheduledFor: "2026-07-04T20:08:07.180Z",
  },
});

assert.equal(lateBookingRows[0].status, "queued");
assert.equal(lateBookingRows[0].scheduled_for, "2026-07-04T20:08:07.180Z");

const autoPaymentRows = buildNotificationDraftRows({
  eventKey: "payment_confirmed",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-payment",
    name: "Mira",
    phone: "+972509998887",
    email: "mira@example.com",
    preferred_language: "he",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    paymentId: "payment-auto-1",
  },
  variables: {
    package_name: "Ten Classes",
  },
  delivery: {
    scheduledFor: "2026-07-04T20:08:07.180Z",
  },
});

assert.equal(autoPaymentRows[0].status, "queued");
assert.equal(autoPaymentRows[0].scheduled_for, "2026-07-05T05:00:00.000Z");

const lifecycleRows = buildNotificationDraftRows({
  eventKey: "package_approved_no_booking",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-lifecycle",
    name: "Noa",
    phone: "+972501234567",
    email: "noa@example.com",
    preferred_language: "he",
  },
  appLanguage: "he",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    memberPlanId: "member-plan-lifecycle",
  },
  variables: {
    package_name: "מינוי היכרות",
  },
});

assert.equal(lifecycleRows[0].status, "queued");
assert.equal(
  lifecycleRows[0].idempotency_key,
  "member_plan:member-plan-lifecycle:package_approved_no_booking:whatsapp",
);
assert.ok(lifecycleRows[0].generated_text?.includes("החבילה שלך כבר מחכה לך"));

const receiptRows = buildNotificationDraftRows({
  eventKey: "receipt_issued",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-receipt",
    name: "Mira",
    phone: "+972509998887",
    email: "mira@example.com",
    preferred_language: "he",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    receiptId: "receipt-manual-1",
  },
  variables: {
    receipt_number: "R-1001",
  },
});

assert.equal(receiptRows[0].status, "draft");

const waitlistRows = buildNotificationDraftRows({
  eventKey: "waitlist_joined",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-4",
    name: "Leah",
    phone: "+972501112223",
    email: null,
    preferred_language: null,
  },
  appLanguage: "fr",
  studioSettings: {
    default_language: null,
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    waitlistEntryId: "waitlist-1",
    classId: "class-7",
  },
  variables: {
    class_name: "Core Flow",
  },
});

assert.equal(waitlistRows[0].status, "draft");
assert.equal(waitlistRows[0].language, "he");
assert.equal(waitlistRows[0].idempotency_key, "waitlist:waitlist-1:waitlist_joined:whatsapp");
assert.equal(waitlistRows[0].payload.related_ids.waitlistEntryId, "waitlist-1");
assert.ok(waitlistRows[0].generated_text?.includes("Leah"));

const skipped = buildNotificationDraftRows({
  eventKey: "booking_confirmed",
  channels: ["whatsapp", "email"],
  audience: "member",
  member: {
    id: "member-2",
    name: "Dana",
    phone: null,
    email: null,
    preferred_language: null,
  },
  appLanguage: null,
  studioSettings: {
    default_language: null,
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: null,
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-2",
    classId: "class-2",
  },
  variables: {
    class_name: "Core Flow",
    class_date: "29/06/2026",
    class_time: "18:00",
    instructor_name: "Maya",
  },
});

assert.equal(skipped[0].status, "skipped");
assert.equal(skipped[0].error_message, "missing_whatsapp_phone");
assert.equal(skipped[1].status, "skipped");
assert.equal(skipped[1].error_message, "missing_email");
assert.equal(skipped[0].language, "he");

const paymentRows = buildNotificationDraftRows({
  eventKey: "payment_confirmed",
  channels: ["email"],
  audience: "member",
  member: {
    id: "member-3",
    name: "Mira",
    phone: null,
    email: "mira@example.com",
    preferred_language: "he",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "en",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: null,
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    paymentId: "payment-1",
  },
  variables: {
    package_name: "Ten Classes",
  },
});

assert.equal(paymentRows[0].staff_visibility, "admin_only");
assert.equal(paymentRows[0].related_payment_id, "payment-1");

const memberPackageRequestRows = buildNotificationDraftRows({
  eventKey: "payment_request_received",
  channels: ["email"],
  audience: "member",
  member: {
    id: "member-5",
    name: "Rina",
    phone: null,
    email: "rina@example.com",
    preferred_language: "en",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: null,
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    packageRequestId: "pkg-req-1",
  },
  variables: {
    package_name: "Intro Pack",
  },
});

assert.equal(memberPackageRequestRows[0].staff_visibility, "operational");

const adminPackageRequestRows = buildNotificationDraftRows({
  eventKey: "payment_request_received",
  channels: ["email"],
  audience: "admin",
  member: {
    id: "member-6",
    name: "Rina",
    phone: null,
    email: "rina@example.com",
    preferred_language: "en",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: null,
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    packageRequestId: "pkg-req-2",
  },
  variables: {
    package_name: "Intro Pack",
  },
});

assert.equal(adminPackageRequestRows[0].staff_visibility, "admin_only");

const classCancelledRows = buildNotificationDraftRows({
  eventKey: "class_cancelled_by_admin",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-7",
    name: "Yael",
    phone: "+972501111111",
    email: "yael@example.com",
    preferred_language: "he",
  },
  appLanguage: "he",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-7",
    classId: "class-7",
  },
  variables: {
    class_name: "Pilates Mat",
    class_date: "30/06/2026",
    class_time: "17:00",
  },
});

assert.equal(
  classCancelledRows[0].idempotency_key,
  "booking:booking-7:class_cancelled_by_admin:whatsapp",
);
assert.ok(classCancelledRows[0].generated_text?.includes("לא יתקיים"));

const reminder2hRows = buildNotificationDraftRows({
  eventKey: "class_reminder_2h",
  channels: ["email"],
  audience: "member",
  member: {
    id: "member-8",
    name: "Amal",
    phone: null,
    email: "amal@example.com",
    preferred_language: "ar",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: null,
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-8",
    classId: "class-8",
  },
  variables: {
    class_name: "Aerial Yoga",
    class_time: "19:00",
  },
});

assert.equal(reminder2hRows[0].language, "ar");
assert.ok(reminder2hRows[0].subject?.includes("تذكير"));

const skippedReminderRows = buildNotificationDraftRows({
  eventKey: "class_reminder_2h",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-9",
    name: "Tamar",
    phone: "+972500000111",
    email: null,
    preferred_language: "he",
  },
  appLanguage: "he",
  studioSettings: {
    default_language: "he",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    bookingId: "booking-9",
    classId: "class-9",
  },
  variables: {
    class_name: "Sunrise Core",
    class_time: "08:15",
  },
  delivery: {
    scheduledFor: "2026-07-01T03:00:00.000Z",
    classStartsAt: "2026-07-01T05:00:00.000Z",
  },
});

assert.equal(skippedReminderRows[0].status, "skipped");

const cancelledWaitlistRows = buildNotificationDraftRows({
  eventKey: "waitlist_spot_available",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-10",
    name: "Adi",
    phone: "+972500000222",
    email: null,
    preferred_language: "en",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "en",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    classId: "class-10",
    waitlistEntryId: "waitlist-10",
  },
  variables: {
    class_name: "Evening Flow",
    class_date: "01/07/2026",
    class_time: "09:00",
  },
  delivery: {
    scheduledFor: "2026-07-01T03:00:00.000Z",
    waitlistExpiresAt: "2026-07-01T04:15:00.000Z",
  },
});

assert.equal(cancelledWaitlistRows[0].status, "cancelled");

const localizedWhatsAppRows = buildNotificationDraftRows({
  eventKey: "registered_no_action",
  channels: ["whatsapp"],
  audience: "member",
  member: {
    id: "member-hebrew-only",
    name: "Dana",
    phone: "+972500000333",
    email: null,
    preferred_language: "en",
  },
  appLanguage: "en",
  studioSettings: {
    default_language: "en",
    studio_name: "Cloud & Core",
    public_phone: null,
    whatsapp_number: "+972500000000",
    timezone: "Asia/Jerusalem",
  },
  relatedIds: {
    memberId: "member-hebrew-only",
  },
  variables: {},
});

assert.equal(localizedWhatsAppRows[0].language, "en");
assert.ok(localizedWhatsAppRows[0].generated_text?.toLowerCase().includes("welcome"));

console.log("notification draft rows OK");
