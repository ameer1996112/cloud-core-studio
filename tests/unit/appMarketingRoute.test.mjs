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
