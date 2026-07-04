import { describe, expect, test } from "bun:test";
import { shouldAutoQueueOpenwaNotification } from "../../src/lib/notificationDelivery.ts";

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
