import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  memberPushOnboardingDecision,
  memberPushRegistrationDecision,
} from "../../src/lib/memberPushInvite.ts";

const root = resolve(import.meta.dir, "../..");
const centerSource = readFileSync(
  resolve(root, "src/components/member/MemberNotificationCenter.tsx"),
  "utf8",
);
const onboardingSource = readFileSync(
  resolve(root, "src/components/member/MemberPushOnboarding.tsx"),
  "utf8",
);
const shellSource = readFileSync(resolve(root, "src/components/app-shell/AppShell.tsx"), "utf8");

describe("member Push permission onboarding", () => {
  test("does not trigger the native system permission prompt while the inbox loads", () => {
    expect(centerSource).not.toContain("void startMemberPushRegistration()");
    expect(centerSource).not.toContain("member_push_automatic_permission_failed");
  });

  test("mounts one branded permission experience after member login", () => {
    expect(shellSource).toContain("import { MemberPushOnboarding }");
    expect(shellSource).toContain('role === "member" && <MemberPushOnboarding');
    expect(onboardingSource).toContain("memberPushOnboardingDecision");
    expect(onboardingSource).toContain("onClick={enablePush}");
  });

  test("opens the native prompt only from the member's enable action", () => {
    expect(onboardingSource).toContain("await startMemberPushRegistration()");
    expect(onboardingSource).toContain("onClick={enablePush}");
    expect(onboardingSource).toContain("MEMBER_PUSH_INVITE_DISMISSED_AT_KEY");
    expect(onboardingSource).toContain("bootstrapMemberPushRegistration");
    expect(onboardingSource).toContain("getCurrentMemberPushToken");
    expect(onboardingSource).not.toContain("query.data?.hasActiveDevice");
  });

  test("invites only an eligible iPhone whose native permission is still undecided", () => {
    const eligible = {
      pushEnabled: true,
      isLoading: false,
      isNativeIos: true,
      permission: "prompt",
      hasRegisteredToken: false,
      dismissed: false,
    };
    expect(memberPushOnboardingDecision(eligible)).toBe("invite");
    expect(memberPushOnboardingDecision({ ...eligible, isNativeIos: false })).toBe("hidden");
    expect(memberPushOnboardingDecision({ ...eligible, pushEnabled: false })).toBe("hidden");
    expect(memberPushOnboardingDecision({ ...eligible, dismissed: true })).toBe("hidden");
    expect(memberPushOnboardingDecision({ ...eligible, hasRegisteredToken: true })).toBe("hidden");
    expect(memberPushOnboardingDecision({ ...eligible, permission: "denied" })).toBe("hidden");
  });

  test("bootstraps an existing grant and classifies registration outcomes", () => {
    expect(
      memberPushOnboardingDecision({
        pushEnabled: true,
        isLoading: false,
        isNativeIos: true,
        permission: "granted",
        hasRegisteredToken: false,
        dismissed: false,
      }),
    ).toBe("bootstrap");
    expect(memberPushRegistrationDecision({ ok: true })).toBe("enabled");
    expect(memberPushRegistrationDecision({ ok: false, skipped: "already_started" })).toBe(
      "enabled",
    );
    expect(memberPushRegistrationDecision({ ok: false, skipped: "permission_denied" })).toBe(
      "dismissed",
    );
    expect(memberPushRegistrationDecision({ ok: false, skipped: "permission_not_granted" })).toBe(
      "error",
    );
  });
});
