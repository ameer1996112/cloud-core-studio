import { describe, expect, test } from "bun:test";
import {
  APP_MARKETING_CANONICAL_URL,
  APP_MARKETING_COPY,
  APP_MARKETING_LANGS,
  buildMarketingHref,
  buildAppMarketingStructuredData,
  getAppMarketingCopy,
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
    expect(resolveMarketingLocale({ accepted: "ar;q=0,he;q=0.4,en;q=0.9" })).toBe("en");
    expect(resolveMarketingLocale({ accepted: "he;q=0.2,en;q=0.8,ar;q=0.8" })).toBe("en");
    expect(resolveMarketingLocale({ accepted: "*;q=1,en;q=0.5" })).toBe("ar");
    expect(resolveMarketingLocale({ accepted: "*;q=0.9,ar;q=0,he;q=0.5,en;q=0" })).toBe("he");
    expect(resolveMarketingLocale({ accepted: "en;q=2,he;q=0.5" })).toBe("he");
    expect(resolveMarketingLocale({ accepted: "en;q=oops,he;q=0.5" })).toBe("he");
    expect(resolveMarketingLocale({ accepted: "en;q=-1,he;q=0" })).toBe("ar");
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
    expect(buildMarketingHref("/app/he#schedule", utm)).toBe(
      "/app/he?utm_source=instagram&utm_medium=social&utm_campaign=summer&utm_content=hero&utm_term=aerial&utm_id=42#schedule",
    );
  });

  test("trims UTM values, rejects blank values, and caps values at 200 characters", () => {
    const campaign = "x".repeat(240);
    const utm = sanitizeMarketingUtm(
      new URLSearchParams({
        utm_source: "  instagram  ",
        utm_medium: "   ",
        utm_campaign: ` ${campaign} `,
      }),
    );
    expect(utm.get("utm_source")).toBe("instagram");
    expect(utm.has("utm_medium")).toBe(false);
    expect(utm.get("utm_campaign")).toBe("x".repeat(200));
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
      { rel: "alternate", hrefLang: "ar", href: "https://cloudandcorestudio.com/app/ar" },
      { rel: "alternate", hrefLang: "he", href: "https://cloudandcorestudio.com/app/he" },
      { rel: "alternate", hrefLang: "en", href: "https://cloudandcorestudio.com/app/en" },
      { rel: "alternate", hrefLang: "x-default", href: "https://cloudandcorestudio.com/app/ar" },
    ]);
  });

  test("exposes exact localized conversion copy, benefits, services, screenshots and FAQ", () => {
    expect(APP_MARKETING_COPY.ar.hero).toMatchObject({
      eyebrow: "Cloud & Core Studio · حرفيش",
      title: "يوغا هوائية وبيلاتس بحرفيش — الحجز بسهولة من التطبيق",
      body: "شوفي جدول الحصص، اختاري الحصة المناسبة، احجزي مكانك وتابعي اشتراكك ورصيدك — كله بمكان واحد.",
      trust: "مناسب للمبتدئات · مجموعات صغيرة · اهتمام شخصي",
      offer: "",
      primaryCta: "شوفي الجدول واحجزي",
      memberCta: "عضوة بالاستوديو؟ سجّلي دخولك",
    });
    expect(APP_MARKETING_COPY.he.hero).toMatchObject({
      eyebrow: "Cloud & Core Studio · חורפיש",
      title: "יוגה אווירית ופילאטיס בחורפיש — הרשמה קלה דרך האפליקציה",
      body: "צפי בלוח השיעורים, בחרי את החוג שמתאים לך, הזמיני מקום ועקבי אחרי המנוי והקרדיטים — הכול במקום אחד.",
      trust: "מתאים למתחילות · קבוצות קטנות · יחס אישי",
      offer: "",
      primaryCta: "צפייה בלוח והרשמה",
      memberCta: "כבר חברה? כניסה לחשבון",
    });
    expect(APP_MARKETING_COPY.en.hero).toMatchObject({
      eyebrow: "Cloud & Core Studio · Hurfeish",
      title: "Aerial Yoga and Pilates in Hurfeish — Easy Booking Through the App",
      body: "View the schedule, choose your class, reserve your place, and track your membership and credits in one place.",
      trust: "Beginner friendly · Small groups · Personal attention",
      offer: "",
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

  test("renders canonical trial price only when supplied", () => {
    expect(getAppMarketingCopy("ar").hero.offer).toBe("");
    expect(getAppMarketingCopy("ar", null).faq[4][1]).not.toContain("₪");
    expect(getAppMarketingCopy("ar", 80).hero.offer).toBe("حصة تجريبية بـ80 ₪");
    expect(getAppMarketingCopy("he", 80).hero.offer).toBe("שיעור ניסיון ב־80 ₪");
    expect(getAppMarketingCopy("en", 80).hero.offer).toBe("Trial class for ₪80");
    expect(getAppMarketingCopy("en", 80).faq[4][1]).toContain("₪80");
  });

  test("matches every localized benefit, service, screenshot heading and FAQ answer", () => {
    const expected = {
      ar: {
        benefits: [
          ["جدول حصص محدّث", "شوفي الحصص الجاية، المواعيد والأماكن المتاحة."],
          ["حجز سهل للحصص", "اختاري الحصة المناسبة واحجزي مكانك بخطوات بسيطة."],
          ["إدارة الحجوزات", "تابعي الحجوزات الجاية واستعملي خيارات التعديل أو الإلغاء المتاحة."],
          ["متابعة الاشتراك", "شوفي تفاصيل الاشتراك ورصيد الحصص المتبقي."],
        ],
        services: [
          [
            "يوغا هوائية للنساء",
            "حصص يوغا هوائية للنساء والمبتدئات بحرفيش. مش لازم تكون عندك خبرة أو مرونة مسبقة — الحصص ضمن مجموعات صغيرة واهتمام شخصي.",
          ],
          [
            "يوغا هوائية للأطفال",
            "حصص يوغا هوائية للأطفال من عمر 7، ضمن مجموعات مناسبة للعمر وبإشراف شخصي في استوديو Cloud & Core بحرفيش.",
          ],
          [
            "بيلاتس فرشات",
            "تمارين بيلاتس فرشات لتقوية الجسم، تحسين الثبات والحركة، ضمن أجواء هادئة ومجموعة صغيرة.",
          ],
          [
            "HOT Pilates",
            "حصة ديناميكية ببيئة دافئة تجمع بين تمارين البيلاتس، القوة والحركة، بمستويات مناسبة للمشاركات.",
          ],
        ],
        headings: [
          "كل الجدول بمكان واحد",
          "احجزي حصتك بثواني",
          "كل حجوزاتك مرتّبة",
          "اشتراكك ورصيدك واضحين",
          "إدارة سهلة من أي مكان",
        ],
        faq: [
          [
            "هل اليوغا الهوائية مناسبة للمبتدئات؟",
            "نعم، الحصص مناسبة للمبتدئات ومش لازم تكون عندك خبرة مسبقة.",
          ],
          ["هل لازم أكون مرنة؟", "لا، مش لازم تكون عندك مرونة خاصة لتبلّشي."],
          ["شو لازم ألبس للحصة؟", "اختاري ملابس رياضية مريحة وتسمح بالحركة بحرية."],
          [
            "من أي عمر اليوغا الهوائية للأطفال؟",
            "مجموعات اليوغا الهوائية للأطفال مناسبة من عمر 7 سنوات.",
          ],
          ["كيف بحجز حصة تجريبية؟", "شوفي الجدول بالتطبيق، اختاري الحصة واحجزي مكانك."],
          ["وين موجود الاستوديو؟", "استوديو Cloud & Core موجود بحرفيش، الشارع الرئيسي 89."],
        ],
      },
      he: {
        benefits: [
          ["לוח שיעורים מעודכן", "צפי בשיעורים הקרובים, בשעות ובזמינות המקומות."],
          ["הרשמה קלה לשיעורים", "בחרי את השיעור שמתאים לך והזמיני מקום בכמה צעדים."],
          ["ניהול הזמנות", "עקבי אחרי ההזמנות הקרובות והשתמשי באפשרויות השינוי או הביטול הזמינות."],
          ["מעקב אחרי המנוי", "צפי בפרטי המנוי וביתרת הקרדיטים שנותרה."],
        ],
        services: [
          [
            "יוגה אווירית לנשים",
            "שיעורי יוגה אווירית לנשים ולמתחילות בחורפיש. אין צורך בניסיון קודם או בגמישות מיוחדת — השיעורים מתקיימים בקבוצות קטנות ועם יחס אישי.",
          ],
          [
            "יוגה אווירית לילדים",
            "שיעורי יוגה אווירית לילדים מגיל 7, בקבוצות מותאמות לגיל ובליווי אישי בסטודיו Cloud & Core בחורפיש.",
          ],
          [
            "פילאטיס מזרן",
            "אימוני פילאטיס מזרן לחיזוק הגוף, שיפור היציבה והתנועה, באווירה רגועה ובקבוצה קטנה.",
          ],
          [
            "HOT Pilates",
            "שיעור דינמי בחלל מחומם המשלב פילאטיס, כוח ותנועה, עם התאמות לרמות שונות.",
          ],
        ],
        headings: [
          "כל הלו״ז במקום אחד",
          "הרשמה לשיעור בשניות",
          "כל ההזמנות שלך מסודרות",
          "המנוי והקרדיטים תמיד ברורים",
          "ניהול פשוט מכל מקום",
        ],
        faq: [
          [
            "האם יוגה אווירית מתאימה למתחילות?",
            "כן. השיעורים מתאימים למתחילות ואין צורך בניסיון קודם.",
          ],
          ["האם צריך להיות גמישה?", "לא. אין צורך בגמישות מיוחדת כדי להתחיל."],
          ["מה צריך ללבוש לשיעור?", "כדאי לבחור בגדי אימון נוחים שמאפשרים תנועה חופשית."],
          [
            "מאיזה גיל אפשר להצטרף ליוגה אווירית לילדים?",
            "קבוצות יוגה אווירית לילדים מיועדות לילדים מגיל 7.",
          ],
          ["איך מזמינים שיעור ניסיון?", "צפי בלוח השיעורים באפליקציה, בחרי שיעור והזמיני מקום."],
          ["איפה נמצא הסטודיו?", "Cloud & Core Studio נמצא בחורפיש, בכביש הראשי 89."],
        ],
      },
      en: {
        benefits: [
          ["Live Class Schedule", "View upcoming classes, times, and availability."],
          ["Easy Class Booking", "Choose a class and reserve your place in a few steps."],
          [
            "Booking Management",
            "View upcoming bookings and use the available change or cancellation options.",
          ],
          ["Membership Tracking", "View membership details and remaining class credits."],
        ],
        services: [
          [
            "Aerial Yoga for Women",
            "Beginner-friendly aerial yoga classes for women in Hurfeish. No previous experience or exceptional flexibility is required.",
          ],
          [
            "Kids Aerial Yoga",
            "Aerial yoga classes for children aged 7 and above, with age-appropriate groups and personal guidance.",
          ],
          [
            "Mat Pilates",
            "Mat Pilates classes focused on strength, stability, posture, and controlled movement in a calm small-group setting.",
          ],
          [
            "HOT Pilates",
            "A dynamic class in a heated environment combining Pilates, strength, and movement with appropriate level adjustments.",
          ],
        ],
        headings: [
          "Your Schedule in One Place",
          "Book a Class in Seconds",
          "Keep Every Booking Organized",
          "Track Membership and Credits",
          "Manage Everything Anywhere",
        ],
        faq: [
          [
            "Is aerial yoga suitable for beginners?",
            "Yes. Classes are beginner-friendly, and no previous experience is required.",
          ],
          [
            "Do I need to be flexible?",
            "No. Exceptional flexibility is not required to get started.",
          ],
          [
            "What should I wear?",
            "Choose comfortable workout clothes that allow you to move freely.",
          ],
          [
            "What age can children join aerial yoga?",
            "Children’s aerial yoga groups are available from age 7.",
          ],
          [
            "How do I book a trial class?",
            "View the schedule in the app, choose a class, and reserve your place.",
          ],
          [
            "Where is the studio located?",
            "Cloud & Core Studio is located at Main Road 89 in Hurfeish.",
          ],
        ],
      },
    } as const;
    for (const lang of ["ar", "he", "en"] as const) {
      expect(getAppMarketingCopy(lang).features.items).toEqual(expected[lang].benefits);
      expect(
        getAppMarketingCopy(lang).classes.items.map((name, index) => [
          name,
          getAppMarketingCopy(lang).classes.descriptions[index],
        ]),
      ).toEqual(expected[lang].services);
      expect(getAppMarketingCopy(lang).screenshots.headings).toEqual(expected[lang].headings);
      expect(getAppMarketingCopy(lang).faq).toEqual(expected[lang].faq);
    }
  });

  test("emits verified HealthClub, application and visible FAQ JSON-LD without social proof", () => {
    const data = buildAppMarketingStructuredData({
      lang: "en",
      installUrl: "https://apps.apple.com/app/id6786035836",
      faqVisible: true,
      trialPrice: 80,
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
    expect(data["@graph"][0].address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Main Road 89",
      addressLocality: "Hurfeish",
      addressCountry: "IL",
      name: "Main Road 89, Hurfeish, Israel",
    });
    expect(data["@graph"][0].telephone).toBe("055-939-8438");
    expect(data["@graph"][0].email).toBe("cloudandcorestudio@gmail.com");
    expect(data["@graph"][0].availableLanguage).toEqual(["ar", "he", "en"]);
    expect(data["@graph"][0].makesOffer.map((offer) => offer.itemOffered.name)).toEqual([
      "Aerial Yoga for Women",
      "Kids Aerial Yoga",
      "Mat Pilates",
      "HOT Pilates",
    ]);
    expect(data["@graph"][0].sameAs).toEqual(["https://www.instagram.com/cloudandcorestudio/"]);
    expect(data["@graph"][1].installUrl).toBe("https://apps.apple.com/app/id6786035836");
    expect(data["@graph"][2].mainEntity).toHaveLength(6);
    expect(serialized).not.toMatch(/aggregateRating|review|openingHours|price/);
  });

  test("keeps JSON-LD safe when price or visible FAQ are unavailable", () => {
    const data = buildAppMarketingStructuredData({
      lang: "en",
      appStoreUrl: "https://apps.apple.com/il/app/cloud-core/id6786035836?campaign=legacy",
      trialPrice: null,
    });
    expect(data["@graph"].map((entry) => entry["@type"])).toEqual([
      "HealthClub",
      "SoftwareApplication",
    ]);
    expect(data["@graph"][1].installUrl).toBe("https://apps.apple.com/app/id6786035836");
    expect(JSON.stringify(data)).not.toContain("₪");
    expect(data["@graph"][1].image).toBe(
      "https://cloudandcorestudio.com/brand/cloud-core-app-icon.svg",
    );
  });

  test("uses exact final action, sign-in, and accessible App Store labels", () => {
    expect(APP_MARKETING_COPY.ar.headerAction).toBe("سجّلي دخولك");
    expect(APP_MARKETING_COPY.he.headerAction).toBe("כניסה לחשבון");
    expect(APP_MARKETING_COPY.en.headerAction).toBe("Sign In");
    for (const lang of ["ar", "he", "en"] as const) {
      expect(APP_MARKETING_COPY[lang].finalCta.body).toBe(
        lang === "ar"
          ? "افتحي Cloud & Core، شوفي الجدول واحجزي مكانك."
          : lang === "he"
            ? "פתחי את Cloud & Core, צפי בלו״ז והזמיני מקום."
            : "Open Cloud & Core, view the schedule, and reserve your place.",
      );
      expect(APP_MARKETING_COPY[lang].finalCta.actions).toEqual(
        lang === "ar"
          ? ["شوفي الجدول واحجزي", "حمّلي من App Store", "سجّلي دخولك"]
          : lang === "he"
            ? ["צפייה בלוח והרשמה", "הורדה מה־App Store", "כניסה לחשבון"]
            : ["View Schedule and Book", "Download on the App Store", "Sign In"],
      );
    }
    expect(APP_MARKETING_COPY.ar.storeAccessibleLabel).toBe(
      "حمّلي تطبيق Cloud & Core من App Store",
    );
    expect(APP_MARKETING_COPY.he.storeAccessibleLabel).toBe("הורדת Cloud & Core מה־App Store");
    expect(APP_MARKETING_COPY.en.storeAccessibleLabel).toBe(
      "Download Cloud & Core on the App Store",
    );
  });
});
