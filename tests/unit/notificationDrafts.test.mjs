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
assert.equal(rows[0].status, "draft");
assert.equal(rows[0].language, "en");
assert.equal(rows[0].staff_visibility, "operational");
assert.equal(rows[0].related_booking_id, "booking-1");
assert.equal(rows[0].related_class_id, "class-1");
assert.equal(rows[0].idempotency_key, "booking:booking-1:booking_confirmed:whatsapp");
assert.ok(rows[0].generated_text?.includes("Noa"));
assert.equal(rows[1].channel, "email");
assert.equal(rows[1].status, "draft");
assert.ok(rows[1].subject?.includes("Core Flow"));

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
  eventKey: "package_request_received",
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
  eventKey: "package_request_received",
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

console.log("notification draft rows OK");
