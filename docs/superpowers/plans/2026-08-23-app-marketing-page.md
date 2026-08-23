# Cloud & Core App Marketing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an indexable, production-ready, multilingual public marketing page at `/app` for the existing Cloud & Core iOS application.

**Architecture:** Add a top-level TanStack Start route that owns URL-language resolution, localized head metadata, and public studio/App Store loader data. Keep page copy and pure metadata/structured-data helpers in one focused library module, render the sections through one focused marketing component, and isolate its styling in a route-specific stylesheet. Reuse the existing global language store, public studio loader, official brand assets, verified App Store configuration, and approved localized screenshots without changing authentication or authorization.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Tailwind CSS v4, route-scoped CSS, Bun tests, Playwright browser checks, existing Cloud Run SSR server.

**Spec:** `docs/superpowers/specs/2026-08-23-app-marketing-page-design.md`

## Global Constraints

- `/app` must be a top-level public route and must never import or call an authentication guard.
- Supported URL languages are exactly `he`, `ar`, and `en`; Hebrew and Arabic are RTL, English is LTR.
- A valid explicit `?lang=` overrides the saved preference; otherwise preserve the existing cookie/local-storage preference and Hebrew fallback.
- Reuse the existing TanStack Start, Router, localization store, Tailwind/CSS design system, Cloud Run server, and test setup.
- Use only the official logo, real Cloud & Core photography, approved current app captures, and Apple-provided App Store badge artwork.
- Do not add prices, testimonials, reviews, ratings, download counts, awards, aggregate-rating data, a new analytics provider, or a large dependency.
- Primary app/open actions go to `/auth`; legal/support actions go to `/support`, `/privacy`, and `/terms`.
- The App Store destination comes from `getDownloadConfig()` and defaults to `https://apps.apple.com/il/app/cloud-core/id6786035836`.
- The canonical URL is exactly `https://cloudandcorestudio.com/app`.
- Page styles must not be appended to the currently modified `src/styles.css`; use a focused stylesheet.
- Do not alter authentication, member, instructor, admin, booking, payment, or account authorization behavior.
- Do not deploy or change the App Store listing.

## File Structure

- Create `src/lib/app-marketing.ts` — localized page copy, search parsing, screenshot mappings, localized metadata, and JSON-LD builders. All exported helpers are pure and unit-testable.
- Create `src/components/app-marketing/AppMarketingPage.tsx` — semantic presentation, language selector, CTAs, screenshot gallery, business contact rendering, and section composition.
- Create `src/components/app-marketing/app-marketing.css` — all `/app` layout, responsive, focus, direction, and reduced-motion styles.
- Create `src/routes/app.tsx` — public route registration, loader, localized head definition, URL language synchronization, and page component wiring.
- Modify `src/routes/__root.tsx` — allow a valid `/app?lang=` to determine the SSR `<html lang dir>` value without touching session or route-guard behavior.
- Modify `src/lib/i18n.ts` — let the existing boot script prioritize a valid `/app?lang=` before the saved cookie to prevent a direction flash.
- Create `public/images/app-marketing/{he,ar,en}/...` — stable approved localized app captures.
- Create `public/brand/app-store-badges/{he,ar,en}.svg` — unmodified Apple-provided preferred black badges.
- Create `tests/unit/appMarketing.test.ts` — pure content, language, metadata, image, and structured-data contracts.
- Create `tests/unit/appMarketingRoute.test.mjs` — public route, route links, loader source, and authentication-regression source contracts.
- Create `tests/e2e/app-marketing-playwright.py` — direct routing, language/direction, responsive overflow, CTA, metadata, and screenshot checks using the repository's existing Python Playwright convention.

---

### Task 1: Localized Content and Pure Marketing Contracts

**Files:**
- Create: `src/lib/app-marketing.ts`
- Create: `tests/unit/appMarketing.test.ts`

**Interfaces:**
- Consumes: `Lang`, `LANG_META`, and `DEFAULT_LOCALE` from `src/lib/i18n.ts`.
- Produces: `AppMarketingSearch`, `AppMarketingCopy`, `AppMarketingMeta`, `AppMarketingPublicProfile`, `APP_MARKETING_CANONICAL_URL`, `APP_MARKETING_COPY`, `APP_STORE_BADGE_PATHS`, `parseAppMarketingSearch(search)`, `resolveAppMarketingLang(explicitLang, savedLang)`, `getAppMarketingMeta(lang)`, `getAppMarketingScreenshots(lang)`, and `buildAppMarketingStructuredData(input)`.

- [ ] **Step 1: Write failing pure-contract tests**

Create `tests/unit/appMarketing.test.ts` with these contracts:

```ts
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
    expect(getAppMarketingMeta("en").title).toBe(
      "Cloud & Core App | Aerial Yoga & Pilates",
    );
    expect(getAppMarketingMeta("he").title).toBe(
      "אפליקציית Cloud & Core | יוגה אווירית ופילאטיס",
    );
    expect(getAppMarketingMeta("ar").title).toBe(
      "تطبيق Cloud & Core | يوغا هوائية وبيلاتس",
    );
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
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `bun test tests/unit/appMarketing.test.ts`

Expected: FAIL because `src/lib/app-marketing.ts` does not exist.

- [ ] **Step 3: Implement the types, parser, mappings, metadata, and structured-data builder**

Create `src/lib/app-marketing.ts` with these exact public contracts:

```ts
import { DEFAULT_LOCALE, type Lang } from "@/lib/i18n";

export const APP_MARKETING_CANONICAL_URL = "https://cloudandcorestudio.com/app";
export const APP_MARKETING_OG_IMAGE =
  "https://cloudandcorestudio.com/images/auth/cloud-core-auth-hero.webp";
export const APP_STORE_BADGE_PATHS: Record<Lang, string> = {
  he: "/brand/app-store-badges/he.svg",
  ar: "/brand/app-store-badges/ar.svg",
  en: "/brand/app-store-badges/en.svg",
};

