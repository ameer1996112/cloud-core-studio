import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const styles = readFileSync(resolve(root, "src/styles/member.css"), "utf8");

describe("member home studio announcement", () => {
  test("lets the complete message wrap instead of clipping it at a fixed line count", () => {
    const announcementRules = [
      ...styles.matchAll(/\.member-announcement-bar__body\s*\{([^}]*)\}/g),
    ];

    expect(announcementRules.length).toBeGreaterThan(0);
    for (const [, declarations] of announcementRules) {
      expect(declarations).not.toContain("line-clamp");
      expect(declarations).not.toContain("overflow: hidden");
    }
  });
});
