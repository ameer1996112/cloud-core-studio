import { describe, expect, test } from "bun:test";
import {
  CONCIERGE_META_TEMPLATE_CATALOG,
  CONCIERGE_TEMPLATE_CATALOG,
  validateConciergeTemplateCatalog,
} from "../../src/lib/conciergeTemplateCatalog.ts";

const EXPECTED_CHANNELS = {
  booking_confirmed_first: ["in_app", "push", "whatsapp"],
  booking_confirmed_repeat: ["in_app", "push", "whatsapp"],
  booking_cancelled: ["in_app"],
  class_cancelled: ["in_app", "push", "email", "whatsapp"],
  class_time_changed: ["in_app", "push", "email", "whatsapp"],
  weekly_schedule: ["in_app", "push"],
  payment_one_time_succeeded: ["in_app", "push", "email", "whatsapp"],
  payment_subscription_renewal_succeeded: ["in_app", "push", "email", "whatsapp"],
  payment_requires_action: ["in_app", "push", "email", "whatsapp"],
  payment_terminally_failed: ["in_app", "push", "email", "whatsapp"],
  payment_recovered: ["in_app"],
  retention: ["in_app", "push", "whatsapp"],
  waitlist_offer: ["in_app", "push", "whatsapp"],
  lead_to_trial: ["in_app", "push", "email"],
  recommendation: ["in_app", "push", "whatsapp"],
  daily_briefing: ["in_app", "push"],
};

const EXPECTED_ACTIONS = {
  booking_confirmed_first: {
    url: "https://cloudandcorestudio.com/member/bookings",
    labels: { he: "צפייה בהזמנה", ar: "عرض الحجز", en_US: "View booking" },
  },
  booking_confirmed_repeat: {
    url: "https://cloudandcorestudio.com/member/bookings",
    labels: { he: "צפייה בהזמנה", ar: "عرض الحجز", en_US: "View booking" },
  },
  payment_requires_action: {
    url: "https://cloudandcorestudio.com/member/packages",
    labels: { he: "בדיקת התשלום", ar: "مراجعة الدفع", en_US: "Review payment" },
  },
  payment_terminally_failed: {
    url: "https://cloudandcorestudio.com/member/packages",
    labels: { he: "בדיקת התשלום", ar: "مراجعة الدفع", en_US: "Review payment" },
  },
  waitlist_offer: {
    url: "https://cloudandcorestudio.com/member/schedule",
    labels: { he: "מימוש המקום", ar: "حجز المكان", en_US: "Claim spot" },
  },
  recommendation: {
    url: "https://cloudandcorestudio.com/member/schedule",
    labels: { he: "צפייה בהמלצה", ar: "عرض التوصية", en_US: "View recommendation" },
  },
};

describe("Concierge template catalog", () => {
  test("covers every dispatchable journey, channel, and locale", () => {
    expect(validateConciergeTemplateCatalog()).toEqual({ ok: true, errors: [] });

    for (const [templateKey, channels] of Object.entries(EXPECTED_CHANNELS)) {
      for (const channel of channels) {
        for (const locale of ["en", "he", "ar"]) {
          expect(
            CONCIERGE_TEMPLATE_CATALOG.some(
              (template) =>
                template.templateKey === templateKey &&
                template.channel === channel &&
                template.locale === locale,
            ),
          ).toBe(true);
        }
      }
    }
  });

  test("uses only runtime-supported variables and contains no unresolved placeholders", () => {
    for (const template of CONCIERGE_TEMPLATE_CATALOG) {
      expect(template.requiredVariables).toEqual(["member_name"]);
      expect(`${template.subjectTemplate ?? ""}${template.bodyTemplate}`).not.toContain(
        "undefined",
      );
      expect(template.bodyTemplate).toContain("{{member_name}}");
    }
  });

  test("provides one Meta WhatsApp template for every localized WhatsApp variant", () => {
    const whatsapp = CONCIERGE_TEMPLATE_CATALOG.filter(
      (template) => template.channel === "whatsapp",
    );
    expect(CONCIERGE_META_TEMPLATE_CATALOG).toHaveLength(whatsapp.length);
    expect(CONCIERGE_META_TEMPLATE_CATALOG).toHaveLength(33);
    for (const template of CONCIERGE_META_TEMPLATE_CATALOG) {
      expect(template.name).toEndWith("_branded_v2");
      const templateKey = template.name.replace(/_branded_v2$/, "");
      const action = EXPECTED_ACTIONS[templateKey];
      expect(template.components.map((component) => component.type)).toEqual(
        action ? ["HEADER", "BODY", "FOOTER", "BUTTONS"] : ["HEADER", "BODY", "FOOTER"],
      );
      expect(template.components[0]).toEqual({
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: ["https://cloudandcorestudio.com/brand/concierge-whatsapp-header.webp"],
        },
      });
      expect(template.components[2]).toEqual({
        type: "FOOTER",
        text: "Cloud & Core Studio",
      });
      const body = template.components.find((component) => component.type === "BODY");
      expect(body.text).toContain("{{1}}");
      expect(body.text).not.toContain("{{member_name}}");
      if (action) {
        expect(template.components[3]).toEqual({
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: action.labels[template.language],
              url: action.url,
            },
          ],
        });
      }
    }
  });

  test("adds only the approved contextual URL buttons", () => {
    const informationalKeys = [
      "payment_one_time_succeeded",
      "payment_subscription_renewal_succeeded",
      "class_cancelled",
    ];

    for (const templateKey of Object.keys(EXPECTED_ACTIONS)) {
      const variants = CONCIERGE_META_TEMPLATE_CATALOG.filter((template) =>
        template.name.startsWith(`${templateKey}_branded_v2`),
      );
      expect(variants).toHaveLength(3);
      for (const template of variants) {
        expect(
          template.components
            .find((component) => component.type === "BUTTONS")
            ?.buttons.some((button) => button.type === "URL"),
        ).toBe(true);
      }
    }

    for (const templateKey of informationalKeys) {
      const variants = CONCIERGE_META_TEMPLATE_CATALOG.filter((template) =>
        template.name.startsWith(`${templateKey}_branded_v2`),
      );
      expect(variants).toHaveLength(3);
      for (const template of variants) {
        expect(template.components.some((component) => component.type === "BUTTONS")).toBe(false);
      }
    }
  });
});