export type AppMarketingSearch = { lang?: Lang };
export type AppMarketingPublicProfile = {
  address: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
  publicPhone: string | null;
  whatsappNumber: string | null;
};

export type AppMarketingCopy = {
  headerAction: string;
  hero: { eyebrow: string; title: string; body: string; primaryCta: string; storeCta: string };
  features: { eyebrow: string; title: string; items: [string, string][] };
  screenshots: { eyebrow: string; title: string };
  classes: { eyebrow: string; title: string; body: string; items: string[] };
  steps: { eyebrow: string; title: string; items: [string, string, string] };
  finalCta: { title: string; body: string };
  footer: { location: string; support: string; privacy: string; terms: string; signIn: string };
};

export type AppMarketingMeta = {
  title: string;
  description: string;
  locale: "he_IL" | "ar_AR" | "en_US";
};

export type AppMarketingScreenshot = {
  kind: "schedule" | "booking" | "bookings" | "membership" | "account";
  src: string;
  alt: string;
  width: 390;
  height: 844;
};

export function parseAppMarketingSearch(search: Record<string, unknown>): AppMarketingSearch {
  const lang = search.lang;
  return lang === "he" || lang === "ar" || lang === "en" ? { lang } : {};
}

export function resolveAppMarketingLang(
  explicitLang: unknown,
  savedLang: Lang = DEFAULT_LOCALE,
): Lang {
  return explicitLang === "he" || explicitLang === "ar" || explicitLang === "en"
    ? explicitLang
    : savedLang;
}
```

Define `AppMarketingCopy` so the component can render without conditional prose. Populate `APP_MARKETING_COPY` with these exact key messages:

```ts
export const APP_MARKETING_COPY: Record<Lang, AppMarketingCopy> = {
  he: {
    headerAction: "פתיחת האפליקציה",
    hero: {
      eyebrow: "האפליקציה של Cloud & Core",
      title: "כל השיעורים, ההזמנות והמנוי שלך במקום אחד.",
      body: "צפייה בלו״ז, הרשמה לשיעורים, ניהול הזמנות ומעקב אחרי המנוי — בקלות ובכל זמן.",
      primaryCta: "פתיחת האפליקציה",
      storeCta: "הורדה מ־App Store",
    },
    features: {
      eyebrow: "הכול קרוב",
      title: "הסטודיו שלך, בקצב שלך",
      items: [
        ["לוח שיעורים מעודכן", "לראות את השיעורים הקרובים ואת מספר המקומות הזמינים."],
        ["הרשמה קלה לשיעורים", "לבחור שיעור פנוי ולשמור מקום בכמה צעדים פשוטים."],
        ["ניהול הזמנות", "לצפות בהזמנות הקרובות ולהשתמש באפשרויות השינוי או הביטול הזמינות."],
        ["מעקב אחרי המנוי", "לראות את פרטי המנוי וכמה קרדיטים נשארו."],
      ],
    },
    screenshots: { eyebrow: "בתוך האפליקציה", title: "כל מה שצריך, ברור ונגיש" },
    classes: {
      eyebrow: "Cloud & Core בחורפיש",
      title: "תנועה, כוח ורוגע בקבוצות קטנות",
      body: "סטודיו בוטיק בחורפיש, עם קבוצות קטנות ויחס אישי בכל שיעור.",
      items: ["יוגה אווירית לנשים", "יוגה אווירית לילדים", "פילאטיס מזרן", "HOT Pilates"],
    },
    steps: {
      eyebrow: "פשוט להתחיל",
      title: "שלושה צעדים לשיעור הבא",
      items: ["פתחי חשבון", "בחרי שיעור", "אשרי את ההזמנה"],
    },
    finalCta: {
      title: "מוכנה לבחור את השיעור הבא שלך?",
      body: "פתחי את Cloud & Core, צפי בלו״ז והזמיני מקום.",
    },
    footer: { location: "חורפיש, צפון ישראל", support: "תמיכה", privacy: "פרטיות", terms: "תנאי שימוש", signIn: "פתיחת האפליקציה" },
  },
  ar: {
    headerAction: "افتحي التطبيق",
    hero: {
      eyebrow: "تطبيق Cloud & Core",
      title: "كل الحصص، الحجوزات والاشتراك بمكان واحد.",
      body: "شاهدي الجدول، احجزي الحصص، ديري حجوزاتك وتابعي اشتراكك بسهولة وبأي وقت.",
      primaryCta: "افتحي التطبيق",
      storeCta: "حمّلي من App Store",
    },
    features: {
      eyebrow: "كل شيء قريب",
      title: "الاستوديو معك، على إيقاعك",
      items: [
        ["جدول حصص محدّث", "شوفي الحصص الجاية والأماكن المتاحة بكل لحظة."],
        ["حجز سهل للحصص", "اختاري حصة متاحة وثبّتي مكانك بخطوات بسيطة."],
        ["إدارة الحجوزات", "راجعي حجوزاتك الجاية واستخدمي خيارات التعديل أو الإلغاء المتاحة."],
        ["متابعة الاشتراك", "شوفي تفاصيل اشتراكك وعدد أرصدة الحصص المتبقية."],
      ],
    },
    screenshots: { eyebrow: "داخل التطبيق", title: "كل اللي تحتاجيه، واضح وقريب" },
    classes: {
      eyebrow: "Cloud & Core في حرفيش",
      title: "حركة، قوة وهدوء بمجموعات صغيرة",
      body: "استوديو بوتيك بحرفيش، بمجموعات صغيرة واهتمام شخصي بكل حصة.",
      items: ["يوغا هوائية للنساء", "يوغا هوائية للأطفال", "بيلاتس فرشات", "HOT Pilates"],
    },
    steps: {
      eyebrow: "بسيط تبلّشي",
      title: "ثلاث خطوات لحصتك الجاية",
      items: ["افتحي حساب", "اختاري حصة", "أكّدي الحجز"],
    },
    finalCta: {
      title: "جاهزة تختاري حصتك الجاية؟",
      body: "افتحي Cloud & Core، شوفي الجدول واحجزي مكانك.",
    },
    footer: { location: "حرفيش، شمال إسرائيل", support: "الدعم", privacy: "الخصوصية", terms: "شروط الاستخدام", signIn: "افتحي التطبيق" },
  },
  en: {
    headerAction: "Open the app",
    hero: {
      eyebrow: "The Cloud & Core App",
      title: "Classes, bookings and membership in one place.",
      body: "View the schedule, reserve classes, manage bookings and track your membership with ease.",
      primaryCta: "Open the app",
      storeCta: "Download on the App Store",
    },
    features: {
      eyebrow: "Everything close",
      title: "Your studio, at your pace",
      items: [
        ["Live class schedule", "See upcoming classes and current availability."],
        ["Easy class booking", "Reserve an available class in a few simple steps."],
        ["Booking management", "Review upcoming bookings and use the available change or cancellation options."],
        ["Membership tracking", "View membership details and remaining class credits."],
      ],
    },
    screenshots: { eyebrow: "Inside the app", title: "Everything you need, clear and close" },
    classes: {
      eyebrow: "Cloud & Core in Hurfeish",
      title: "Movement, strength and calm in small groups",
      body: "A boutique studio in Hurfeish, with small groups and personal attention in every class.",
      items: ["Aerial Yoga for Women", "Kids Aerial Yoga", "Mat Pilates", "HOT Pilates"],
    },
    steps: {
      eyebrow: "Simple to begin",
      title: "Three steps to your next class",
      items: ["Create an account", "Choose a class", "Confirm your booking"],
    },
    finalCta: {
      title: "Ready to choose your next class?",
      body: "Open Cloud & Core, view the schedule and reserve your place.",
    },
    footer: { location: "Hurfeish, North Israel", support: "Support", privacy: "Privacy", terms: "Terms of Use", signIn: "Open the app" },
  },
};
```

Add screenshot mappings with paths `/images/app-marketing/{lang}/{schedule|booking|bookings|membership|account}.png`, `390×844` dimensions, and these exact alt texts in schedule, booking, bookings, membership, account order:

```ts
const SCREENSHOT_ALTS: Record<Lang, [string, string, string, string, string]> = {
  he: [
    "לוח השיעורים באפליקציית Cloud & Core",
    "פרטי שיעור והרשמה באפליקציית Cloud & Core",
    "ההזמנות הקרובות באפליקציית Cloud & Core",
    "המנוי והקרדיטים באפליקציית Cloud & Core",
    "מסך הפרופיל באפליקציית Cloud & Core",
  ],
  ar: [
    "جدول الحصص في تطبيق Cloud & Core",
    "تفاصيل الحصة والحجز في تطبيق Cloud & Core",
    "الحجوزات القادمة في تطبيق Cloud & Core",
    "الاشتراك وأرصدة الحصص في تطبيق Cloud & Core",
    "صفحة الملف الشخصي في تطبيق Cloud & Core",
  ],
  en: [
    "Class schedule in the Cloud & Core app",
    "Class details and booking in the Cloud & Core app",
    "Upcoming bookings in the Cloud & Core app",
    "Membership and class credits in the Cloud & Core app",
    "Profile screen in the Cloud & Core app",
  ],
};
```

Add `getAppMarketingMeta(lang)` backed by this exact record:

```ts
const APP_MARKETING_META: Record<Lang, AppMarketingMeta> = {
  he: {
    title: "אפליקציית Cloud & Core | יוגה אווירית ופילאטיס",
    description: "צפייה בלוח השיעורים של Cloud & Core, הרשמה ליוגה אווירית ופילאטיס, ניהול הזמנות ומעקב אחרי המנוי.",
    locale: "he_IL",
  },
  ar: {
    title: "تطبيق Cloud & Core | يوغا هوائية وبيلاتس",
    description: "شاهدي جدول Cloud & Core، احجزي اليوغا الهوائية والبيلاتس، ديري حجوزاتك وتابعي اشتراكك.",
    locale: "ar_AR",
  },
  en: {
    title: "Cloud & Core App | Aerial Yoga & Pilates",
    description: "View the Cloud & Core class schedule, book aerial yoga and Pilates sessions, manage reservations and track your membership.",
    locale: "en_US",
  },
};
```

Add `buildAppMarketingStructuredData({ lang, appStoreUrl, profile })` returning:

```ts
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${APP_MARKETING_CANONICAL_URL}#app`,
      name: lang === "he" ? "אפליקציית Cloud & Core" : lang === "ar" ? "تطبيق Cloud & Core" : "Cloud & Core App",
      description: getAppMarketingMeta(lang).description,
      applicationCategory: "HealthApplication",
      operatingSystem: "iPhone",
      url: APP_MARKETING_CANONICAL_URL,
      downloadUrl: appStoreUrl,
      image: APP_MARKETING_OG_IMAGE,
      publisher: { "@id": `${APP_MARKETING_CANONICAL_URL}#studio` },
    },
    {
      "@type": "HealthAndBeautyBusiness",
      "@id": `${APP_MARKETING_CANONICAL_URL}#studio`,
      name: "Cloud & Core Studio",
      url: "https://cloudandcorestudio.com",
      image: APP_MARKETING_OG_IMAGE,
      ...(profile.address ? { address: profile.address } : {}),
      ...(profile.publicPhone ? { telephone: profile.publicPhone } : {}),
      ...(profile.contactEmail ? { email: profile.contactEmail } : {}),
      ...(profile.instagramUrl ? { sameAs: [profile.instagramUrl] } : {}),
    },
  ],
}
```

- [ ] **Step 4: Run the focused test and verify success**

Run: `bun test tests/unit/appMarketing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the pure marketing contracts**

