import { describe, expect, test } from "bun:test";
import {
  advanceDeliveryStatus,
  conversationReplyMode,
  channelsForEvent,
  classifyProviderFailure,
  computeDeliveryRetry,
  deliveryAllowedByConsent,
  isQuietHours,
  isWhatsappOptOut,
  resolveMessagingRuntime,
  shouldCancelReminderForDomainState,
} from "../../src/lib/messagingPolicy.ts";

describe("unified messaging delivery policy", () => {
  test("fans out each event to its approved channel matrix", () => {
    expect(channelsForEvent("booking_confirmed")).toEqual(["in_app", "push", "whatsapp", "email"]);
    expect(channelsForEvent("waitlist_joined")).toEqual(["in_app", "push"]);
    expect(channelsForEvent("receipt_issued")).toEqual(["in_app", "email"]);
  });

  test("only essential events bypass a later external opt-out", () => {
    const optedOut = { whatsappEnabled: false, emailEnabled: false };
    expect(deliveryAllowedByConsent("booking_confirmed", "whatsapp", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("class_cancelled_by_admin", "whatsapp", optedOut)).toBe(true);
    expect(deliveryAllowedByConsent("class_time_changed", "email", optedOut)).toBe(true);
    expect(deliveryAllowedByConsent("payment_failed", "whatsapp", optedOut)).toBe(true);
    expect(deliveryAllowedByConsent("payment_confirmed", "email", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("booking_confirmed", "in_app", optedOut)).toBe(true);
  });

  test("enforces Jerusalem quiet hours for routine sends", () => {
    expect(isQuietHours(new Date("2026-07-20T02:30:00.000Z"))).toBe(true);
    expect(isQuietHours(new Date("2026-07-20T09:00:00.000Z"))).toBe(false);
    expect(isQuietHours(new Date("2026-07-20T18:00:00.000Z"))).toBe(true);
  });

  test("keeps webhook delivery transitions monotonic", () => {
    expect(advanceDeliveryStatus("sent", "delivered")).toBe("delivered");
    expect(advanceDeliveryStatus("read", "sent")).toBe("read");
    expect(advanceDeliveryStatus("dead_letter", "delivered")).toBe("dead_letter");
  });

  test("uses provider-specific bounded retries", () => {
    const failedAt = new Date("2026-07-20T10:00:00.000Z");
    expect(computeDeliveryRetry("whatsapp", 1, failedAt)?.toISOString()).toBe(
      "2026-07-20T10:01:00.000Z",
    );
    expect(computeDeliveryRetry("whatsapp", 4, failedAt)).toBeNull();
    expect(computeDeliveryRetry("email", 4, failedAt)?.toISOString()).toBe(
      "2026-07-20T12:00:00.000Z",
    );
    expect(computeDeliveryRetry("push", 3, failedAt)).toBeNull();
  });

  test("classifies ambiguous WhatsApp timeouts without retrying", () => {
    expect(classifyProviderFailure("whatsapp", { requestTransmitted: true, timeout: true })).toBe(
      "ambiguous",
    );
    expect(classifyProviderFailure("email", { status: 429 })).toBe("transient");
    expect(classifyProviderFailure("push", { status: 410 })).toBe("permanent");
  });

  test("recognizes localized WhatsApp opt-out requests", () => {
    expect(isWhatsappOptOut("STOP")).toBe(true);
    expect(isWhatsappOptOut("הסרה בבקשה")).toBe(true);
    expect(isWhatsappOptOut("إلغاء")).toBe(true);
    expect(isWhatsappOptOut("Please help me")).toBe(false);
  });

  test("defaults disabled and refuses an unconfirmed live WABA", () => {
    expect(resolveMessagingRuntime({})).toMatchObject({ mode: "disabled" });
    expect(() =>
      resolveMessagingRuntime({
        MESSAGING_DELIVERY_MODE: "live",
        MESSAGING_LIVE_WABA_CONFIRMATION: "wrong",
      }),
    ).toThrow("messaging_live_waba_confirmation_mismatch");
    expect(() => resolveMessagingRuntime({ MESSAGING_DELIVERY_MODE: "allowlist" })).toThrow(
      "messaging_allowlist_required",
    );
  });

  test("allows free-form handoff replies only inside the customer-service window", () => {
    const now = new Date("2026-07-20T10:00:00.000Z");
    expect(conversationReplyMode("2026-07-20T11:00:00.000Z", now, false)).toBe("freeform");
    expect(conversationReplyMode("2026-07-20T09:00:00.000Z", now, false)).toBe("rejected");
    expect(conversationReplyMode("2026-07-20T09:00:00.000Z", now, true)).toBe("template");
  });

  test("cancels delayed reminders when the booking or class is no longer active", () => {
    expect(
      shouldCancelReminderForDomainState("class_reminder_final", "cancelled", "scheduled"),
    ).toBe(true);
    expect(
      shouldCancelReminderForDomainState("class_reminder_planning", "booked", "cancelled"),
    ).toBe(true);
    expect(shouldCancelReminderForDomainState("class_reminder_final", "booked", "scheduled")).toBe(
      false,
    );
    expect(shouldCancelReminderForDomainState("booking_confirmed", "cancelled", "cancelled")).toBe(
      false,
    );
  });
});
