import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const banner = readFileSync(
  new URL("../../src/components/member/YogaPromoBanner.tsx", import.meta.url),
  "utf8",
);
const landing = readFileSync(
  new URL("../../src/routes/promo.yoga-lina.tsx", import.meta.url),
  "utf8",
);
const downloadConfig = readFileSync(
  new URL("../../src/lib/download-config.ts", import.meta.url),
  "utf8",
);

describe("Yoga promotion App Store CTA", () => {
  test("uses the canonical Cloud & Core App Store listing for public visitors", () => {
    expect(downloadConfig).toContain("https://apps.apple.com/il/app/cloud-core/id6786035836");
    expect(landing).toContain("!authenticated && !nativeApp");
    expect(landing).toContain("? DEFAULT_APP_STORE_URL");
  });

  test("renders a real link and keeps authenticated claiming separate", () => {
    expect(banner).toContain("href={claimHref}");
    expect(banner).toContain('target="_blank"');
    expect(landing).toContain(
      "onClaim={authenticated ? act : nativeApp ? startSignup : undefined}",
    );
    expect(landing).toContain("!attributionReady || !authReady || !runtimeReady");
    expect(landing).toContain('t("promo.yoga.installReturnHint")');
    expect(landing).toContain("/auth?mode=signup&returnTo=${returnTo}");
  });
});
