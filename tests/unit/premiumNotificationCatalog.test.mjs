import { describe, expect, test } from "bun:test";
import {
  NOTIFICATION_EVENT_CATALOG,
  notificationCategory,
  notificationDefinition,
  validateNotificationEventCatalog,
} from "../../src/lib/premiumNotificationCatalog.ts";

const APPROVED_EVENTS = [
  "member_welcome",
  "booking_confirmed",
  "booking_cancelled",
  "booking_changed",
  "booking_checked_in",
  "booking_no_show_followup",
  "class_cancelled_by_admin",
  "class_time_changed",
  "class_location_changed",
  "class_instructor_changed",
  "class_reminder_planning",
  "class_reminder_final",
  "class_published",
  "class_open_spots",
  "class_recommendation",
  "waitlist_joined",
  "waitlist_position_changed",
  "waitlist_spot_available",
  "waitlist_accepted",
  "waitlist_offer_expired",
  "waitlist_removed",
  "payment_request_received",
  "payment_pending_reminder",
  "payment_confirmed",
  "payment_failed",
  "payment_refunded",
  "receipt_issued",
  "membership_activated",
  "credits_low",
  "credits_depleted",
  "membership_expiring",
  "membership_expired",
  "subscription_renewal_upcoming",
  "subscription_renewal_succeeded",
  "subscription_renewal_failed",
  "subscription_paused",
  "subscription_cancelled",
  "human_handoff",
  "staff_reply",
  "human_handoff_resolved",
  "urgent_studio_announcement",
  "trial_followup",
  "retention_reminder",
].sort();

describe("premium notification event catalog", () => {
  test("contains every event approved in the branded notification design", () => {
    expect(Object.keys(NOTIFICATION_EVENT_CATALOG).sort()).toEqual(APPROVED_EVENTS);
    expect(validateNotificationEventCatalog()).toEqual({ ok: true, errors: [] });
  });

  test("preserves the current transactional routing while centralizing policy", () => {
    expect(notificationDefinition("booking_confirmed")).toMatchObject({
      tier: "transactional",
      channels: ["in_app", "push", "whatsapp", "email"],
      immediate: true,
      copyStatus: "approved",
      defaultEnabled: true,
    });
    expect(notificationDefinition("receipt_issued")).toMatchObject({
      tier: "inbox_only",
      channels: ["in_app"],
      interruptionLevel: "passive",
    });
  });

  test("uses the approved premium channel cadence instead of broadcasting every event", () => {
    expect(notificationDefinition("member_welcome").channels).toEqual([
      "in_app",
      "whatsapp",
      "email",
    ]);
    expect(notificationDefinition("class_reminder_planning")).toMatchObject({
      channels: ["in_app", "push", "whatsapp"],
      fallbackChannels: ["whatsapp"],
    });
    expect(notificationDefinition("class_reminder_final").channels).toEqual(["in_app", "whatsapp"]);
    expect(notificationDefinition("payment_request_received").channels).toEqual(["in_app"]);
    expect(notificationDefinition("payment_confirmed").channels).toEqual([
      "in_app",
      "push",
      "email",
    ]);
    expect(notificationDefinition("membership_activated").channels).toEqual(["in_app"]);
    expect(notificationDefinition("payment_confirmed")).toMatchObject({
      interruptionLevel: "passive",
      sound: "none",
    });
    expect(notificationDefinition("class_recommendation").channels).toEqual([
      "in_app",
      "push",
      "whatsapp",
    ]);
    expect(notificationDefinition("retention_reminder").channels).toEqual([
      "in_app",
      "push",
      "whatsapp",
    ]);
  });

  test("marks genuine urgent operations as time-sensitive with fallback", () => {
    for (const eventType of [
      "class_cancelled_by_admin",
      "class_time_changed",
      "class_location_changed",
      "payment_failed",
      "subscription_renewal_failed",
      "waitlist_spot_available",
      "staff_reply",
      "urgent_studio_announcement",
    ]) {
      expect(notificationDefinition(eventType)).toMatchObject({
        tier: "critical",
        immediate: true,
        interruptionLevel: "time-sensitive",
      });
      expect(notificationDefinition(eventType).fallbackChannels).toEqual(
        expect.arrayContaining(["whatsapp", "email"]),
      );
    }
  });

  test("ships every premium journey with reviewed copy while keeping consent and frequency gates", () => {
    for (const definition of Object.values(NOTIFICATION_EVENT_CATALOG)) {
      expect(definition).toMatchObject({
        defaultEnabled: true,
        copyStatus: "approved",
      });
    }
    expect(notificationDefinition("membership_activated")).toMatchObject({
      preference: "membership",
    });
    expect(notificationDefinition("class_recommendation")).toMatchObject({
      tier: "promotional",
      preference: "recommendations",
      frequencyPolicy: "promotional",
    });
  });

  test("models zero-credit open-class messaging as a separate safe action", () => {
    expect(notificationDefinition("class_open_spots").actions).toEqual([
      "book_now",
      "view_schedule",
      "choose_package",
    ]);
    expect(notificationDefinition("class_open_spots").zeroCreditAction).toBe("choose_package");
  });

  test("maps branded actions to matching native iOS categories", () => {
    expect(notificationCategory("booking_confirmed")).toBe("CC_BOOKING_ACTIONS");
    expect(notificationCategory("class_open_spots")).toBe("CC_OPEN_CLASS");
    expect(notificationCategory("class_open_spots", ["view_schedule", "choose_package"])).toBe(
      "CC_OPEN_CLASS_NO_CREDITS",
    );
    expect(notificationCategory("receipt_issued")).toBe("CC_RECEIPT");
    expect(notificationCategory("class_cancelled_by_admin")).toBe("CC_SCHEDULE_CONTACT");
  });
});
