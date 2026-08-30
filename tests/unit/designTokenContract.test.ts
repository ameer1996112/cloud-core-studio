import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { contrastRatio, meetsNormalTextContrast } from "../../src/lib/design-token-contract";

describe("semantic visual tokens", () => {
  test("body text meets WCAG AA on light surfaces", () => {
    expect(contrastRatio("#24303c", "#fffdf8")).toBeGreaterThanOrEqual(4.5);
    expect(meetsNormalTextContrast("#a17012", "#fffdf8")).toBe(false);
  });

  test("focus colors remain visible on light and dark surfaces", () => {
    expect(contrastRatio("#0b63ce", "#fffdf8")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#8fc8ff", "#102436")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#8fc8ff", "#0b1d3a")).toBeGreaterThanOrEqual(3);
  });

  test("the canonical navy surface uses the dark focus token", () => {
    const tokens = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

    expect(tokens).toMatch(/\.surface-navy[^}]*--cc-focus-color:\s*var\(--cc-focus-color-dark\)/s);
  });
});
