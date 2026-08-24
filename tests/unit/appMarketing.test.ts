import { describe, expect, test } from "bun:test";
import {
  APP_MARKETING_CANONICAL_URL,
  APP_MARKETING_COPY,
  APP_MARKETING_LANGS,
  buildMarketingHref,
  buildAppMarketingStructuredData,
  getAppMarketingMeta,
  getAppMarketingAlternates,
  getAppMarketingScreenshots,
  parseAppMarketingSearch,
  resolveMarketingLocale,
  resolveAppMarketingLang,
  sanitizeMarketingUtm,
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
    expect(getAppMarketingMeta("en").title).toBe(
      "Cloud & Core | Aerial Yoga & Pilates in Hurfeish",
    );
    expect(getAppMarketingMeta("he").title).toBe("Cloud & Core | יוגה אווירית ופילאטיס בחורפיש");
    expect(getAppMarketingMeta("ar").title).toBe("Cloud & Core | يوغا هوائية وبيلاتس في حرفيش");
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
    expect(
      data["@graph"].find((entry) => entry["@type"] === "SoftwareApplication").downloadUrl,
    ).toContain("id6786035836");
    expect(data["@graph"][0]["@type"]).toBe("HealthClub");
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

  test("resolves explicit, saved, accepted language, then Arabic fallback", () => {
    expect(APP_MARKETING_LANGS).toEqual(["ar", "he", "en"]);
    expect(resolveMarketingLocale({ explicit: "he", saved: "en", accepted: ["ar"] })).toBe("he");
    expect(resolveMarketingLocale({ saved: "en", accepted: ["he", "ar"] })).toBe("en");
    expect(resolveMarketingLocale({ accepted: ["fr-FR", "he-IL"] })).toBe("he");
    expect(resolveMarketingLocale({ accepted: "en-US,en;q=0.9" })).toBe("en");
    expect(resolveMarketingLocale({ accepted: ["fr-FR"] })).toBe("ar");
  });

  test("sanitizes attribution parameters and builds a clean marketing href", () => {
    const utm = sanitizeMarketingUtm(
      "utm_source=instagram&utm_medium=social&utm_campaign=summer&utm_content=hero&utm_term=aerial&utm_id=42&email=private%40example.com&returnTo=%2Fmember&private=secret",
    );
    expect(Object.fromEntries(utm)).toEqual({
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "summer",
      utm_content: "hero",
      utm_term: "aerial",
      utm_id: "42",
    });
    expect(buildMarketingHref("/app/he", utm)).toBe(
      "/app/he?utm_source=instagram&utm_medium=social&utm_campaign=summer&utm_content=hero&utm_term=aerial&utm_id=42",
    );
  });

  test("uses self-referencing localized canonicals and reciprocal alternates", () => {
    expect(getAppMarketingMeta("ar")).toMatchObject({
      title: "Cloud & Core | يوغا هوائية وبيلاتس في حرفيش",
      description:
        "استوديو Cloud & Core في حرفيش لليوغا الهوائية، بيلاتس الفرشات و-HOT Pilates للنساء والأطفال. شوفي الجدول واحجزي من التطبيق.",
      canonical: "https://cloudandcorestudio.com/app/ar",
    });
    expect(getAppMarketingMeta("he")).toMatchObject({
      title: "Cloud & Core | יוגה אווירית ופילאטיס בחורפיש",
      description:
        "סטודיו Cloud & Core בחורפיש ליוגה אווירית, פילאטיס מזרן ו-HOT Pilates לנשים ולילדים. צפייה בלוח והרשמה דרך האפליקציה.",
      canonical: "https://cloudandcorestudio.com/app/he",
    });
    expect(getAppMarketingMeta("en")).toMatchObject({
      title: "Cloud & Core | Aerial Yoga & Pilates in Hurfeish",
      description:
        "Boutique aerial yoga, mat Pilates and HOT Pilates classes for women and children in Hurfeish. View the schedule and book through the Cloud & Core app.",
      canonical: "https://cloudandcorestudio.com/app/en",
    });
    expect(getAppMarketingAlternates("en")).toEqual([
      { hrefLang: "ar", href: "https://cloudandcorestudio.com/app/ar" },
      { hrefLang: "he", href: "https://cloudandcorestudio.com/app/he" },
      { hrefLang: "en", href: "https://cloudandcorestudio.com/app/en" },
      { hrefLang: "x-default", href: "https://cloudandcorestudio.com/app/ar" },
    ]);
  });

  test("exposes exact localized conversion copy, benefits, services, screenshots and FAQ", () => {
    expect(APP_MARKETING_COPY.ar.hero).toMatchObject({
      eyebrow: "Cloud & Core Studio · حرفيش",
      title: "يوغا هوائية وبيلاتس بحرفيش — الحجز بسهولة من التطبيق",
      body: "شوفي جدول الحصص، اختاري الحصة المناسبة، احجزي مكانك وتابعي اشتراكك ورصيدك — كله بمكان واحد.",
      trust: "مناسب للمبتدئات · مجموعات صغيرة · اهتمام شخصي",
      offer: "حصة تجريبية بـ80 ₪",
      primaryCta: "شوفي الجدول واحجزي",
      memberCta: "عضوة بالاستوديو؟ سجّلي دخولك",
    });
    expect(APP_MARKETING_COPY.he.hero).toMatchObject({
      eyebrow: "Cloud & Core Studio · חורפיש",
      title: "יוגה אווירית ופילאטיס בחורפיש — הרשמה קלה דרך האפליקציה",
      body: "צפי בלוח השיעורים, בחרי את החוג שמתאים לך, הזמיני מקום ועקבי אחרי המנוי והקרדיטים — הכול במקום אחד.",
      trust: "מתאים למתחילות · קבוצות קטנות · יחס אישי",
      offer: "שיעור ניסיון ב־80 ₪",
      primaryCta: "צפייה בלוח והרשמה",
      memberCta: "כבר חברה? כניסה לחשבון",
    });
    expect(APP_MARKETING_COPY.en.hero).toMatchObject({
      eyebrow: "Cloud & Core Studio · Hurfeish",
      title: "Aerial Yoga and Pilates in Hurfeish — Easy Booking Through the App",
      body: "View the schedule, choose your class, reserve your place, and track your membership and credits in one place.",
      trust: "Beginner friendly · Small groups · Personal attention",
      offer: "Trial class for ₪80",
      primaryCta: "View Schedule and Book",
      memberCta: "Already a member? Sign in",
    });
    for (const lang of ["ar", "he", "en"] as const) {
      expect(APP_MARKETING_COPY[lang].features.items).toHaveLength(4);
      expect(APP_MARKETING_COPY[lang].classes.items).toHaveLength(4);
      expect(APP_MARKETING_COPY[lang].faq).toHaveLength(6);
      expect(APP_MARKETING_COPY[lang].screenshots.headings).toHaveLength(5);
    }
    expect(APP_MARKETING_COPY.en.screenshots.headings).toEqual([
      "Your Schedule in One Place",
      "Book a Class in Seconds",
      "Keep Every Booking Organized",
      "Track Membership and Credits",
      "Manage Everything Anywhere",
    ]);
  });

  test("emits verified HealthClub, application and visible FAQ JSON-LD without social proof", () => {
    const data = buildAppMarketingStructuredData({
      lang: "en",
      installUrl: "https://apps.apple.com/app/id6786035836",
      profile: {
        address: "Main Road 89, Hurfeish, Israel",
        contactEmail: "cloudandcorestudio@gmail.com",
        instagramUrl: "https://www.instagram.com/cloudandcorestudio/",
        publicPhone: "055-939-8438",
        whatsappNumber: "+972559398438",
      },
    });
    const serialized = JSON.stringify(data);
    expect(data["@graph"].map((entry) => entry["@type"])).toEqual([
      "HealthClub",
      "SoftwareApplication",
      "FAQPage",
    ]);
    expect(data["@graph"][0].geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 33.016109,
      longitude: 35.349285,
    });
    expect(data["@graph"][1].installUrl).toBe("https://apps.apple.com/app/id6786035836");
    expect(data["@graph"][2].mainEntity).toHaveLength(6);
    expect(serialized).not.toMatch(/aggregateRating|review|openingHours|price/);
  });
});
