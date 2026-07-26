import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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

    expect(
      buildConciergePresentation({
        journeyType: "payment_outcome",
        templateKey: "payment_terminally_failed",
        locale: "en",
        subject: "Payment failed",
        body: "Please review {{member.name}} {{missing-value}}.",
        variables: {},
        publicBaseUrl: "https://cloudandcorestudio.com",
      }),
    ).toMatchObject({
      body: "Please review  .",
      action: {
        label: "Review payment",
        url: "https://cloudandcorestudio.com/member/packages",
      },
    });

    expect(
      buildConciergePresentation({
        journeyType: "payment_outcome",
        templateKey: "payment_requires_action",
        locale: "he",
        subject: "Payment action required",
        body: "Review payment.",
        variables: {},
        publicBaseUrl: "https://cloudandcorestudio.com/app/",
      }).action,
    ).toEqual({
      label: "בדיקת התשלום",
      url: "https://cloudandcorestudio.com/member/packages",
    });
  });
});

test("keeps every registry action path represented in the materialization evidence contract", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260727120000_concierge_branded_presentation_evidence.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const actionCases = [
    ["booking", "booking_confirmed_repeat"],
    ["payment_outcome", "payment_requires_action"],
    ["weekly_schedule", "weekly_schedule"],
    ["waitlist", "waitlist_offer"],
    ["recommendation", "recommendation"],
  ];

  for (const [journeyType, templateKey] of actionCases) {
    const presentation = buildConciergePresentation({
      journeyType,
      templateKey,
      locale: "en",
      subject: "Subject",
      body: "Body",
      variables: {},
      publicBaseUrl: "https://cloudandcorestudio.com",
    });
    expect(presentation.action?.url).toBeTruthy();
    expect(migration).toContain(`'${templateKey}' THEN '${presentation.action?.url}'`);
  }
});
