import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildWhatsappHref } from "../../src/lib/instagramLanding.ts";

const root = resolve(import.meta.dir, "../..");
const appRoute = readFileSync(resolve(root, "src/routes/app.tsx"), "utf8");
const appRouteSupport = resolve(root, "src/routes/app-marketing-route.tsx");
const rootRoute = readFileSync(resolve(root, "src/routes/__root.tsx"), "utf8");
const pageSource = readFileSync(
  resolve(root, "src/components/app-marketing/AppMarketingPage.tsx"),
  "utf8",
);
const protectedRoute = readFileSync(resolve(root, "src/routes/_authenticated/route.tsx"), "utf8");

describe("public app marketing route", () => {
  test("registers three public static localized routes outside authenticated routing", () => {
    for (const lang of ["ar", "he", "en"]) {
      const route = readFileSync(resolve(root, `src/routes/app.${lang}.tsx`), "utf8");
      expect(route).toContain(`createFileRoute("/app/${lang}")`);
      expect(route).toContain("getAppMarketingRouteLoader");
      expect(route).toContain("getAppMarketingRouteHead");
      expect(route).not.toContain("requireAuthenticatedRoute");
      expect(route).not.toContain("requireRouteRole");
      expect(route).not.toContain("validateSearch");
    }
    expect(readFileSync(appRouteSupport, "utf8")).toContain("APP_MARKETING_INSTALL_URL");
    expect(readFileSync(appRouteSupport, "utf8")).toContain("adultPlans");
  });

  test("makes /app a temporary redirect-only locale resolver", () => {
    expect(appRoute).toContain('createFileRoute("/app")');
    expect(appRoute).not.toContain("requireAuthenticatedRoute");
    expect(appRoute).not.toContain("requireRouteRole");
    expect(appRoute).toContain("redirect({");
    expect(appRoute).toContain("statusCode: 307");
    expect(appRoute).toContain("resolveMarketingLocale");
    expect(appRoute).toContain("sanitizeMarketingUtm");
    expect(appRoute).toContain("to: `/app/${lang}`");
    expect(appRoute).toContain("component: Outlet");
    expect(appRoute).toContain('location.pathname !== "/app"');
    expect(appRoute).not.toContain("AppMarketingPage");
  });

  test("shares complete static SSR head and page contracts", () => {
    const source = readFileSync(appRouteSupport, "utf8");
    expect(source).toContain("getInstagramLandingData");
    expect(source).toContain('name: "robots"');
    expect(source).toContain('name: "apple-itunes-app"');
    expect(source).toContain("app-id=6786035836");
    expect(source).toContain('property: "og:locale"');
    expect(source).toContain('property: "og:locale:alternate"');
    expect(source).toContain("getAppMarketingAlternates");
    expect(source).toContain('rel: "canonical"');
    expect(source).toContain('rel: "preload"');
    expect(source).toContain('as: "image"');
    expect(source).toContain("buildAppMarketingStructuredData");
    expect(source).toContain('replace(/</g, "\\\\u003c")');
    expect(source).toContain("faqVisible: false");
    expect(source).not.toContain('<script type="application/ld+json"');
  });

  test("uses static localized paths before saved language and a studio hero for generic social cards", () => {
    expect(rootRoute).toContain("url.pathname.match(/^\\/app\\/(ar|he|en)$/)");
    expect(rootRoute).toContain("window.location.pathname.match(/^\\/app\\/(ar|he|en)$/)");
    expect(rootRoute).toContain("/images/auth/cloud-core-auth-hero.webp");
    expect(rootRoute).not.toContain("/images/classes/aerial-yoga-flow.webp");
  });

  test("leaves the existing protected route guard in place", () => {
    expect(protectedRoute).toContain("requireAuthenticatedRoute");
  });

  test("renders the complete semantic section and destination contract", () => {
    expect(pageSource).toContain('<main id="main-content"');
    expect(pageSource).toContain("aria-label={copy.features.title}");
    expect(pageSource).toContain("aria-label={copy.screenshots.title}");
    expect(pageSource).toContain("aria-label={copy.classes.title}");
    expect(pageSource).toContain("aria-label={copy.steps.title}");
    expect(pageSource).toContain('to="/auth"');
    expect(pageSource).toContain('to="/support"');
    expect(pageSource).toContain('to="/privacy"');
    expect(pageSource).toContain('to="/terms"');
    expect(pageSource).toContain("getAppMarketingScreenshots(lang)");
  });

  test("uses the official logo, real studio image, and Apple badge", () => {
    expect(pageSource).toContain("/brand/cloud-core-logo-full.webp");
    expect(pageSource).toContain("/images/auth/cloud-core-auth-hero.webp");
    expect(pageSource).toContain("APP_STORE_BADGE_PATHS[lang]");
    expect(pageSource).toContain("Apple and the Apple logo are trademarks of Apple Inc.");
  });

  test("normalizes local WhatsApp contacts with the shared public-link contract", () => {
    const whatsappHref = buildWhatsappHref("055-939-8438", "");

    expect(new URL(whatsappHref).pathname).toBe("/972559398438");
    expect(pageSource).toContain('buildWhatsappHref(profile.whatsappNumber, "")');
    expect(pageSource).not.toContain('profile.whatsappNumber?.replace(/[^\\d+]/g, "")');
  });

  test("keeps final support visible and gives footer navigation distinct landmark labels", () => {
    expect(pageSource).toContain('className="app-marketing__final-support"');
    expect(pageSource).toContain("aria-label={contactLabel}");
    expect(pageSource).toContain("contactLabel={labels.contact}");
    expect(pageSource).toContain("aria-label={labels.footerNavigation}");
  });
});
