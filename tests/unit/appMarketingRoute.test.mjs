import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildWhatsappHref } from "../../src/lib/instagramLanding.ts";

const root = resolve(import.meta.dir, "../..");
const appRoute = readFileSync(resolve(root, "src/routes/app.tsx"), "utf8");
const pageSource = readFileSync(
  resolve(root, "src/components/app-marketing/AppMarketingPage.tsx"),
  "utf8",
);
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
    expect(appRoute).toContain("scripts: structuredData");
    expect(appRoute).toContain('type: "application/ld+json"');
    expect(appRoute).toContain("children: structuredData");
    expect(appRoute).not.toContain('<script type="application/ld+json"');
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
