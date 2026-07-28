import { describe, expect, test } from "bun:test";
import { resolveMemberProfileLanguage } from "../../src/lib/memberProfileLanguage.ts";

describe("member profile language", () => {
  test("shows the persisted notification language instead of the interface language", () => {
    expect(resolveMemberProfileLanguage(undefined, "en", "he")).toBe("en");
  });

  test("keeps an unsaved selection visible before it is persisted", () => {
    expect(resolveMemberProfileLanguage("ar", "en", "he")).toBe("ar");
  });

  test("uses the interface language only when the member has no saved preference", () => {
    expect(resolveMemberProfileLanguage(undefined, null, "he")).toBe("he");
  });
});
