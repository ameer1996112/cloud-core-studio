import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildConciergePresentation,
  buildConciergeWhatsappPresentation,
} from "../../src/lib/conciergePresentation.ts";

describe("Concierge branded presentation", () => {
  test("builds a premium Hebrew booking card from essential event details", () => {
    const result = buildConciergeWhatsappPresentation({
      templateKey: "booking_confirmed_repeat",
      locale: "he",
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס מזרן",
        class_date: "יום שישי, 24.07",
        class_time: "18:00",
        instructor_name: "ירין",
        location_name: "הסטודיו הראשי",
      },
    });

    expect(result).toEqual({
      key: "booking_confirmed_repeat:whatsapp:v3",
      version: 3,
      templateKey: "booking_confirmed_repeat",
      locale: "he",
      providerTemplateName: "booking_confirmed_repeat_premium_v3",
      requiredVariables: [
        "member_name",
        "class_name",
        "class_date",
        "class_time",
      ],
      optionalVariables: ["instructor_name", "location_name"],
      bodyTemplate:
        "היי {{1}}, המקום שלך נשמר 🤍\n\n{{2}}\n\nהכול מוכן לקראת השיעור.\nירין | Cloud & Core",
      orderedParameters: ["member_name", "details_block"],
      parameters: [
        "נועה",
        "פילאטיס מזרן\nיום שישי, 24.07 · 18:00\nעם ירין · הסטודיו הראשי",
      ],
      action: {
        label: "צפייה בהזמנה",
        url: "https://cloudandcorestudio.com/member/bookings",
      },
    });
  });

  test.each([
    ["he", "ירין | Cloud & Core"],
    ["ar", "يارين | Cloud & Core"],
    ["en", "Yareen | Cloud & Core"],
  ])("uses a native boutique-concierge signature in %s", (locale, signature) => {
    const result = buildConciergeWhatsappPresentation({
      templateKey: "booking_confirmed_repeat",
      locale,
      variables: {
        member_name: "Noa",
        class_name: "Mat Pilates",
        class_date: "24.07",
        class_time: "18:00",
      },
    });

    expect(result.bodyTemplate).toContain(signature);
    expect(result.bodyTemplate.match(/\p{Extended_Pictographic}/gu) ?? []).toHaveLength(1);
  });

  test("uses calm, relevant details for a cancelled class", () => {
    const result = buildConciergeWhatsappPresentation({
      templateKey: "class_cancelled",
      locale: "he",
      variables: {
        member_name: "נועה",
        class_name: "פילאטיס מזרן",
        class_date: "יום שישי, 24.07",
        class_time: "18:00",
        location_name: "הסטודיו הראשי",
      },
    });

    expect(result.bodyTemplate).toBe(
      "היי {{1}}, עדכון חשוב לגבי השיעור שלך:\n\n{{2}}\n\nהשיעור לא יתקיים הפעם. אשמח לעזור לך למצוא חלופה.\nירין | Cloud & Core",
    );
    expect(result.parameters[1]).toBe(
      "פילאטיס מזרן\nיום שישי, 24.07 · 18:00\nהסטודיו הראשי",
    );
    expect(result.action?.url).toBe("https://cloudandcorestudio.com/member/schedule");
  });

  test("shows only the useful payment next step", () => {
    const result = buildConciergeWhatsappPresentation({
      templateKey: "payment_requires_action",
      locale: "en",
      variables: {
        member_name: "Noa",
        package_name: "Monthly membership",
        amount: "₪350",
        renewal_date: "31.07.2026",
      },
    });

    expect(result.parameters[1]).toBe(
      "Monthly membership\n₪350 · Renewal 31.07.2026",
    );
    expect(result.bodyTemplate).toContain("I’m here if you need help.");
    expect(result.action?.label).toBe("Review payment");
  });

  test("keeps a waitlist offer concise and deadline-led", () => {
    const result = buildConciergeWhatsappPresentation({
      templateKey: "waitlist_offer",
      locale: "ar",
      variables: {
        member_name: "نور",
        class_name: "بيلاتس مات",
        class_date: "24.07.2026",
        class_time: "18:00",
        offer_expires_at: "18:30",
      },
    });

    expect(result.parameters[1]).toBe(
      "بيلاتس مات\n24.07.2026 · 18:00\nمحفوظ حتى 18:30",
    );
    expect(result.bodyTemplate).toContain("يارين | Cloud & Core");
    expect(result.action?.label).toBe("حجز المكان");
  });

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

  test("keeps class changes relevant and links to the schedule", () => {
    const result = buildConciergePresentation({
      journeyType: "class_change",
      templateKey: "class_cancelled",
      locale: "he",
      subject: "השיעור בוטל",
      body: "לצערנו השיעור בוטל.",
      variables: {
        class_name: "פילאטיס מזרן",
        class_date: "28/07/2026",
        class_time: "18:00",
        instructor_name: "ירין",
        location_name: "הסטודיו הראשי",
        package_name: "מנוי חודשי",
        amount: "₪350",
        receipt_number: "CC-1001",
        credits_remaining: "2",
        waitlist_position: "3",
      },
      publicBaseUrl: "https://cloudandcorestudio.com",
    });

    expect(result.facts.map((fact) => fact.key)).toEqual([
      "class_name",
      "class_date",
      "class_time",
      "instructor_name",
      "location_name",
    ]);
    expect(result.action).toEqual({
      label: "צפייה בלוח השיעורים",
      url: "https://cloudandcorestudio.com/member/schedule",
    });
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

test("keeps non-WhatsApp overload replays WABA-neutral and WhatsApp replays WABA-bound", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260727120000_concierge_branded_presentation_evidence.sql",
      import.meta.url,
    ),
    "utf8",
  );
  expect(migration).toContain("THEN NULLIF(p_whatsapp_waba_id,'') ELSE NULL END");
  expect(migration).toContain("'whatsapp_waba_id', v_canonical_whatsapp_waba_id");
  expect(migration).toContain("whatsapp_waba_resolution_ambiguous");
});
