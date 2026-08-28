import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const hook = readFileSync(new URL("../../src/hooks/usePromotions.ts", import.meta.url), "utf8");
const home = readFileSync(
  new URL("../../src/routes/_authenticated/member/index.tsx", import.meta.url),
  "utf8",
);
const schedule = readFileSync(
  new URL("../../src/routes/member.schedule.tsx", import.meta.url),
  "utf8",
);
const memberLayout = readFileSync(
  new URL("../../src/routes/_authenticated/member/route.tsx", import.meta.url),
  "utf8",
);
const publicPromotion = readFileSync(
  new URL("../../src/routes/promo.$slug.tsx", import.meta.url),
  "utf8",
);
const classDetail = readFileSync(
  new URL("../../src/components/member/ClassDetailSheet.tsx", import.meta.url),
  "utf8",
);
const promotionCard = readFileSync(
  new URL("../../src/components/member/PromotionCard.tsx", import.meta.url),
  "utf8",
);

describe("member promotion experience", () => {
  test("never claims a promotion automatically", () => {
    expect(hook).not.toContain("autoClaim");
    expect(hook).not.toContain("autoClaimAttempted");
    expect(hook).toContain("mutationFn: claimMemberPromotion");
  });

  test("features the promotion on member home instead of interrupting the schedule", () => {
    expect(home).toContain("PromotionCard");
    expect(home).toContain("usePromotions");
    expect(schedule).not.toContain("YogaPromoBanner");
    expect(memberLayout).not.toContain("YogaPromoBanner");
    expect(memberLayout).not.toContain("autoClaim");
    expect(classDetail).not.toContain("YogaPromoBanner");
  });

  test("shows an explicit localized confirmation before the filtered schedule handoff", () => {
    expect(publicPromotion).toContain("Benefit ready");
    expect(publicPromotion).toContain("ההטבה מוכנה");
    expect(publicPromotion).toContain("العرض جاهز");
    expect(publicPromotion).toContain("promotion.data.actionUrl");
    expect(schedule).toContain("!programs.includes(c.program_type?.slug)");
    expect(schedule).toContain('.split(",")');
    expect(publicPromotion).toContain("applyLang(requestedLang)");
  });

  test("keeps the promotion card localized and resilient to analytics failures", () => {
    expect(promotionCard).toContain('lang === "he" ? "סגירת המבצע"');
    expect(promotionCard).toContain('lang === "ar" ? "إغلاق العرض"');
    expect(promotionCard).toContain("aria-label={dismissLabel}");
    expect(promotionCard.match(/\.catch\(\(\) => null\)/g)).toHaveLength(3);
    expect(promotionCard).not.toContain("!text-[#fff8e9]");
  });
});
