import { describe, expect, test } from "bun:test";
import { shouldShowMemberPushInvite } from "../../src/lib/memberPushInvite.ts";

describe("member push invitation policy", () => {
  test("invites every loaded member without an active push device", () => {
    expect(
      shouldShowMemberPushInvite({
        isNativePlatform: true,
        isLoading: false,
        hasActiveDevice: false,
        dismissed: false,
      }),
    ).toBe(true);
  });

  test("stays hidden after registration, while loading, or after dismissal", () => {
    expect(
      shouldShowMemberPushInvite({
        isNativePlatform: true,
        isLoading: false,
        hasActiveDevice: true,
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowMemberPushInvite({
        isNativePlatform: true,
        isLoading: true,
        hasActiveDevice: false,
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowMemberPushInvite({
        isNativePlatform: true,
        isLoading: false,
        hasActiveDevice: false,
        dismissed: true,
      }),
    ).toBe(false);
  });

  test("does not advertise native push registration in the web app", () => {
    expect(
      shouldShowMemberPushInvite({
        isNativePlatform: false,
        isLoading: false,
        hasActiveDevice: false,
        dismissed: false,
      }),
    ).toBe(false);
  });
});