```bash
git add src/lib/app-marketing.ts tests/unit/appMarketing.test.ts
git commit -m "feat: add app marketing content contracts"
```

---

### Task 2: Explicit URL Language at SSR Bootstrap

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `tests/unit/i18n.test.mjs`
- Create: `tests/unit/appMarketingShellLanguage.test.mjs`

**Interfaces:**
- Consumes: the existing `LANG_COOKIE`, `DEFAULT_LOCALE`, `getBootLangScript()`, and root-shell initial-language behavior.
- Produces: `readSupportedLang(value): Lang | null`, `readLangCookieHeader(cookieHeader): Lang | null`, and correct initial `<html lang dir>` for valid `/app?lang=` URLs.

- [ ] **Step 1: Add failing boot-script and root-source tests**

Extend the dynamic import at the top of `tests/unit/i18n.test.mjs` so it also binds `getBootLangScript` and `readLangCookieHeader`, then append these top-level assertions before the existing `console.log`:

```js
const bootSource = getBootLangScript();
assert.match(bootSource, /window\.location\.pathname === "\/app"/);
assert.match(bootSource, /searchParams\.get\("lang"\)/);
assert.match(bootSource, /routeLang \|\| cookieLang/);
assert.equal(readLangCookieHeader("other=1; cc_lang=ar"), "ar");
assert.equal(readLangCookieHeader("cc_lang=fr"), null);
assert.equal(readLangCookieHeader(null), null);
```

