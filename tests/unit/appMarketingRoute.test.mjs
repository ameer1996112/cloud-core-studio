import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildWhatsappHref } from "../../src/lib/instagramLanding.ts";

const root = resolve(import.meta.dir, "../..");
const appRoute = readFileSync(resolve(root, "src/routes/app.tsx"), "utf8");
const appRouteSupport = resolve(root, "src/components/app-marketing/AppMarketingRoute.tsx");
const appMarketingPublicData = resolve(root, "src/lib/appMarketing.functions.ts");
const appMarketingServerData = resolve(root, "src/lib/appMarketing.server.ts");
const rootRoute = readFileSync(resolve(root, "src/routes/__root.tsx"), "utf8");
const pageSource = readFileSync(
  resolve(root, "src/components/app-marketing/AppMarketingPage.tsx"),
  "utf8",
);
const styleSource = readFileSync(
  resolve(root, "src/components/app-marketing/app-marketing.css"),
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
    const source = readFileSync(appRouteSupport, "utf8");
    expect(source).toContain("APP_MARKETING_INSTALL_URL");
    const publicDataSource = readFileSync(appMarketingPublicData, "utf8");
    const serverDataSource = readFileSync(appMarketingServerData, "utf8");
    expect(source).toContain('from "@/lib/appMarketing.functions"');
    expect(source).toContain(
      "getPublicData: () => Promise<AppMarketingPublicData> = getAppMarketingRoutePublicData",
    );
    expect(source).toContain("const publicData = await getPublicData()");
    expect(source).not.toContain("getDownloadConfig");
    expect(publicDataSource).toContain("getAppMarketingPublicData = createServerFn");
    expect(source).toContain("loadAppMarketingPublicData");
    expect(serverDataSource).toContain("const appStoreUrl = getDownloadConfig().appStoreUrl");
    expect(serverDataSource).toContain("loadInstagramLandingData");
    expect(
      serverDataSource.indexOf("const appStoreUrl = getDownloadConfig().appStoreUrl"),
    ).toBeGreaterThan(serverDataSource.indexOf("loadAppMarketingPublicData"));
    expect(serverDataSource).toContain("adultPlans");
    expect(readFileSync(appRouteSupport, "utf8")).toContain("sanitizeMarketingUtm");
    expect(readFileSync(appRouteSupport, "utf8")).toContain("marketingUtm");
  });

  test("makes /app a temporary redirect-only locale resolver", () => {
    expect(appRoute).toContain('createFileRoute("/app")');
    expect(appRoute).not.toContain("requireAuthenticatedRoute");
    expect(appRoute).not.toContain("requireRouteRole");
    expect(appRoute).toContain("redirect({");
    expect(appRoute).toContain("statusCode: 307");
    expect(appRoute).toContain("resolveAppMarketingRedirect");
    expect(appRoute).toContain("to: decision.to");
    expect(appRoute).toContain("component: Outlet");
    expect(appRoute).toContain('location.pathname !== "/app"');
    expect(appRoute).not.toContain("AppMarketingPage");
  });

  test("shares complete static SSR head and page contracts", () => {
    const source = readFileSync(appRouteSupport, "utf8");
    const serverDataSource = readFileSync(appMarketingServerData, "utf8");
    expect(serverDataSource).toContain("loadInstagramLandingData");
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
    expect(source).toContain("faqVisible: true");
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
    expect(pageSource).toContain("`/member/schedule`");
    expect(pageSource).toContain("`/auth`");
    expect(pageSource).toContain("`/auth?mode=signup`");
    expect(pageSource).toContain("data-create-account-link");
    expect(pageSource).toContain('analytics?.trackCreateAccount("hero")');
    expect(pageSource).toContain('href="/support"');
    expect(pageSource).toContain('href="/privacy"');
    expect(pageSource).toContain('href="/terms"');
    expect(pageSource).toContain("getAppMarketingScreenshots(lang)");
    expect(pageSource).toContain("marketingUtm");
    expect(pageSource).toContain("buildMarketingHref");
    expect(pageSource).toContain("new URLSearchParams(marketingUtm)");
    expect(pageSource).toContain("hrefLang={code}");
    expect(pageSource).toContain('aria-current={lang === code ? "page" : undefined}');
  });

  test("renders the verified details, localized content, and distinct crawlable actions", () => {
    expect(pageSource).toContain("copy.hero.trust");
    expect(pageSource).toContain("copy.hero.offer");
    expect(pageSource).toContain("copy.hero.memberCta");
    expect(pageSource).toContain("copy.trustSignals.items.map");
    expect(pageSource).toContain("copy.footer.address");
    expect(pageSource).toContain("getAppMarketingAddressDisplay");
    expect(pageSource).toContain("copy.screenshots.headings[index]");
    expect(pageSource).toContain("copy.classes.descriptions[index]");
    expect(pageSource).toContain('<details className="app-marketing__faq-item"');
    expect(styleSource).toContain(".app-marketing__faq-item summary::after");
    expect(styleSource).toContain(".app-marketing__faq-item[open] summary::after");
    expect(styleSource).toContain("inset-inline-end");
    expect(styleSource).toContain('content: "+"');
    expect(styleSource).toContain('content: "−"');
    expect(styleSource).toContain("transform: none");
    expect(pageSource).toContain("copy.faq.map(([question, answer])");
    expect(pageSource).toContain("33.016109,35.349285");
    expect(pageSource).toContain("/images/studio/studio-sign.webp");
    expect(pageSource).toContain("width={502}");
    expect(pageSource).not.toContain("/images/classes/aerial-yoga-flow.webp");
  });

  test("uses the official logo, real studio image, and Apple badge", () => {
    expect(pageSource).toContain("/brand/cloud-core-logo-full.webp");
    expect(pageSource).toContain("/images/auth/cloud-core-auth-hero.webp");
    expect(pageSource).toContain("APP_STORE_BADGE_PATHS[lang]");
    expect(pageSource).toContain("APP_STORE_BADGE_DIMENSIONS[lang]");
    expect(pageSource).toContain("width={dimensions.width}");
    expect(pageSource).toContain("height={dimensions.height}");
    expect(pageSource).toContain("Apple and the Apple logo are trademarks of Apple Inc.");
  });

  test("normalizes local WhatsApp contacts with the shared public-link contract", () => {
    const whatsappHref = buildWhatsappHref("055-939-8438", "");

    expect(new URL(whatsappHref).pathname).toBe("/972559398438");
    expect(pageSource).toContain('buildWhatsappHref(profile.whatsappNumber ?? publicPhone, "")');
    expect(pageSource).not.toContain('profile.whatsappNumber?.replace(/[^\\d+]/g, "")');
  });

  test("keeps final sign-in visible with a login icon and gives footer navigation distinct landmark labels", () => {
    expect(pageSource).toContain('className="app-marketing__final-login"');
    expect(pageSource).toContain("<LogIn");
    expect(pageSource).toContain("data-login-link");
    expect(pageSource).not.toContain("app-marketing__final-support");
    expect(pageSource).toContain("aria-label={contactLabel}");
    expect(pageSource).toContain("contactLabel={labels.contact}");
    expect(pageSource).toContain("aria-label={labels.footerNavigation}");
  });
});
