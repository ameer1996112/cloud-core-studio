import { describe, expect, test } from "bun:test";
import {
  ADMIN_BOOKING_ALERT_EVENT,
  resolveAdminBookingAlertPolicy,
} from "../../src/lib/adminBookingAlerts.ts";

describe("admin self-booking alert policy", () => {
  test("uses the configured studio contact email and the lesson roster", () => {
    expect(
      resolveAdminBookingAlertPolicy({
        contactEmail: "  owner@example.com ",
        classId: "20000000-0000-0000-0000-000000000001",
      }),
    ).toEqual({
      eventType: ADMIN_BOOKING_ALERT_EVENT,
      language: "he",
      email: "owner@example.com",
      pushRecipient: "admin_group",
      deepLink: "/admin/classes/20000000-0000-0000-0000-000000000001",
    });
  });

  test("falls back to the Cloud & Core studio mailbox", () => {
    expect(resolveAdminBookingAlertPolicy({ contactEmail: null, classId: "class-1" }).email).toBe(
      "cloudandcorestudio@gmail.com",
    );
  });
});
