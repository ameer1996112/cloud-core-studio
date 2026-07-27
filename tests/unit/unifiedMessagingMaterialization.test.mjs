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
  approvedWhatsappVariants: new Set(["booking_confirmed_repeat_branded_v2:he"]),
  now: new Date("2026-07-20T09:00:00.000Z"),
};

describe("outbox message materialization", () => {
  test("routes Concierge-covered events to the branded WhatsApp catalog", () => {
    const result = materializeMessagePlan({
      ...base,
      approvedWhatsappVariants: new Set(["booking_confirmed_repeat_branded_v2:he"]),
    });

    expect(result.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      status: "queued",
      templateName: "booking_confirmed_repeat_branded_v2",
      templateLanguage: "he",
      templateComponents: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png",
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [{ type: "text", text: "נועה" }],
        },
      ],
    });
  });

  test("keeps unsupported reminder flows on their legacy WhatsApp template", () => {
    const result = materializeMessagePlan({
      ...base,
      eventType: "class_reminder_final",
      approvedWhatsappVariants: new Set(["cc_class_reminder_final_v2:he"]),
    });

    expect(result.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      templateName: "cc_class_reminder_final_v2",
      templateComponents: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "נועה" },
            { type: "text", text: "פילאטיס" },
            { type: "text", text: "20/07/2026" },
            { type: "text", text: "18:00" },
            { type: "text", text: "ירין" },
          ],
        },
      ],
    });
  });

  test("welcomes through durable inbox, WhatsApp and email with a context-aware primary action", () => {
    const firstLesson = materializeMessagePlan({
      ...base,
      eventType: "member_welcome",
      deduplicationKey: "member:welcome:member-1:v2",
      variables: {
        member_name: "נועה",
        has_upcoming_booking: false,
        has_active_membership: true,
        credits_remaining: 2,
      },
      approvedWhatsappVariants: new Set(["cc_member_welcome_v2:he"]),
    });
    expect(firstLesson.deliveries.map((delivery) => delivery.channel)).toEqual([
      "in_app",
      "whatsapp",
      "email",
    ]);
    expect(firstLesson.message.actions).toEqual(["view_schedule"]);

    const upcoming = materializeMessagePlan({
      ...base,
      eventType: "member_welcome",
      variables: { member_name: "נועה", has_upcoming_booking: true, credits_remaining: 2 },
      approvedWhatsappVariants: new Set(["cc_member_welcome_v2:he"]),
    });
    expect(upcoming.message.actions).toEqual(["view_class"]);

    const noPackage = materializeMessagePlan({
      ...base,
      eventType: "member_welcome",
      variables: {
        member_name: "נועה",
        has_upcoming_booking: false,
        has_active_membership: false,
        credits_remaining: 0,
      },
      approvedWhatsappVariants: new Set(["cc_member_welcome_v2:he"]),
    });
    expect(noPackage.message.actions).toEqual(["choose_package"]);
  });

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
    expect(result.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      templateComponents: [
        {
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: "https://cloudandcorestudio.com/brand/concierge-whatsapp-header.png",
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [{ type: "text", text: "נועה" }],
        },
      ],
    });
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

  test("routes admin-only handoff alerts to the admin device group", () => {
    const result = materializeMessagePlan({
      ...base,
      eventType: "human_handoff",
      deduplicationKey: "handoff:staff-test",
      preferences: { ...base.preferences, staffReplies: true },
      variables: { member_name: "נועה" },
      approvedWhatsappVariants: new Set(["cc_human_handoff_v2:he"]),
    });

    expect(result.message).toMatchObject({ memberVisible: false, audience: "admin" });
    expect(result.deliveries.find((delivery) => delivery.channel === "in_app")).toMatchObject({
      recipientAddress: "admin_group",
    });
    expect(result.deliveries.find((delivery) => delivery.channel === "push")).toMatchObject({
      recipientAddress: "admin_group",
    });
    expect(result.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      recipientAddress: "972501234567",
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
      approvedWhatsappVariants: new Set(["waitlist_offer_branded_v2:he"]),
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
      approvedWhatsappVariants: new Set(["waitlist_offer_branded_v2:he"]),
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

  test("uses WhatsApp only as a planning-reminder fallback when push is unavailable", () => {
    const withPush = materializeMessagePlan({
      ...base,
      eventType: "class_reminder_planning",
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "22/07/2026",
        class_time: "18:00",
        has_active_push_device: true,
      },
      preferences: { ...base.preferences, classReminders: true },
      approvedWhatsappVariants: new Set(["cc_class_reminder_planning_v2:he"]),
    });
    expect(withPush.deliveries.find((delivery) => delivery.channel === "push")?.status).toBe(
      "queued",
    );
    expect(withPush.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      status: "suppressed",
      errorCode: "push_preferred_for_fallback_channel",
    });

    const withoutPush = materializeMessagePlan({
      ...base,
      eventType: "class_reminder_planning",
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "22/07/2026",
        class_time: "18:00",
        has_active_push_device: false,
      },
      preferences: { ...base.preferences, classReminders: true },
      approvedWhatsappVariants: new Set(["cc_class_reminder_planning_v2:he"]),
    });
    expect(withoutPush.deliveries.find((delivery) => delivery.channel === "whatsapp")?.status).toBe(
      "queued",
    );
  });

  test("keeps final reminders focused and never duplicates payment success on WhatsApp", () => {
    const finalReminder = materializeMessagePlan({
      ...base,
      eventType: "class_reminder_final",
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס",
        class_date: "22/07/2026",
        class_time: "18:00",
        instructor_name: "ירין",
      },
      preferences: { ...base.preferences, classReminders: true },
      approvedWhatsappVariants: new Set(["cc_class_reminder_final_v2:he"]),
    });
    expect(finalReminder.deliveries.map((delivery) => delivery.channel)).toEqual([
      "in_app",
      "whatsapp",
    ]);

    const ordinarySuccess = materializeMessagePlan({
      ...base,
      eventType: "payment_confirmed",
      variables: {
        member_name: "נועה",
        package_name: "מינוי חודשי",
        amount: "₪350",
        payment_was_failing: false,
      },
      preferences: { ...base.preferences, payments: true },
      approvedWhatsappVariants: new Set(["cc_payment_confirmed_v2:he"]),
    });
    expect(
      ordinarySuccess.deliveries.find((delivery) => delivery.channel === "whatsapp"),
    ).toBeUndefined();

    const recovered = materializeMessagePlan({
      ...base,
      eventType: "payment_confirmed",
      variables: {
        member_name: "נועה",
        package_name: "מינוי חודשי",
        amount: "₪350",
        payment_was_failing: true,
      },
      preferences: { ...base.preferences, payments: true },
      approvedWhatsappVariants: new Set(["cc_payment_confirmed_v2:he"]),
    });
    expect(
      recovered.deliveries.find((delivery) => delivery.channel === "whatsapp"),
    ).toBeUndefined();
  });

  test("keeps growth messaging push-first and unlocks WhatsApp only for qualified escalation", () => {
    const recommendationVariables = {
      member_name: "נועה",
      recommendation_summary: "פילאטיס ב-22/07/2026 בשעה 18:00 או יוגה ב-24/07/2026 בשעה 19:00",
      credits_remaining: 2,
    };
    const pushFirst = materializeMessagePlan({
      ...base,
      eventType: "class_recommendation",
      variables: recommendationVariables,
      preferences: { ...base.preferences, recommendations: true, marketing: true },
      approvedWhatsappVariants: new Set(["recommendation_branded_v2:he"]),
    });
    expect(pushFirst.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      status: "suppressed",
      errorCode: "push_first_recommendation",
    });

    const escalation = materializeMessagePlan({
      ...base,
      eventType: "class_recommendation",
      variables: { ...recommendationVariables, whatsapp_growth_escalation: true },
      preferences: { ...base.preferences, recommendations: true, marketing: true },
      approvedWhatsappVariants: new Set(["recommendation_branded_v2:he"]),
    });
    expect(escalation.deliveries.find((delivery) => delivery.channel === "whatsapp")?.status).toBe(
      "queued",
    );
  });

  test("separates the caring 21-day push from the consented 30-day WhatsApp return note", () => {
    const caring = materializeMessagePlan({
      ...base,
      eventType: "retention_reminder",
      variables: { member_name: "נועה", retention_stage: "caring_push" },
      preferences: { ...base.preferences, marketing: true },
      approvedWhatsappVariants: new Set(["retention_branded_v2:he"]),
    });
    expect(caring.deliveries.find((delivery) => delivery.channel === "push")?.status).toBe(
      "queued",
    );
    expect(caring.deliveries.find((delivery) => delivery.channel === "whatsapp")).toMatchObject({
      status: "suppressed",
      errorCode: "retention_whatsapp_not_due",
    });

    const personal = materializeMessagePlan({
      ...base,
      eventType: "retention_reminder",
      variables: { member_name: "נועה", retention_stage: "personal_whatsapp" },
      preferences: { ...base.preferences, marketing: true },
      approvedWhatsappVariants: new Set(["retention_branded_v2:he"]),
    });
    expect(personal.deliveries.find((delivery) => delivery.channel === "push")).toMatchObject({
      status: "suppressed",
      errorCode: "retention_personal_whatsapp_only",
    });
    expect(personal.deliveries.find((delivery) => delivery.channel === "whatsapp")?.status).toBe(
      "queued",
    );
  });
});