Create `tests/unit/appMarketingShellLanguage.test.mjs`:

```js
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const source = readFileSync(resolve(root, "src/routes/__root.tsx"), "utf8");

describe("app marketing shell language", () => {
  test("reads the request URL before the saved cookie only for /app", () => {
    expect(source).toContain('url.pathname === "/app"');
    expect(source).toContain('url.searchParams.get("lang")');
    expect(source).toContain("readSupportedLang");
  });

  test("does not modify authentication or navigation behavior", () => {
    expect(source).not.toContain("requireAuthenticatedRoute");
    expect(source).not.toContain('redirect({ to: "/auth"');
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test tests/unit/i18n.test.mjs tests/unit/appMarketingShellLanguage.test.mjs`

Expected: FAIL because the boot script and root shell do not inspect `/app?lang=`.

- [ ] **Step 3: Add the supported-language reader and URL override**

In `src/lib/i18n.ts`, export:

```ts
export function readSupportedLang(value: unknown): Lang | null {
  return value === "he" || value === "ar" || value === "en" ? value : null;
}

export function readLangCookieHeader(cookieHeader: string | null): Lang | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LANG_COOKIE}=`));
  return match ? readSupportedLang(decodeURIComponent(match.slice(LANG_COOKIE.length + 1))) : null;
}
```

Use it inside `normalizeLang`. Update `getBootLangScript()` so its generated browser code computes:

```js
const url = new URL(window.location.href);
const requestedRouteLang = url.pathname === "/app" ? url.searchParams.get("lang") : null;
const routeLang = requestedRouteLang === "en" || requestedRouteLang === "he" || requestedRouteLang === "ar"
  ? requestedRouteLang
  : null;
const candidate = routeLang || cookieLang || currentLang || "he";
```

In both branches of `getInitialShellLang` in `src/routes/__root.tsx`, read a route override before the cookie/stored preference. Replace the route-local private cookie parser with `readLangCookieHeader` so the same verified parser is available to the `/app` loader:

```ts
const url = new URL(getStartContext().request.url);
const routeLang = url.pathname === "/app" ? readSupportedLang(url.searchParams.get("lang")) : null;
if (routeLang) return routeLang;
```

and on the client:

```ts
const routeLang =
  typeof window !== "undefined" && window.location.pathname === "/app"
    ? readSupportedLang(new URL(window.location.href).searchParams.get("lang"))
    : null;
if (routeLang) return routeLang;
```

Do not touch any root session synchronization, native-link handling, or router navigation code.

- [ ] **Step 4: Run language tests and verify success**

Run: `bun test tests/unit/i18n.test.mjs tests/unit/appMarketingShellLanguage.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the SSR language bootstrap**

```bash
git add src/lib/i18n.ts src/routes/__root.tsx tests/unit/i18n.test.mjs tests/unit/appMarketingShellLanguage.test.mjs
git commit -m "feat: honor app landing language in page shell"
```

---

### Task 3: Curate Approved Screenshots and Official Apple Badges

**Files:**
- Create: `public/images/app-marketing/he/{schedule,booking,bookings,membership,account}.png`
- Create: `public/images/app-marketing/ar/{schedule,booking,bookings,membership,account}.png`
- Create: `public/images/app-marketing/en/{schedule,booking,bookings,membership,account}.png`
- Create: `public/brand/app-store-badges/{he,ar,en}.svg`
- Create: `tests/unit/appMarketingAssets.test.mjs`

**Interfaces:**
- Consumes: approved captures in `tmp/member-loop-iteration-1-clean` and Apple’s official badge endpoint.
- Produces: the exact public paths referenced by `getAppMarketingScreenshots(lang)` and `APP_STORE_BADGE_PATHS`.

- [ ] **Step 1: Write the failing asset-contract test**

Create `tests/unit/appMarketingAssets.test.mjs`:

```js
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

describe("app marketing assets", () => {
  test("ships five non-empty localized captures per language", () => {
    for (const lang of ["he", "ar", "en"]) {
      for (const name of ["schedule", "booking", "bookings", "membership", "account"]) {
        const file = resolve(root, `public/images/app-marketing/${lang}/${name}.png`);
        expect(statSync(file).size).toBeGreaterThan(20_000);
      }
    }
  });

  test("ships unmodified vector Apple badges for every language", () => {
    for (const lang of ["he", "ar", "en"]) {
      const file = resolve(root, `public/brand/app-store-badges/${lang}.svg`);
      const svg = readFileSync(file, "utf8");
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(2_000);
    }
  });
});
```

- [ ] **Step 2: Run the asset test and verify failure**

Run: `bun test tests/unit/appMarketingAssets.test.mjs`

Expected: FAIL because the stable public assets do not exist.

- [ ] **Step 3: Copy approved captures without editing pixels**

Create the public directories and copy these exact sources mechanically:

