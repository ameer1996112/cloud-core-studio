import { describe, expect, test } from "bun:test";
import {
  META_TEMPLATE_CATALOG,
  getMetaTemplateVariant,
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
});
