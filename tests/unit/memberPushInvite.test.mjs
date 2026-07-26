import { describe, expect, test } from "bun:test";
import {
  isMemberPushInviteDismissed,
  shouldShowMemberPushInvite,
} from "../../src/lib/memberPushInvite.ts";

function decide(overrides = {}) {
  return shouldShowMemberPushInvite({
    isNativeIos: true,
    isLoading: false,
    isBootstrapPending: false,
    isRegistrationPending: false,
    hasActiveDevice: false,
    dismissed: false,
    ...overrides,
  });
}

describe("member push invitation policy", () => {
  test("invites every loaded member without an active push device", () => {
    expect(decide()).toBe(true);
  });

  test("stays hidden after registration, while loading, or after dismissal", () => {
    expect(decide({ hasActiveDevice: true })).toBe(false);
    expect(decide({ isLoading: true })).toBe(false);
    expect(decide({ isBootstrapPending: true })).toBe(false);
    expect(decide({ isRegistrationPending: true })).toBe(false);
    expect(decide({ dismissed: true })).toBe(false);
  });

  test("does not advertise native push registration in the web app", () => {
    expect(decide({ isNativeIos: false })).toBe(false);
  });

  test("respects a dismissal for seven days, then invites again", () => {
    const now = Date.parse("2026-07-25T12:00:00Z");
    expect(isMemberPushInviteDismissed(String(now - 6 * 86_400_000), now)).toBe(true);
    expect(isMemberPushInviteDismissed(String(now - 7 * 86_400_000), now)).toBe(false);
    expect(isMemberPushInviteDismissed("invalid", now)).toBe(false);
  });
});