| Public filename | Hebrew source | Arabic source | English source |
|---|---|---|---|
| `schedule.png` | `he-_member_schedule.png` | `ar-_member_schedule.png` | `en-_member_schedule.png` |
| `booking.png` | `he-_member_schedule-detail.png` | `ar-_member_schedule-detail.png` | `en-_member_schedule-detail.png` |
| `bookings.png` | `he-_member_bookings.png` | `ar-_member_bookings.png` | `en-_member_bookings.png` |
| `membership.png` | `he-_member_packages.png` | `ar-_member_packages.png` | `en-_member_packages.png` |
| `account.png` | `he-_member_account.png` | `ar-_member_account.png` | `en-_member_account.png` |

Use `cp` because this is a byte-for-byte asset promotion, then verify all copied images remain `390×844` using `file public/images/app-marketing/*/*.png`.

- [ ] **Step 4: Download the official localized preferred-black Apple badges**

Use Apple’s official marketing tools endpoints, not a third-party recreation:

```bash
curl -fsSL 'https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/he-il?size=250x83' -o public/brand/app-store-badges/he.svg
curl -fsSL 'https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/ar-sa?size=250x83' -o public/brand/app-store-badges/ar.svg
curl -fsSL 'https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83' -o public/brand/app-store-badges/en.svg
```

Check each response is SVG artwork rather than HTML with `file` and `head -n 2`. Do not reformat, optimize, crop, recolor, translate, animate, or change the badge paths. Render later at a minimum CSS height of `40px` with clear space outside the image.

- [ ] **Step 5: Run the asset test and verify success**

Run: `bun test tests/unit/appMarketingAssets.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit approved marketing assets**

```bash
git add public/images/app-marketing public/brand/app-store-badges tests/unit/appMarketingAssets.test.mjs
git commit -m "assets: add localized app marketing media"
```

---

### Task 4: Register the Public Route and Localized Head

**Files:**
- Create: `src/routes/app.tsx`
- Create: `src/components/app-marketing/AppMarketingPage.tsx`
- Create: `tests/unit/appMarketingRoute.test.mjs`

**Interfaces:**
- Consumes: `parseAppMarketingSearch`, `resolveAppMarketingLang`, `getAppMarketingMeta`, `buildAppMarketingStructuredData`, `getStoredLang`, `readLangCookieHeader`, `applyLang`, `getInstagramLandingData`, and `getDownloadConfig`.
- Produces: TanStack file route `/app`, `AppMarketingRouteData`, localized metadata/canonical links, and loader props for `AppMarketingPage`.

- [ ] **Step 1: Write the failing route-source contract**

Create `tests/unit/appMarketingRoute.test.mjs`:

```js
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const appRoute = readFileSync(resolve(root, "src/routes/app.tsx"), "utf8");
const protectedRoute = readFileSync(resolve(root, "src/routes/_authenticated/route.tsx"), "utf8");

describe("public app marketing route", () => {
  test("registers /app outside authenticated routing", () => {
    expect(appRoute).toContain('createFileRoute("/app")');
    expect(appRoute).not.toContain("requireAuthenticatedRoute");
    expect(appRoute).not.toContain("requireRouteRole");
    expect(appRoute).not.toContain("redirect(");
  });

  test("uses the existing public data and App Store sources", () => {
    expect(appRoute).toContain("getInstagramLandingData");
    expect(appRoute).toContain("getDownloadConfig");
  });

  test("emits canonical, robots, social, and structured-data contracts", () => {
    expect(appRoute).toContain("APP_MARKETING_CANONICAL_URL");
    expect(appRoute).toContain('name: "robots"');
    expect(appRoute).toContain('property: "og:title"');
    expect(appRoute).toContain('name: "twitter:card"');
    expect(appRoute).toContain('type="application/ld+json"');
  });

  test("leaves the existing protected route guard in place", () => {
    expect(protectedRoute).toContain("requireAuthenticatedRoute");
  });
});
```

- [ ] **Step 2: Run the route test and verify failure**

Run: `bun test tests/unit/appMarketingRoute.test.mjs`

Expected: FAIL because `src/routes/app.tsx` does not exist.

- [ ] **Step 3: Implement loader, search validation, head metadata, and JSON-LD wiring**

Create `src/routes/app.tsx` with:

```ts
export type AppMarketingRouteData = {
  lang: Lang;
  appStoreUrl: string;
  profile: AppMarketingPublicProfile;
};

const getSavedAppMarketingLang = createIsomorphicFn()
  .server(() => {
    const cookieHeader = getStartContext().request.headers.get("cookie");
    return readLangCookieHeader(cookieHeader) ?? DEFAULT_LOCALE;
  })
  .client(() => getStoredLang());

