import { describe, expect, test } from "bun:test";
import { materializeMessagePlan } from "../../src/lib/unifiedMessagingMaterialization.ts";

const base = {
  outboxId: "outbox-1",
  deduplicationKey: "booking:1:confirmed",
  eventType: "booking_confirmed",
  memberId: "member-1",
  language: "he",
  variables: {
    member_name: "נועה",
    class_name: "פילאטיס",
    class_date: "20/07/2026",
    class_time: "18:00",
    instructor_name: "ירין",
  },
  recipients: { whatsapp: "972501234567", email: "noa@example.com" },
  preferences: { whatsappEnabled: true, emailEnabled: true },
  externalChannels: { whatsapp: true, email: true, push: true },
  approvedWhatsappVariants: new Set(["cc_booking_confirmed_v2:he"]),
  now: new Date("2026-07-20T09:00:00.000Z"),
};

describe("outbox message materialization", () => {
  test("creates one channel-neutral message and one idempotent delivery per channel", () => {
    const result = materializeMessagePlan(base);
    expect(result.message).toMatchObject({
      idempotencyKey: "message:booking:1:confirmed",
      templateKey: "cc_booking_confirmed_v2",
      templateVersion: "v2",
      memberVisible: true,
      notificationFamily: "booking",
      notificationTier: "transactional",
      interruptionLevel: "active",
      soundKey: "default",
      actions: ["view_class", "cancel_booking"],
    });
    expect(result.deliveries.map((delivery) => delivery.channel)).toEqual([
      "in_app",
      "push",
      "whatsapp",
      "email",
    ]);
    expect(new Set(result.deliveries.map((delivery) => delivery.idempotencyKey)).size).toBe(4);
  });

  test("suppresses only an unavailable WhatsApp locale without substituting", () => {
    const result = materializeMessagePlan({ ...base, approvedWhatsappVariants: new Set() });
    expect(result.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      status: "suppressed",
      failureClass: "configuration",
      errorCode: "whatsapp_template_locale_unapproved",
    });
    expect(result.message.language).toBe("he");
  });

  test("suppresses disabled external channels instead of leaving a future-send backlog", () => {
    const result = materializeMessagePlan({
      ...base,
      externalChannels: { whatsapp: true, email: false, push: false },
    });

    expect(result.deliveries.find((delivery) => delivery.channel === "in_app")?.status).toBe(
      "queued",
    );
    expect(result.deliveries.find((delivery) => delivery.channel === "whatsapp")?.status).toBe(
      "queued",
    );
    expect(result.deliveries.find((delivery) => delivery.channel === "push")).toMatchObject({
      status: "suppressed",
      failureClass: null,
      errorCode: "push_channel_disabled",
    });
    expect(result.deliveries.find((delivery) => delivery.channel === "email")).toMatchObject({
      status: "suppressed",
      failureClass: null,
      errorCode: "email_channel_disabled",
    });
  });

  test("materializes open-class alerts as consented inbox and APNs deliveries only", () => {
    const eligible = materializeMessagePlan({
      ...base,
      eventType: "class_open_spots",
      deduplicationKey: "class:class-1:open-spots:member:member-1",
      preferences: { ...base.preferences, scheduleUpdates: true },
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "22/07/2026",
        class_time: "18:00",
        spots_available: "3",
        credits_remaining: 2,
      },
    });
    expect(eligible.deliveries.map((delivery) => delivery.channel)).toEqual(["in_app", "push"]);
    expect(eligible.deliveries.every((delivery) => delivery.status === "queued")).toBe(true);
    expect(eligible.deliveries.find((delivery) => delivery.channel === "push")?.provider).toBe(
      "apns",
    );

    const optedOut = materializeMessagePlan({
      ...base,
      eventType: "class_open_spots",
      deduplicationKey: "class:class-1:open-spots:member:member-2",
      preferences: { ...base.preferences, scheduleUpdates: false },
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "22/07/2026",
        class_time: "18:00",
        spots_available: "3",
        credits_remaining: 2,
      },
    });
    expect(optedOut.deliveries.find((delivery) => delivery.channel === "in_app")?.status).toBe(
      "queued",
    );
    expect(optedOut.deliveries.find((delivery) => delivery.channel === "push")).toMatchObject({
      status: "suppressed",
      errorCode: "push_opted_out",
    });
  });

  test("offers a package instead of an impossible booking action when credits are depleted", () => {
    const result = materializeMessagePlan({
      ...base,
      eventType: "class_open_spots",
      deduplicationKey: "class:class-1:open-spots:member:member-zero-credit",
      preferences: { ...base.preferences, scheduleUpdates: true },
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "22/07/2026",
        class_time: "18:00",
        spots_available: "3",
        credits_remaining: 0,
      },
    });
    expect(result.message.actions).toEqual(["view_schedule", "choose_package"]);
  });

  test("expires every waitlist delivery at the offer claim deadline", () => {
    const expiresAt = new Date("2026-07-20T10:15:00.000Z");
    const result = materializeMessagePlan({
      ...base,
      eventType: "waitlist_spot_available",
      deduplicationKey: "waitlist:1:offered",
      expiresAt,
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "20/07/2026",
        class_time: "18:00",
        offer_expires_at: "13:15",
      },
      approvedWhatsappVariants: new Set(["cc_waitlist_spot_available_v2:he"]),
    });
    expect(
      result.deliveries.every((delivery) => delivery.expiresAt === expiresAt.toISOString()),
    ).toBe(true);
  });

  test("delivers an expiring waitlist offer immediately even during routine quiet hours", () => {
    const now = new Date("2026-07-20T18:00:00.000Z");
    const result = materializeMessagePlan({
      ...base,
      now,
      eventType: "waitlist_spot_available",
      deduplicationKey: "waitlist:quiet-hours",
      expiresAt: new Date("2026-07-20T18:30:00.000Z"),
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "20/07/2026",
        class_time: "22:00",
        offer_expires_at: "21:30",
      },
      approvedWhatsappVariants: new Set(["cc_waitlist_spot_available_v2:he"]),
    });
    expect(result.deliveries.find((delivery) => delivery.channel === "in_app")?.scheduledFor).toBe(
      now.toISOString(),
    );
    expect(result.deliveries.find((delivery) => delivery.channel === "push")?.scheduledFor).toBe(
      now.toISOString(),
    );
  });

  test("suppresses channels that are outside a reviewed event rollout", () => {
    const result = materializeMessagePlan({
      ...base,
      eventType: "class_location_changed",
      deduplicationKey: "class:1:location",
      enabledChannels: new Set(["in_app", "push"]),
      preferences: { ...base.preferences, classOperations: true },
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "22/07/2026",
        class_time: "18:00",
        location_name: "Main studio",
      },
    });

    expect(result.deliveries.find((delivery) => delivery.channel === "in_app")?.status).toBe(
      "queued",
    );
    expect(result.deliveries.find((delivery) => delivery.channel === "push")?.status).toBe(
      "queued",
    );
    expect(result.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      status: "suppressed",
      errorCode: "event_channel_not_enabled",
    });
    expect(result.deliveries.find((delivery) => delivery.channel === "email")).toMatchObject({
      status: "suppressed",
      errorCode: "event_channel_not_enabled",
    });
  });

  test("honors member sound and Time Sensitive preferences in the immutable message snapshot", () => {
    const plan = materializeMessagePlan({
      ...base,
      eventType: "payment_failed",
      variables: { member_name: "נועה", package_name: "מינוי חודשי" },
      preferences: {
        whatsappEnabled: true,
        emailEnabled: true,
        sound: false,
        timeSensitive: false,
      },
    });

    expect(plan.message.soundKey).toBe("none");
    expect(plan.message.interruptionLevel).toBe("active");
  });

  test("escalates an unresolved payment reminder to WhatsApp 48 hours after push", () => {
    const now = new Date("2026-07-20T09:00:00.000Z");
    const plan = materializeMessagePlan({
      ...base,
      eventType: "payment_pending_reminder",
      now,
      variables: { member_name: "נועה", package_name: "מינוי חודשי" },
    });
    const push = plan.deliveries.find((delivery) => delivery.channel === "push");
    const whatsapp = plan.deliveries.find((delivery) => delivery.channel === "whatsapp");

    expect(push?.scheduledFor).toBe(now.toISOString());
    expect(whatsapp?.scheduledFor).toBe("2026-07-22T09:00:00.000Z");
  });
});
