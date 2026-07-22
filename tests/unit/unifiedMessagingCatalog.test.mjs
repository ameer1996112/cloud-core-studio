import { describe, expect, test } from "bun:test";
import {
  META_TEMPLATE_CATALOG,
  MESSAGE_CONTENT_CATALOG,
  getMetaTemplateVariant,
  renderMessageContent,
  validateMessageContentCatalog,
  validateMetaTemplateCatalog,
} from "../../src/lib/messageTemplateCatalog.ts";
import { NOTIFICATION_EVENT_CATALOG } from "../../src/lib/premiumNotificationCatalog.ts";

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
      body: "נועה, נשארו 3 מקומות בפילאטיס מזרן ב-22/07/2026 בשעה 18:00. כל הפרטים והאפשרויות מחכים לך באפליקציה.",
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

  test("renders one premium recommendation containing up to two ranked lessons", () => {
    expect(
      renderMessageContent("class_recommendation", "en", {
        member_name: "Noa",
        recommendation_summary: "Mat Pilates on 22/07/2026 at 18:00 or Yoga on 24/07/2026 at 19:00",
      }).body,
    ).toContain("Mat Pilates on 22/07/2026 at 18:00 or Yoga on 24/07/2026 at 19:00");
  });

  test("has localized content for every premium event and templates for every WhatsApp route", () => {
    expect(Object.keys(MESSAGE_CONTENT_CATALOG).sort()).toEqual(
      Object.keys(NOTIFICATION_EVENT_CATALOG).sort(),
    );
    for (const [eventType, definition] of Object.entries(NOTIFICATION_EVENT_CATALOG)) {
      if (!definition.channels.includes("whatsapp")) continue;
      const variants = META_TEMPLATE_CATALOG.filter((variant) => variant.eventType === eventType);
      expect(variants.map((variant) => variant.language).sort()).toEqual(["ar", "en", "he"]);
    }
  });

  test("renders the one-time member welcome in every supported language", () => {
    expect(renderMessageContent("member_welcome", "he", { member_name: "נועה" })).toMatchObject({
      subject: "ברוכה הבאה ל-Cloud & Core",
      metaTemplate: "cc_member_welcome_v2",
    });
    expect(renderMessageContent("member_welcome", "ar", { member_name: "نور" }).subject).toBe(
      "أهلاً بك في Cloud & Core",
    );
    expect(renderMessageContent("member_welcome", "en", { member_name: "Noa" }).subject).toBe(
      "Welcome to Cloud & Core",
    );
    expect(getMetaTemplateVariant("member_welcome", "he")).toMatchObject({
      name: "cc_member_welcome_v2",
      category: "UTILITY",
    });
  });

  test("class recommendations and personal return messages are explicit marketing templates", () => {
    for (const eventType of ["class_recommendation", "retention_reminder"]) {
      const variants = META_TEMPLATE_CATALOG.filter((variant) => variant.eventType === eventType);
      expect(variants.map((variant) => variant.language).sort()).toEqual(["ar", "en", "he"]);
      expect(variants.every((variant) => variant.category === "MARKETING")).toBe(true);
    }
  });
});
