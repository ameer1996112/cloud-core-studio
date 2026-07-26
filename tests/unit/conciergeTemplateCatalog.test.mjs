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
  payment_outcome: ["in_app", "push", "email"],
  retention: ["in_app", "push", "whatsapp"],
  waitlist_offer: ["in_app", "push", "whatsapp"],
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
    expect(CONCIERGE_META_TEMPLATE_CATALOG).toHaveLength(18);
    for (const template of CONCIERGE_META_TEMPLATE_CATALOG) {
      expect(template.category).toBe(template.name === "retention" ? "MARKETING" : "UTILITY");
      expect(template.components[0].text).toContain("{{1}}");
      expect(template.components[0].text).not.toContain("{{member_name}}");
    }
  });
});
