import { describe, expect, test } from "bun:test";
import {
  APP_MARKETING_CANONICAL_URL,
  APP_MARKETING_COPY,
  buildAppMarketingStructuredData,
  getAppMarketingMeta,
  getAppMarketingScreenshots,
  parseAppMarketingSearch,
  resolveAppMarketingLang,
} from "../../src/lib/app-marketing";

describe("app marketing contracts", () => {
  test("accepts only supported explicit languages", () => {
    expect(parseAppMarketingSearch({ lang: "he" })).toEqual({ lang: "he" });
    expect(parseAppMarketingSearch({ lang: "ar" })).toEqual({ lang: "ar" });
    expect(parseAppMarketingSearch({ lang: "en" })).toEqual({ lang: "en" });
    expect(parseAppMarketingSearch({ lang: "fr" })).toEqual({});
    expect(parseAppMarketingSearch({ lang: ["en"] })).toEqual({});
  });

  test("explicit language wins over the saved preference", () => {
    expect(resolveAppMarketingLang("en", "he")).toBe("en");
    expect(resolveAppMarketingLang("ar", "en")).toBe("ar");
    expect(resolveAppMarketingLang(undefined, "he")).toBe("he");
  });

  test("provides five matching localized captures", () => {
    for (const lang of ["he", "ar", "en"] as const) {
      const images = getAppMarketingScreenshots(lang);
      expect(images).toHaveLength(5);
      expect(images.map((image) => image.kind)).toEqual([
        "schedule",
        "booking",
        "bookings",
        "membership",
        "account",
      ]);
      expect(images.every((image) => image.src.includes(`/app-marketing/${lang}/`))).toBe(true);
      expect(images.every((image) => image.width === 390 && image.height === 844)).toBe(true);
      expect(images.every((image) => image.alt.length > 12)).toBe(true);
    }
  });

  test("emits the required localized SEO values", () => {
    expect(getAppMarketingMeta("en").title).toBe("Cloud & Core App | Aerial Yoga & Pilates");
    expect(getAppMarketingMeta("he").title).toBe("אפליקציית Cloud & Core | יוגה אווירית ופילאטיס");
    expect(getAppMarketingMeta("ar").title).toBe("تطبيق Cloud & Core | يوغا هوائية وبيلاتس");
    expect(APP_MARKETING_CANONICAL_URL).toBe("https://cloudandcorestudio.com/app");
  });

  test("structured data contains verified application facts and no social proof", () => {
    const data = buildAppMarketingStructuredData({
      lang: "en",
      appStoreUrl: "https://apps.apple.com/il/app/cloud-core/id6786035836",
      profile: {
        address: "Main Road 89, Hurfeish, Israel",
        contactEmail: "cloudandcorestudio@gmail.com",
        instagramUrl: "https://www.instagram.com/cloudandcorestudio/",
        publicPhone: "055-939-8438",
        whatsappNumber: "+972559398438",
      },
    });

    const serialized = JSON.stringify(data);
    expect(data["@graph"][0]["@type"]).toBe("SoftwareApplication");
    expect(data["@graph"][0].downloadUrl).toContain("id6786035836");
    expect(data["@graph"][1]["@type"]).toBe("HealthAndBeautyBusiness");
    expect(serialized).not.toContain("aggregateRating");
    expect(serialized).not.toContain("review");
    expect(serialized).not.toContain("price");
    expect(serialized).not.toContain("downloadCount");
  });

  test("contains every required page section in all languages", () => {
    for (const lang of ["he", "ar", "en"] as const) {
      const copy = APP_MARKETING_COPY[lang];
      expect(copy.hero.title).toBeTruthy();
      expect(copy.features.items).toHaveLength(4);
      expect(copy.classes.items).toHaveLength(4);
      expect(copy.steps.items).toHaveLength(3);
      expect(copy.finalCta.title).toBeTruthy();
    }
  });
});
