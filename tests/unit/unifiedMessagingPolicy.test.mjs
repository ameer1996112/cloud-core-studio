import { describe, expect, test } from "bun:test";
import {
  advanceDeliveryStatus,
  conversationReplyMode,
  channelsForEvent,
  classifyProviderFailure,
  computeDeliveryRetry,
  deliveryAllowedByConsent,
  isQuietHours,
  isUnopenedSuccessfulPushMessage,
  isWhatsappOptOut,
  resolveMessagingRuntime,
  runtimeAllowsRolloutRecipient,
  runtimeAllowsRecipient,
  requiresPromotionalFrequencyReservation,
  shouldCancelPaymentReminderForDomainState,
  shouldCancelReminderForDomainState,
} from "../../src/lib/messagingPolicy.ts";

describe("unified messaging delivery policy", () => {
  test("fans out each event to its approved channel matrix", () => {
    expect(channelsForEvent("booking_confirmed")).toEqual(["in_app", "push", "whatsapp", "email"]);
    expect(channelsForEvent("waitlist_joined")).toEqual(["in_app", "push"]);
    expect(channelsForEvent("class_open_spots")).toEqual(["in_app", "push"]);
    expect(channelsForEvent("payment_request_received")).toEqual(["in_app"]);
    expect(channelsForEvent("receipt_issued")).toEqual(["in_app"]);
    expect(channelsForEvent("membership_activated")).toEqual(["in_app"]);
    expect(channelsForEvent("weekly_schedule")).toEqual(["in_app", "push", "whatsapp"]);
  });

  test("keeps the durable inbox record while schedule-opening consent governs push", () => {
    expect(deliveryAllowedByConsent("class_open_spots", "in_app", { scheduleUpdates: true })).toBe(
      true,
    );
    expect(deliveryAllowedByConsent("class_open_spots", "push", { scheduleUpdates: true })).toBe(
      true,
    );
    expect(deliveryAllowedByConsent("class_open_spots", "in_app", { scheduleUpdates: false })).toBe(
      true,
    );
    expect(deliveryAllowedByConsent("class_open_spots", "push", { scheduleUpdates: false })).toBe(
      false,
    );
  });

  test("requires both schedule and WhatsApp consent for the weekly message", () => {
    expect(
      deliveryAllowedByConsent("weekly_schedule", "whatsapp", {
        scheduleUpdates: true,
        whatsappEnabled: true,
      }),
    ).toBe(true);
    expect(
      deliveryAllowedByConsent("weekly_schedule", "whatsapp", {
        scheduleUpdates: true,
        whatsappEnabled: false,
      }),
    ).toBe(false);
    expect(
      deliveryAllowedByConsent("weekly_schedule", "whatsapp", {
        scheduleUpdates: false,
        whatsappEnabled: true,
      }),
    ).toBe(false);
  });

  test("honors the member-wide push channel choice for routine reminders", () => {
    expect(
      deliveryAllowedByConsent("class_reminder_planning", "push", {
        classReminders: true,
        pushEnabled: false,
      }),
    ).toBe(false);
    expect(
      deliveryAllowedByConsent("class_reminder_planning", "push", {
        classReminders: true,
        pushEnabled: true,
      }),
    ).toBe(true);
  });

  test("keeps essential content available in-app without bypassing channel opt-outs", () => {
    const optedOut = { whatsappEnabled: false, emailEnabled: false };
    expect(deliveryAllowedByConsent("booking_confirmed", "whatsapp", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("member_welcome", "email", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("class_cancelled_by_admin", "whatsapp", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("class_time_changed", "email", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("payment_failed", "whatsapp", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("waitlist_spot_available", "whatsapp", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("payment_confirmed", "email", optedOut)).toBe(false);
    expect(deliveryAllowedByConsent("booking_confirmed", "in_app", optedOut)).toBe(true);
    expect(deliveryAllowedByConsent("waitlist_spot_available", "in_app", { waitlist: false })).toBe(
      true,
    );
    expect(
      deliveryAllowedByConsent("subscription_renewal_failed", "in_app", {
        membership: false,
      }),
    ).toBe(true);
    expect(
      deliveryAllowedByConsent("class_cancelled_by_admin", "push", {
        pushEnabled: false,
      }),
    ).toBe(false);
  });

  test("does not charge staff previews against the real member promotional frequency budget", () => {
    expect(requiresPromotionalFrequencyReservation("retention_reminder", true)).toBe(false);
    expect(requiresPromotionalFrequencyReservation("retention_reminder", false)).toBe(true);
    expect(requiresPromotionalFrequencyReservation("booking_confirmed", false)).toBe(false);
  });

  test("counts escalation evidence only for a successful, unopened push delivery", () => {
    const unopened = {
      message_deliveries: [{ channel: "push", status: "sent" }],
      message_engagement_events: [],
    };
    expect(isUnopenedSuccessfulPushMessage(unopened)).toBe(true);
    expect(
      isUnopenedSuccessfulPushMessage({
        ...unopened,
        message_deliveries: [{ channel: "push", status: "suppressed" }],
      }),
    ).toBe(false);
    expect(
      isUnopenedSuccessfulPushMessage({
        ...unopened,
        message_engagement_events: [{ event_type: "opened" }],
      }),
    ).toBe(false);
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

  test("allowlist mode independently protects WhatsApp phone and APNs member recipients", () => {
    const runtime = resolveMessagingRuntime({
      MESSAGING_DELIVERY_MODE: "allowlist",
      MESSAGING_RECIPIENT_ALLOWLIST: "+972546464437,755538ce-8c17-4cf2-a732-8534bea23258",
      MESSAGING_WHATSAPP_ENABLED: "true",
      MESSAGING_PUSH_ENABLED: "true",
    });
    expect(runtimeAllowsRecipient(runtime, "whatsapp", "+972546464437")).toBe(true);
    expect(runtimeAllowsRecipient(runtime, "whatsapp", "0546464437")).toBe(true);
    expect(runtimeAllowsRecipient(runtime, "whatsapp", "054-646-4437")).toBe(true);
    expect(runtimeAllowsRecipient(runtime, "whatsapp", "972546464437")).toBe(true);
    expect(runtimeAllowsRecipient(runtime, "whatsapp", "0546464438")).toBe(false);
    expect(runtimeAllowsRecipient(runtime, "push", "755538ce-8c17-4cf2-a732-8534bea23258")).toBe(
      true,
    );
    expect(runtimeAllowsRecipient(runtime, "push", "00000000-0000-0000-0000-000000000000")).toBe(
      false,
    );
  });

  test("restricts every allowlist-only rollout channel to a matched member contact", () => {
    const runtime = resolveMessagingRuntime({
      MESSAGING_DELIVERY_MODE: "allowlist",
      MESSAGING_RECIPIENT_ALLOWLIST: "+972500000001,staff@example.com",
    });

    expect(runtimeAllowsRolloutRecipient(runtime, [null, "+972500000001"])).toBe(true);
    expect(runtimeAllowsRolloutRecipient(runtime, ["0500000001"])).toBe(true);
    expect(runtimeAllowsRolloutRecipient(runtime, ["staff@example.com"])).toBe(true);
    expect(runtimeAllowsRolloutRecipient(runtime, ["member@example.com", "+972500000002"])).toBe(
      false,
    );
    expect(runtimeAllowsRolloutRecipient({ ...runtime, mode: "live" }, ["staff@example.com"])).toBe(
      true,
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

  test("cancels the 72-hour payment escalation as soon as payment is resolved", () => {
    expect(shouldCancelPaymentReminderForDomainState("payment_pending_reminder", "paid")).toBe(
      true,
    );
    expect(shouldCancelPaymentReminderForDomainState("payment_pending_reminder", "failed")).toBe(
      true,
    );
    expect(shouldCancelPaymentReminderForDomainState("payment_pending_reminder", "pending")).toBe(
      false,
    );
    expect(shouldCancelPaymentReminderForDomainState("payment_confirmed", "paid")).toBe(false);
  });
});
