import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const centerSource = readFileSync(
  resolve(root, "src/components/member/MemberNotificationCenter.tsx"),
  "utf8",
);

describe("member Push permission onboarding", () => {
  test("requests native permission automatically for a consented signed-in member", () => {
    expect(centerSource).toContain("void startMemberPushRegistration()");
    expect(centerSource).toContain("query.data?.preferences.pushEnabled");
    expect(centerSource).not.toContain("shouldShowMemberPushInvite");
    expect(centerSource).not.toContain("onClick={enablePush}");
  });
});
