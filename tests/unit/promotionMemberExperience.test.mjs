import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const hook = readFileSync(new URL("../../src/hooks/useYogaPromo.ts", import.meta.url), "utf8");
const home = readFileSync(
  new URL("../../src/routes/_authenticated/member/index.tsx", import.meta.url),
  "utf8",
);
const schedule = readFileSync(
  new URL("../../src/routes/member.schedule.tsx", import.meta.url),
  "utf8",
);

describe("member promotion experience", () => {
  test("never claims a promotion automatically", () => {
    expect(hook).not.toContain("autoClaim");
    expect(hook).not.toContain("autoClaimAttempted");
    expect(hook).toContain("claim.mutate");
  });

  test("features the promotion on member home instead of interrupting the schedule", () => {
    expect(home).toContain("PromotionCard");
    expect(home).toContain("usePromotions");
    expect(schedule).not.toContain("YogaPromoBanner");
  });

  test("uses an explicit localized claim action before schedule handoff", () => {
    const banner = readFileSync(
      new URL("../../src/components/member/YogaPromoBanner.tsx", import.meta.url),
      "utf8",
    );
    expect(banner).toContain("onClaim?.()");
    expect(banner).toContain("data-promo-state={state}");
    expect(banner).toContain('to="/member/schedule"');
  });
});