export const Route = createFileRoute("/app")({
  validateSearch: parseAppMarketingSearch,
  loaderDeps: ({ search }) => ({ explicitLang: search.lang }),
  loader: async ({ deps }): Promise<AppMarketingRouteData> => {
    const lang = resolveAppMarketingLang(deps.explicitLang, getSavedAppMarketingLang());
    const appStoreUrl = getDownloadConfig().appStoreUrl;
    try {
      const studio = await getInstagramLandingData();
      return {
        lang,
        appStoreUrl,
        profile: {
          address: studio.address,
          contactEmail: studio.contactEmail,
          instagramUrl: studio.instagramUrl,
          publicPhone: studio.publicPhone,
          whatsappNumber: studio.whatsappNumber,
        },
      };
    } catch {
      return {
        lang,
        appStoreUrl,
        profile: {
          address: null,
          contactEmail: null,
          instagramUrl: null,
          publicPhone: null,
          whatsappNumber: null,
        },
      };
    }
  },
  head: ({ loaderData }) => {
    const meta = getAppMarketingMeta(loaderData?.lang ?? DEFAULT_LOCALE);
    return {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: meta.title },
        { property: "og:description", content: meta.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: APP_MARKETING_CANONICAL_URL },
        { property: "og:locale", content: meta.locale },
        { property: "og:image", content: APP_MARKETING_OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: meta.title },
        { name: "twitter:description", content: meta.description },
        { name: "twitter:image", content: APP_MARKETING_OG_IMAGE },
      ],
      links: [
        { rel: "canonical", href: APP_MARKETING_CANONICAL_URL },
        { rel: "alternate", hrefLang: "he", href: `${APP_MARKETING_CANONICAL_URL}?lang=he` },
        { rel: "alternate", hrefLang: "ar", href: `${APP_MARKETING_CANONICAL_URL}?lang=ar` },
        { rel: "alternate", hrefLang: "en", href: `${APP_MARKETING_CANONICAL_URL}?lang=en` },
        { rel: "alternate", hrefLang: "x-default", href: APP_MARKETING_CANONICAL_URL },
      ],
    };
  },
  component: AppMarketingRoute,
});
```

The component must call `applyLang(data.lang)` in an effect only when the active language differs, serialize `buildAppMarketingStructuredData(data)` with `JSON.stringify`, render one `<script type="application/ld+json">`, and pass `lang`, `appStoreUrl`, and `profile` to `AppMarketingPage`.

Do not add analytics calls or route guards.

- [ ] **Step 4: Add a temporary semantic component export so the route compiles**

Create the `AppMarketingPageProps` interface and a temporary component in `src/components/app-marketing/AppMarketingPage.tsx` returning:

```tsx
export function AppMarketingPage({ lang }: AppMarketingPageProps) {
  return <main id="main-content" lang={lang} dir={LANG_META[lang].dir} />;
}
```

Task 5 replaces the temporary body with the complete implementation.

- [ ] **Step 5: Run route and build checks**

Run: `bun test tests/unit/appMarketingRoute.test.mjs tests/unit/appMarketing.test.ts`

Expected: PASS.

Run: `bun run build`

Expected: PASS and the generated route manifest includes `/app`.

- [ ] **Step 6: Commit the public route shell**

```bash
git add src/routes/app.tsx src/components/app-marketing/AppMarketingPage.tsx tests/unit/appMarketingRoute.test.mjs
git commit -m "feat: register public app marketing route"
```

---

### Task 5: Build the Complete Marketing Page and Isolated Visual System

**Files:**
- Modify: `src/components/app-marketing/AppMarketingPage.tsx`
- Create: `src/components/app-marketing/app-marketing.css`
- Modify: `tests/unit/appMarketingRoute.test.mjs`

**Interfaces:**
- Consumes: `AppMarketingPageProps`, `APP_MARKETING_COPY`, `getAppMarketingScreenshots`, `LANG_META`, `applyLang`, TanStack `Link`/`useNavigate`, Lucide icons already installed, official logos, studio photography, and localized badge paths.
- Produces: complete semantic page UI, accessible language navigation, stable localized screenshots, and responsive visual behavior.

- [ ] **Step 1: Extend the failing source contract for page structure and destinations**

Append these assertions to `tests/unit/appMarketingRoute.test.mjs` after reading `src/components/app-marketing/AppMarketingPage.tsx` as `pageSource`:

```js
test("renders the complete semantic section and destination contract", () => {
  expect(pageSource).toContain('<main id="main-content"');
  expect(pageSource).toContain('aria-label={copy.features.title}');
  expect(pageSource).toContain('aria-label={copy.screenshots.title}');
  expect(pageSource).toContain('aria-label={copy.classes.title}');
  expect(pageSource).toContain('aria-label={copy.steps.title}');
  expect(pageSource).toContain('to="/auth"');
  expect(pageSource).toContain('to="/support"');
  expect(pageSource).toContain('to="/privacy"');
  expect(pageSource).toContain('to="/terms"');
  expect(pageSource).toContain("getAppMarketingScreenshots(lang)");
});

test("uses the official logo, real studio image, and Apple badge", () => {
  expect(pageSource).toContain("/brand/cloud-core-logo-full.webp");
  expect(pageSource).toContain("/images/auth/cloud-core-auth-hero.webp");
  expect(pageSource).toContain("/brand/app-store-badges/");
  expect(pageSource).toContain("Apple and the Apple logo are trademarks of Apple Inc.");
});
```

- [ ] **Step 2: Run the route test and verify failure**

Run: `bun test tests/unit/appMarketingRoute.test.mjs`

Expected: FAIL because the temporary page component lacks the required sections.

- [ ] **Step 3: Implement the semantic page component**

Replace the temporary component with these units in the same focused file:

```ts
export type AppMarketingPageProps = {
  lang: Lang;
  appStoreUrl: string;
  profile: AppMarketingPublicProfile;
};

function LanguageSelector(props: { lang: Lang; onChange: (lang: Lang) => void }): JSX.Element;
function AppStoreBadge(props: { lang: Lang; href: string; label: string }): JSX.Element;
function SectionHeading(props: { eyebrow: string; title: string }): JSX.Element;
function ContactLinks(props: { profile: AppMarketingPublicProfile; supportLabel: string }): JSX.Element;
export function AppMarketingPage(props: AppMarketingPageProps): JSX.Element;
```

Implementation requirements:

- Import `./app-marketing.css` once in the component.
- Add a visible-on-focus skip link targeting `#main-content`.
- Use a compact `<header>` with official full logo, grouped language buttons, and `/auth` action.
- On language click, call `applyLang(next)` and `navigate({ to: "/app", search: { lang: next }, replace: true })`.
- Give language buttons `aria-pressed`, `lang`, `dir`, and a minimum 44-pixel target.
- Render exactly one `h1` in the hero.
- Render `/auth` as the primary CTA in header, hero, and final CTA; do not invent `mode` or `returnTo` parameters.
- Render the Apple badge once in the hero and once in the final CTA as two separate page layouts/CTA regions, always unmodified and at least 40 pixels high.
- Use `/images/auth/cloud-core-auth-hero.webp` as the real hero photograph with localized alt text from `authImages.hero.alt[lang]`.
- Render four feature articles with icons `CalendarDays`, `TicketCheck`, `CalendarCheck`, and `BadgeCheck`.
- Render the five localized screenshots from `getAppMarketingScreenshots(lang)` in a labelled scroll region. Preserve `width={390}`, `height={844}`, `loading="lazy"`, and `decoding="async"`.
- Render the four class names as a textual editorial list alongside `/images/studio/studio-interior.webp` and `/images/classes/aerial-yoga-flow.webp`; do not claim a one-to-one photo/class mapping.
- Render the three steps as an ordered list with visible `01`, `02`, `03` numbering.
- Render dynamic contact links only when the loader supplied them; always provide `/support`.
- Render footer links to `/support`, `/privacy`, `/terms`, and `/auth`, `Cloud & Core Studio`, localized Hurfeish location, official wordmark, and verified Instagram when present.
- Add the international Apple credit line exactly: `Apple and the Apple logo are trademarks of Apple Inc., registered in the U.S. and other countries and regions. App Store is a service mark of Apple Inc.`
- All decorative icons use `aria-hidden="true"`; directional arrows use CSS logical transforms instead of language-specific icon substitutions.

