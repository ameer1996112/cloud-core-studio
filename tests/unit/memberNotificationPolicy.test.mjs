import { describe, expect, test } from "bun:test";
import {
  decideLifecycleWhatsappFallback,
  decideMemberNotificationDelivery,
  decidePaymentReminderActions,
} from "../../src/lib/memberNotificationPolicy.ts";

const enabledPreferences = {
  lessonReminders: true,
  scheduleUpdates: true,
  packageReminders: true,
  marketing: true,
  sound: true,
};

function decide(overrides = {}) {
  return decideMemberNotificationDelivery({
    category: "schedule",
    preferences: enabledPreferences,
    hasActivePushDevice: true,
    isQuietHours: false,
    marketingPushesLast7Days: 0,
    marketingPushesToday: 0,
    duplicateWithin7Days: false,
    ...overrides,
  });
}

describe("member notification delivery policy", () => {
  test("persists every member event in the inbox even without an active device", () => {
    expect(decide({ hasActivePushDevice: false })).toEqual({
      createInboxItem: true,
      sendPush: false,
      pushSound: false,
      sendWhatsapp: false,
      deferredByQuietHours: false,
      suppressedReason: "no_active_push_device",
    });
  });

  test("defers normal pushes during quiet hours", () => {
    expect(decide({ isQuietHours: true })).toMatchObject({
      createInboxItem: true,
      sendPush: false,
      deferredByQuietHours: true,
      suppressedReason: "quiet_hours",
    });
  });

  test("sends an urgent class cancellation immediately through push and WhatsApp", () => {
    expect(decide({ category: "urgent_class_change", isQuietHours: true })).toEqual({
      createInboxItem: true,
      sendPush: true,
      pushSound: true,
      sendWhatsapp: true,
      deferredByQuietHours: false,
      suppressedReason: null,
    });
  });

  test("keeps payment confirmation out of push while retaining WhatsApp receipt delivery", () => {
    expect(decide({ category: "payment_confirmed" })).toEqual({
      createInboxItem: true,
      sendPush: false,
      pushSound: false,
      sendWhatsapp: true,
      deferredByQuietHours: false,
      suppressedReason: "channel_policy",
    });
  });

  test("respects marketing consent and weekly frequency limits", () => {
    expect(
      decide({ category: "marketing", preferences: { ...enabledPreferences, marketing: false } }),
    ).toMatchObject({ sendPush: false, suppressedReason: "preference_disabled" });

    expect(decide({ category: "marketing", marketingPushesLast7Days: 3 })).toMatchObject({
      sendPush: false,
      suppressedReason: "weekly_frequency_limit",
    });
  });

  test("only enables sound for approved operational categories", () => {
    expect(decide({ category: "schedule" }).pushSound).toBe(false);
    expect(decide({ category: "lesson_reminder" }).pushSound).toBe(true);
    expect(
      decide({ category: "lesson_reminder", preferences: { ...enabledPreferences, sound: false } })
        .pushSound,
    ).toBe(false);
  });
});

describe("lifecycle WhatsApp fallback policy", () => {
  test("uses WhatsApp only when push is unavailable during the normal lifecycle", () => {
    expect(
      decideLifecycleWhatsappFallback({
        hasActivePushDevice: false,
        isThirtyDayEscalation: false,
        marketingConsent: false,
      }),
    ).toBe(true);
    expect(
      decideLifecycleWhatsappFallback({
        hasActivePushDevice: true,
        isThirtyDayEscalation: false,
        marketingConsent: true,
      }),
    ).toBe(false);
  });

  test("requires marketing consent for the 30-day WhatsApp escalation", () => {
    expect(
      decideLifecycleWhatsappFallback({
        hasActivePushDevice: true,
        isThirtyDayEscalation: true,
        marketingConsent: true,
      }),
    ).toBe(true);
    expect(
      decideLifecycleWhatsappFallback({
        hasActivePushDevice: true,
        isThirtyDayEscalation: true,
        marketingConsent: false,
      }),
    ).toBe(false);
  });
});

describe("payment reminder policy", () => {
  test("nudges a pending payment by push after 24 hours and escalates to WhatsApp after 3 days", () => {
    expect(decidePaymentReminderActions({ status: "pending", ageHours: 23 })).toEqual({
      createInbox: false,
      sendPush: false,
      sendWhatsapp: false,
    });
    expect(decidePaymentReminderActions({ status: "pending", ageHours: 24 })).toEqual({
      createInbox: true,
      sendPush: true,
      sendWhatsapp: false,
    });
    expect(decidePaymentReminderActions({ status: "pending", ageHours: 72 })).toEqual({
      createInbox: true,
      sendPush: true,
      sendWhatsapp: true,
    });
  });

  test("escalates failed payments immediately and keeps successful payments inbox-only", () => {
    expect(decidePaymentReminderActions({ status: "failed", ageHours: 0 })).toEqual({
      createInbox: true,
      sendPush: true,
      sendWhatsapp: true,
    });
    expect(decidePaymentReminderActions({ status: "paid", ageHours: 0 })).toEqual({
      createInbox: true,
      sendPush: false,
      sendWhatsapp: false,
    });
  });
});
