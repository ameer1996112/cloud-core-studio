import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");

describe("app marketing assets", () => {
  const pngSize = (file) => {
    const bytes = readFileSync(file);
    expect(bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))).toBe(true);
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  };

  test("ships five distinct readable localized phone captures per language", () => {
    for (const lang of ["he", "ar", "en"]) {
      const hashes = new Set();
      for (const name of ["schedule", "booking", "bookings", "membership", "account"]) {
        const file = resolve(root, `public/images/app-marketing/${lang}/${name}.png`);
        expect(existsSync(file)).toBe(true);
        if (!existsSync(file)) continue;
        expect(pngSize(file)).toEqual({ width: 390, height: 844 });
        expect(statSync(file).size).toBeGreaterThan(20_000);
        hashes.add(createHash("sha256").update(readFileSync(file)).digest("hex"));
      }
      expect(hashes.size).toBe(5);
    }
  });

  test("ships localized 1200 by 630 social cards", () => {
    for (const lang of ["he", "ar", "en"]) {
      const file = resolve(root, `public/images/app-marketing/social/${lang}.png`);
      expect(existsSync(file)).toBe(true);
      if (!existsSync(file)) continue;
      expect(pngSize(file)).toEqual({ width: 1200, height: 630 });
      expect(statSync(file).size).toBeGreaterThan(35_000);
    }
  });

  test("keeps capture-only code outside the production route and data layers", () => {
    const fixtureDirectory = resolve(root, "tests/fixtures/app-marketing");
    const fixture = resolve(fixtureDirectory, "main.tsx");
    const captureScript = resolve(root, "scripts/capture-app-marketing-assets.py");
    const fixtureViteConfig = resolve(fixtureDirectory, "vite.config.ts");

    for (const file of [fixture, captureScript, fixtureViteConfig]) {
      expect(existsSync(file)).toBe(true);
    }
    if (![fixture, captureScript, fixtureViteConfig].every(existsSync)) return;

    const fixtureSource = readFileSync(fixture, "utf8");
    const captureSource = readFileSync(captureScript, "utf8");
    const productionRouteSources = [
      resolve(root, "src/routeTree.gen.ts"),
      resolve(root, "src/router.tsx"),
      resolve(root, "vite.config.ts"),
    ]
      .filter(existsSync)
      .map((file) => readFileSync(file, "utf8"));

    expect(fixture.startsWith(resolve(root, "tests/fixtures"))).toBe(true);
    expect(fixtureSource).toContain("MARKETING_CAPTURE_FIXTURE");
    expect(fixtureSource).toContain("import.meta.env.PROD");
    expect(captureSource).toContain("NODE_ENV=production");
    expect(captureSource).toContain("route");
    expect(captureSource).toContain("abort");
    expect(fixtureSource + captureSource).not.toMatch(
      /supabase|service[_-]?role|loadEnv|process\.env|dotenv|fetch\(|axios|postgres|database|customer/i,
    );
    expect(fixtureSource + captureSource).not.toMatch(/generic woman|woman stock|stock photo/i);
    expect(productionRouteSources.join("\n")).not.toContain("tests/fixtures/app-marketing");
  });

  test("documents the production asset contract without changing its explicit dimensions", () => {
    const marketingContract = readFileSync(resolve(root, "src/lib/app-marketing.ts"), "utf8");
    expect(marketingContract).toContain("SCREENSHOT_ALTS");
    expect(marketingContract).toContain("width: 390 as const");
    expect(marketingContract).toContain("height: 844 as const");
    expect(marketingContract).toContain("/images/app-marketing/social/");
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
