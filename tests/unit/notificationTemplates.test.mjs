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

const adminPackageTemplate = findNotificationTemplate({
  eventKey: "package_request_received",
  channel: "email",
  language: "en",
  audience: "admin",
});

const adminRendered = renderNotificationCopy(adminPackageTemplate, {
  member_name: "Noa",
  package_name: "10 Class Pack",
});

assert.ok(adminRendered.subject?.includes("awaiting review"));
assert.ok(adminRendered.body.includes("A new package request was received"));

assert.equal(notificationStaffVisibility("payment_confirmed"), "admin_only");
assert.equal(notificationStaffVisibility("receipt_issued"), "admin_only");
assert.equal(notificationStaffVisibility("booking_confirmed"), "operational");

assert.equal(
  buildNotificationIdempotencyKey({
    eventKey: "package_request_received",
    channel: "email",
    audience: "admin",
    relatedIds: { packageRequestId: "pkg-1" },
  }),
  "package_request:pkg-1:package_request_received:email:admin",
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

console.log("notification template helpers OK");