- [ ] **Step 4: Implement the isolated responsive stylesheet**

Create `src/components/app-marketing/app-marketing.css` with one root namespace `.app-marketing` and these design contracts:

```css
.app-marketing {
  --app-navy: #0b1d3a;
  --app-ivory: #faf7f2;
  --app-gold: #d4af6a;
  --app-blue: #e7f1f6;
  --app-sand: #e8dfd1;
  --app-slate: #6f7a8c;
  min-height: 100svh;
  overflow-x: clip;
  color: var(--app-navy);
  background: var(--app-ivory);
}

.app-marketing :focus-visible {
  outline: 3px solid var(--app-gold);
  outline-offset: 3px;
}

.app-marketing__store-badge {
  display: block;
  width: auto;
  height: 40px;
}

.app-marketing__screenshots {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(248px, 78vw);
  gap: 18px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline mandatory;
  scrollbar-width: thin;
}

.app-marketing__screenshot {
  scroll-snap-align: center;
}

@media (min-width: 768px) {
  .app-marketing__screenshots {
    grid-auto-columns: minmax(260px, 30vw);
  }
}

@media (min-width: 1180px) {
  .app-marketing__screenshots {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    grid-auto-flow: initial;
    overflow: visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-marketing *,
  .app-marketing *::before,
  .app-marketing *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Complete the stylesheet with:

- mobile-first header, hero, feature grid, gallery frames, class composition, ordered steps, CTA, and footer;
- logical properties (`margin-inline`, `padding-inline`, `inset-inline`, `border-inline`) for RTL/LTR symmetry;
- hero typography using the existing Assistant/Noto Sans Arabic UI stack and Cormorant only for English display accents;
- no neon, loud gradient, glass card, heavy shadow, fixed background, or autoplay media;
- restrained gold rules, sand/blue surfaces, subtle paper texture from `/images/textures/ivory-paper.svg`, and generous whitespace;
- breakpoints at 640, 768, 1024, and 1180 pixels without content clipping at intermediate requested widths.

- [ ] **Step 5: Run focused tests and production build**

Run: `bun test tests/unit/appMarketing.test.ts tests/unit/appMarketingAssets.test.mjs tests/unit/appMarketingRoute.test.mjs`

Expected: PASS.

Run: `bun run build`

Expected: PASS.

- [ ] **Step 6: Commit the complete page UI**

```bash
git add src/components/app-marketing/AppMarketingPage.tsx src/components/app-marketing/app-marketing.css tests/unit/appMarketingRoute.test.mjs
git commit -m "feat: build multilingual app marketing page"
```

---

### Task 6: Add Browser-Level Public, Direction, Metadata, and Responsive Checks

**Files:**
- Create: `tests/e2e/app-marketing-playwright.py`

**Interfaces:**
- Consumes: built `/app`, existing production server command, all public CTAs and metadata.
- Produces: repeatable browser verification and final screenshots under `tmp/app-marketing-qa/`.

- [ ] **Step 1: Write the browser test**

Create `tests/e2e/app-marketing-playwright.py` using the same `playwright.async_api` convention as `tests/e2e/playwright-routing.py`:

```py
import asyncio
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE = os.environ.get("APP_BASE_URL", "http://127.0.0.1:4173")
WIDTHS = [320, 375, 390, 430, 768, 1024, 1440]
LANGUAGES = [
    ("he", "rtl", "אפליקציית Cloud & Core | יוגה אווירית ופילאטיס"),
    ("ar", "rtl", "تطبيق Cloud & Core | يوغا هوائية وبيلاتس"),
    ("en", "ltr", "Cloud & Core App | Aerial Yoga & Pilates"),
]
OUTPUT = Path("tmp/app-marketing-qa")

