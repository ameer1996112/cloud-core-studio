import { describe, expect, test } from "bun:test";
import { buildConciergePresentation } from "../../src/lib/conciergePresentation.ts";

describe("Concierge branded presentation", () => {
  test("creates a localized booking action and facts", () => {
    const result = buildConciergePresentation({
      journeyType: "booking",
      templateKey: "booking_confirmed_first",
      locale: "he",
      subject: "השיעור הראשון שלך הוזמן",
      body: "היי נועה, ההזמנה אושרה.",
      variables: {
        booking_id: "b-1",
        class_name: "פילאטיס מזרן",
        class_date: "28/07/2026",
        class_time: "18:00",
      },
      publicBaseUrl: "https://cloudandcorestudio.com",
    });

    expect(result.key).toBe("booking_confirmed_first:email:v2");
    expect(result.categoryLabel).toBe("פרטי ההזמנה");
    expect(result.action).toEqual({
      label: "צפייה בהזמנה",
      url: "https://cloudandcorestudio.com/member/bookings",
    });
    expect(result.facts.map((fact) => fact.key)).toEqual([
      "class_name",
      "class_date",
      "class_time",
    ]);
  });

  test("omits an action when no safe destination applies", () => {
    const result = buildConciergePresentation({
      journeyType: "booking_cancellation",
      templateKey: "booking_cancelled",
      locale: "en",
      subject: "Cancellation confirmed",
      body: "Your cancellation is confirmed.",
      variables: {},
      publicBaseUrl: "https://cloudandcorestudio.com",
    });

    expect(result.action).toBeNull();
  });

  test("keeps all supported journeys localized and free of unresolved variables", () => {
    const journeyTypes = [
      "booking",
      "booking_cancellation",
      "class_change",
      "payment_outcome",
      "weekly_schedule",
      "retention",
      "waitlist",
      "lead_to_trial",
      "recommendation",
      "daily_briefing",
    ];

    for (const journeyType of journeyTypes) {
      for (const locale of ["he", "ar", "en"]) {
        const result = buildConciergePresentation({
          journeyType,
          templateKey:
            journeyType === "payment_outcome"
              ? "payment_requires_action"
              : `${journeyType}_message`,
          locale,
          subject: "Hello {{member_name}} {{missing_value}}",
          body: "Body for {{member_name}} {{missing_value}}",
          variables: { member_name: "Noa", unsafe_url: "javascript:alert(1)" },
          publicBaseUrl: "https://cloudandcorestudio.com/app/",
        });

        expect(JSON.stringify(result)).not.toMatch(/\{\{[^}]+\}\}/);
        expect(result.action?.url ?? "").not.toContain("javascript:");
        expect(result.version).toBe(2);
      }
    }
  });

  test("limits payment actions to messages that need member intervention", () => {
    for (const templateKey of [
      "payment_one_time_succeeded",
      "payment_subscription_renewal_succeeded",
      "payment_recovered",
    ]) {
      expect(
        buildConciergePresentation({
          journeyType: "payment_outcome",
          templateKey,
          locale: "en",
          subject: "Payment update",
          body: "Your payment update.",
          variables: {},
          publicBaseUrl: "https://cloudandcorestudio.com",
        }).action,
      ).toBeNull();
    }
  });
});
