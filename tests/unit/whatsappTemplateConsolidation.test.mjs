import { describe, expect, test } from "bun:test";
import {
  classifyLegacyTemplateRetirement,
  isConciergeMigratedEventType,
  resolveConsolidatedWhatsappTemplate,
} from "../../src/lib/whatsappTemplateConsolidation.ts";

describe("WhatsApp template consolidation", () => {
  test("preserves legacy-only reminders and human handoff", () => {
    expect(
      resolveConsolidatedWhatsappTemplate({
        eventType: "class_reminder_final",
        language: "he",
        variables: { member_name: "נועה" },
      }),
    ).toBeNull();
    expect(
      resolveConsolidatedWhatsappTemplate({
        eventType: "human_handoff",
        language: "he",
        variables: { member_name: "נועה" },
      }),
    ).toBeNull();
  });

  test("uses action-required messaging until a payment failure is explicitly terminal", () => {
    expect(
      resolveConsolidatedWhatsappTemplate({
        eventType: "payment_failed",
        language: "en",
        variables: { member_name: "Noa" },
      })?.name,
    ).toBe("payment_requires_action_branded_v2");
    expect(
      resolveConsolidatedWhatsappTemplate({
        eventType: "subscription_renewal_failed",
        language: "en",
        variables: { member_name: "Noa", payment_terminal: true },
      })?.name,
    ).toBe("payment_terminally_failed_branded_v2");
  });

  test("selects an approved premium booking card with deterministic event details", () => {
    const result = resolveConsolidatedWhatsappTemplate({
      eventType: "booking_confirmed",
      language: "he",
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס מזרן",
        class_date: "יום שישי, 24.07",
        class_time: "18:00",
        instructor_name: "ירין",
        location_name: "הסטודיו הראשי",
      },
      approvedWhatsappVariants: new Set(["booking_confirmed_repeat_premium_v3:he"]),
    });

    expect(result).toEqual({
      name: "booking_confirmed_repeat_premium_v3",
      metaLanguage: "he",
      components: [
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
          parameters: [
            { type: "text", text: "נועה" },
            {
              type: "text",
              text: "פילאטיס מזרן\nיום שישי, 24.07 · 18:00\nעם ירין · הסטודיו הראשי",
            },
          ],
        },
      ],
    });
  });

  test("keeps the approved v2 template active while premium v3 is pending", () => {
    const result = resolveConsolidatedWhatsappTemplate({
      eventType: "booking_confirmed",
      language: "he",
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס מזרן",
        class_date: "יום שישי, 24.07",
        class_time: "18:00",
      },
      approvedWhatsappVariants: new Set(["booking_confirmed_repeat_branded_v2:he"]),
    });

    expect(result?.name).toBe("booking_confirmed_repeat_branded_v2");
  });

  test.each([
    ["booking_confirmed", {}, "booking_confirmed_repeat_branded_v2"],
    ["booking_confirmed", { first_booking: true }, "booking_confirmed_first_branded_v2"],
    ["payment_confirmed", {}, "payment_one_time_succeeded_branded_v2"],
    [
      "payment_confirmed",
      { subscription_renewal: true },
      "payment_subscription_renewal_succeeded_branded_v2",
    ],
    ["subscription_renewal_succeeded", {}, "payment_subscription_renewal_succeeded_branded_v2"],
    ["payment_failed", {}, "payment_requires_action_branded_v2"],
    ["subscription_renewal_failed", {}, "payment_requires_action_branded_v2"],
    ["class_cancelled_by_admin", {}, "class_cancelled_branded_v2"],
    ["class_time_changed", {}, "class_time_changed_branded_v2"],
    ["class_recommendation", {}, "recommendation_branded_v2"],
    ["waitlist_spot_available", {}, "waitlist_offer_branded_v2"],
    ["retention_reminder", {}, "retention_branded_v2"],
  ])("maps %s to its required Concierge template", (eventType, variables, expectedName) => {
    expect(isConciergeMigratedEventType(eventType)).toBeTrue();
    expect(
      resolveConsolidatedWhatsappTemplate({
        eventType,
        language: "en",
        variables: { member_name: "Noa", ...variables },
      })?.name,
    ).toBe(expectedName);
  });

  test("requires seven complete zero-usage days before legacy retirement", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");

    expect(
      classifyLegacyTemplateRetirement({
        now,
        lastUsedAt: new Date("2026-08-03T11:59:59.000Z"),
        stillRequired: false,
      }),
    ).toEqual({ eligible: true, reason: "unused_for_seven_days" });
    expect(
      classifyLegacyTemplateRetirement({
        now,
        lastUsedAt: new Date("2026-08-03T12:00:01.000Z"),
        stillRequired: false,
      }),
    ).toEqual({ eligible: false, reason: "recent_usage" });
    expect(
      classifyLegacyTemplateRetirement({
        now,
        lastUsedAt: null,
        stillRequired: true,
      }),
    ).toEqual({ eligible: false, reason: "legacy_only_flow" });
  });
});
