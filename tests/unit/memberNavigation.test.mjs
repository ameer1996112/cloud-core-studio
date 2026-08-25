import { afterEach, describe, expect, test } from "bun:test";
import { applyLang } from "../../src/lib/i18n.ts";
import { bottomTabsForRole, isActive } from "../../src/components/app-shell/useRoleNav.ts";

afterEach(() => applyLang("he"));

describe("member navigation", () => {
  test("keeps five stable member destinations", () => {
    applyLang("en");
    expect(bottomTabsForRole("member").map((item) => item.to)).toEqual([
      "/member",
      "/member/schedule",
      "/member/bookings",
      "/member/packages",
      "/member/account",
    ]);
  });

  test("uses concise booking labels in all languages", () => {
    applyLang("he");
    expect(bottomTabsForRole("member")[2].label).toBe("הזמנות");
    applyLang("ar");
    expect(bottomTabsForRole("member")[2].label).toBe("الحجوزات");
  });

  test("marks only the exact home route active", () => {
    applyLang("en");
    const home = bottomTabsForRole("member")[0];
    expect(isActive("/member", home)).toBe(true);
    expect(isActive("/member/schedule", home)).toBe(false);
  });
});