async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await context.new_page()

        for code, direction, expected_title in LANGUAGES:
            await page.goto(f"{BASE}/app?lang={code}", wait_until="networkidle")
            assert await page.locator("html").get_attribute("lang") == code
            assert await page.locator("html").get_attribute("dir") == direction
            assert await page.title() == expected_title
            assert await page.locator('link[rel="canonical"]').get_attribute("href") == "https://cloudandcorestudio.com/app"
            assert await page.locator("h1").count() == 1
            assert await page.locator('script[type="application/ld+json"]').count() == 1
            assert await page.locator("[data-app-screenshot]").count() == 5
            assert "id6786035836" in (await page.locator("[data-app-store-link]").first.get_attribute("href"))
            assert urlparse(await page.locator("[data-auth-link]").first.get_attribute("href")).path == "/auth"

        await page.goto(f"{BASE}/app?lang=en", wait_until="networkidle")
        await page.get_by_role("button", name="العربية").click()
        await page.wait_for_url("**/app?lang=ar")
        assert await page.locator("html").get_attribute("lang") == "ar"
        assert await page.locator("html").get_attribute("dir") == "rtl"

        expected_footer_paths = {"/support", "/privacy", "/terms", "/auth"}
        footer_paths = {
            urlparse(href).path
            for href in await page.locator("footer a").evaluate_all("els => els.map(el => el.href)")
        }
        assert expected_footer_paths.issubset(footer_paths)

        for width in WIDTHS:
            await page.set_viewport_size({"width": width, "height": 844 if width < 600 else 900})
            code = "he" if width in (375, 390, 1024) else "en"
            await page.goto(f"{BASE}/app?lang={code}", wait_until="networkidle")
            overflow = await page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            assert overflow <= 1, f"horizontal overflow at {width}px: {overflow}px"

        for path in ("/auth", "/support", "/privacy", "/terms"):
            response = await context.request.get(f"{BASE}{path}")
            assert response.status == 200, f"{path} returned {response.status}"

        for path in ("/member", "/admin", "/instructor"):
            response = await context.request.get(f"{BASE}{path}", max_redirects=0)
            assert response.status in (302, 303, 307, 308)
            assert urlparse(response.headers["location"]).path == "/auth"

        reduced = await browser.new_context(
            viewport={"width": 390, "height": 844}, reduced_motion="reduce"
        )
        reduced_page = await reduced.new_page()
        await reduced_page.goto(f"{BASE}/app?lang=he", wait_until="networkidle")
        max_animation_ms = await reduced_page.locator(".app-marketing *").evaluate_all("""
          els => Math.max(0, ...els.map(el => {
            const value = getComputedStyle(el).animationDuration.trim();
            if (value.endsWith('ms')) return Number.parseFloat(value);
            if (value.endsWith('s')) return Number.parseFloat(value) * 1000;
            return 0;
          }))
        """)
        assert max_animation_ms <= 0.01
        await reduced.close()

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(f"{BASE}/app?lang=he", wait_until="networkidle")
        await page.screenshot(path=OUTPUT / "app-he-390.png", full_page=True)
        await page.set_viewport_size({"width": 1440, "height": 900})
        await page.goto(f"{BASE}/app?lang=en", wait_until="networkidle")
        await page.screenshot(path=OUTPUT / "app-en-1440.png", full_page=True)

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Start the production build locally**

Run: `bun run build`

Expected: PASS.

Run in a PTY: `PORT=4173 bun run start`

Expected: server reports `Cloud & Core listening on 4173`.

- [ ] **Step 3: Run the browser test and inspect failures**

Run: `APP_BASE_URL=http://127.0.0.1:4173 python3 tests/e2e/app-marketing-playwright.py`

Expected: PASS with checks at all seven requested widths and both screenshots written.

- [ ] **Step 4: Visually inspect the mobile and desktop captures**

Open `tmp/app-marketing-qa/app-he-390.png` and `tmp/app-marketing-qa/app-en-1440.png`. Confirm:

- logo is not cropped or distorted;
- hero copy and both CTAs are above the first long scroll;
- all text aligns correctly in RTL/LTR;
- language/header controls do not overlap at 320–430 px;
- screenshot cards remain readable and scroll independently without page overflow;
- no empty oversized sections or clipped footer links;
- Apple badge is unmodified, at least 40 px high, and visually subordinate to the page message.

If a visual defect is found, add a focused CSS assertion where practical, patch only `app-marketing.css` or the marketing component, and rerun the browser test.

- [ ] **Step 5: Commit browser regression coverage**

```bash
git add tests/e2e/app-marketing-playwright.py
git commit -m "test: cover app marketing route in browser"
```

---

### Task 7: Full Regression and Delivery Verification

**Files:**
- Modify only if a verification failure reveals an in-scope defect in files introduced above.

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: verified lint, unit/integration, production build, route behavior, responsive screenshots, and final delivery facts.

- [ ] **Step 1: Check the final diff scope**

Run: `git status --short`

Expected: unrelated pre-existing changes remain untouched; marketing work is committed or limited to the files listed in this plan.

Run: `git diff --check HEAD~5..HEAD`

Expected: no whitespace errors in the feature commits.

- [ ] **Step 2: Confirm locked dependencies**

Run: `bun install`

Expected: completes successfully without changing dependency versions or adding a package.

- [ ] **Step 3: Run the formatter on the in-scope text files**

Run:

```bash
./node_modules/.bin/prettier --write src/lib/app-marketing.ts src/components/app-marketing/AppMarketingPage.tsx src/components/app-marketing/app-marketing.css src/routes/app.tsx src/routes/__root.tsx src/lib/i18n.ts tests/unit/appMarketing.test.ts tests/unit/appMarketingAssets.test.mjs tests/unit/appMarketingRoute.test.mjs tests/unit/appMarketingShellLanguage.test.mjs tests/unit/i18n.test.mjs
```

Expected: succeeds and does not touch unrelated files.

- [ ] **Step 4: Run lint**

Run: `bun run lint`

Expected: PASS without suppressing new or existing failures.

- [ ] **Step 5: Run unit and integration tests**

Run: `bun test tests/unit tests/integration`

Expected: PASS.

- [ ] **Step 6: Run the production build**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 7: Run focused browser QA again**

Run: `APP_BASE_URL=http://127.0.0.1:4173 python3 tests/e2e/app-marketing-playwright.py`

Expected: PASS.

- [ ] **Step 8: Verify direct HTTP route behavior**

Run:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/app?lang=he
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/auth
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/support
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/privacy
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/terms
curl -sS -o /dev/null -D - http://127.0.0.1:4173/member | head
curl -sS -o /dev/null -D - http://127.0.0.1:4173/admin | head
curl -sS -o /dev/null -D - http://127.0.0.1:4173/instructor | head
```

Expected: public routes return `200`; protected routes return a redirect whose location begins with `/auth`.

- [ ] **Step 9: Record final handoff facts**

Prepare the final response with:

- discovered architecture;
- files created and modified;
- public route and language resolution behavior;
- exact `/auth` and App Store CTA destinations;
- metadata and structured data added;
- explicit note that analytics was omitted because none exists;
- tests and commands run with results;
- production build result;
- remaining blockers, if any;
- clickable mobile and desktop screenshot paths;
- explicit confirmation that deployment and the App Store listing were not changed.
