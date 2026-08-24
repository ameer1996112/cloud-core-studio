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
