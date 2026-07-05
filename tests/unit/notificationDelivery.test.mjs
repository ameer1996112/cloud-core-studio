import { describe, expect, test } from "bun:test";
import {
  computeRetrySchedule,
  shouldAutoQueueOpenwaNotification,
  shouldBypassQuietHoursForOpenwaNotification,
} from "../../src/lib/notificationDelivery.ts";

describe("shouldAutoQueueOpenwaNotification", () => {
  test("enables only the approved automatic OpenWA event set", () => {
    expect(shouldAutoQueueOpenwaNotification("payment_confirmed")).toBe(true);
    expect(shouldAutoQueueOpenwaNotification("booking_confirmed")).toBe(true);
    expect(shouldAutoQueueOpenwaNotification("class_reminder_24h")).toBe(true);
    expect(shouldAutoQueueOpenwaNotification("waitlist_spot_available")).toBe(true);
    expect(shouldAutoQueueOpenwaNotification("class_cancelled_by_admin")).toBe(true);
    expect(shouldAutoQueueOpenwaNotification("class_time_changed")).toBe(true);

    expect(shouldAutoQueueOpenwaNotification("receipt_issued")).toBe(false);
    expect(shouldAutoQueueOpenwaNotification("class_reminder_2h")).toBe(false);
    expect(shouldAutoQueueOpenwaNotification("no_show_followup")).toBe(false);
  });
});

describe("shouldBypassQuietHoursForOpenwaNotification", () => {
  test("allows registration confirmations to send immediately", () => {
    expect(shouldBypassQuietHoursForOpenwaNotification("booking_confirmed")).toBe(true);

    expect(shouldBypassQuietHoursForOpenwaNotification("payment_confirmed")).toBe(false);
    expect(shouldBypassQuietHoursForOpenwaNotification("class_reminder_24h")).toBe(false);
    expect(shouldBypassQuietHoursForOpenwaNotification("waitlist_spot_available")).toBe(false);
  });
});

describe("computeRetrySchedule", () => {
  test("keeps booking confirmation retries immediate outside quiet hours", () => {
    const retryAt = computeRetrySchedule({
      attemptCount: 1,
      failedAt: new Date("2026-07-04T20:33:42.000Z"),
      eventType: "booking_confirmed",
    });

    expect(retryAt?.toISOString()).toBe("2026-07-04T20:38:42.000Z");
  });

  test("keeps other retries inside the allowed send window", () => {
    const retryAt = computeRetrySchedule({
      attemptCount: 1,
      failedAt: new Date("2026-07-04T20:33:42.000Z"),
      eventType: "payment_confirmed",
    });

    expect(retryAt?.toISOString()).toBe("2026-07-05T05:00:00.000Z");
  });
});
