import { describe, expect, test } from "bun:test";
import {
  META_TEMPLATE_CATALOG,
  getMetaTemplateVariant,
  renderMessageContent,
  validateMessageContentCatalog,
  validateMetaTemplateCatalog,
} from "../../src/lib/messageTemplateCatalog.ts";

describe("unified messaging template catalog", () => {
  test("uses one versioned semantic template name across every supported language", () => {
    expect(validateMessageContentCatalog()).toEqual({ ok: true, errors: [] });
    expect(validateMetaTemplateCatalog()).toEqual({ ok: true, errors: [] });

    const variants = META_TEMPLATE_CATALOG.filter(
      (variant) => variant.eventType === "booking_confirmed",
    );
    expect(variants.map((variant) => variant.language).sort()).toEqual(["ar", "en", "he"]);
    expect(new Set(variants.map((variant) => variant.name))).toEqual(
      new Set(["cc_booking_confirmed_v2"]),
    );
    expect(new Set(variants.map((variant) => variant.parameters.join(",")))).toEqual(
      new Set(["member_name,class_name,class_date,class_time,instructor_name"]),
    );
    expect(getMetaTemplateVariant("booking_confirmed", "en")?.metaLanguage).toBe("en_US");
    expect(META_TEMPLATE_CATALOG.every((variant) => !/^\s*\{\{\d+\}\}/.test(variant.body))).toBe(
      true,
    );
    expect(
      META_TEMPLATE_CATALOG.every(
        (variant) => !/\{\{\d+\}\}\s*[.!?,:؛،؟。、]*\s*$/.test(variant.body),
      ),
    ).toBe(true);
  });

  test("renders localized open-class push copy without creating a WhatsApp template", () => {
    const variables = {
      member_name: "נועה",
      class_name: "פילאטיס מזרן",
      class_date: "22/07/2026",
      class_time: "18:00",
      spots_available: "3",
    };

    expect(renderMessageContent("class_open_spots", "he", variables)).toMatchObject({
      subject: "נשארו מקומות בשיעור",
      body: "נועה, נשארו 3 מקומות בפילאטיס מזרן ב-22/07/2026 בשעה 18:00. אפשר להירשם עכשיו באפליקציה.",
      metaTemplate: null,
    });
    expect(renderMessageContent("class_open_spots", "ar", variables).subject).toBe(
      "أماكن متاحة في الحصة",
    );
    expect(renderMessageContent("class_open_spots", "en", variables).subject).toBe(
      "Open spots in class",
    );
    expect(getMetaTemplateVariant("class_open_spots", "he")).toBeUndefined();
  });
});
