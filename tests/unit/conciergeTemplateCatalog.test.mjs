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
      expect(template.components[0]).toMatchObject({
        type: "HEADER",
        format: "IMAGE",
      });
      expect(template.components.some((component) => component.type === "FOOTER")).toBe(true);
      const body = template.components.find((component) => component.type === "BODY");
      expect(body.text).toContain("{{1}}");
      expect(body.text).not.toContain("{{member_name}}");
    }
  });

  test("adds only the approved contextual URL buttons", () => {
    const actionableKeys = [
      "booking_confirmed_first",
      "booking_confirmed_repeat",
      "payment_requires_action",
      "payment_terminally_failed",
      "waitlist_offer",
      "recommendation",
    ];
    const informationalKeys = [
      "payment_one_time_succeeded",
      "payment_subscription_renewal_succeeded",
      "class_cancelled",
    ];

    for (const templateKey of actionableKeys) {
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
