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

  test("delivers in-app immediately even when external waitlist sends are in quiet hours", () => {
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
    expect(
      result.deliveries.find((delivery) => delivery.channel === "push")?.scheduledFor,
    ).not.toBe(now.toISOString());
  });
});
