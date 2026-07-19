import { describe, expect, test } from "bun:test";
import {
  evaluateIosUpdateRequirement,
  readPublicAppUpdatePolicy,
} from "../../src/lib/appUpdatePolicy.ts";

describe("mandatory iOS app updates", () => {
  test("never blocks an installed app while enforcement is disabled", () => {
    expect(
      evaluateIosUpdateRequirement({
        enforcementEnabled: false,
        minimumVersion: "1.0.5",
        installedVersion: null,
        isNative: true,
        platform: "ios",
      }),
    ).toEqual({ required: false, reason: "disabled" });
  });

  test("blocks an iOS app below the configured minimum version", () => {
    expect(
      evaluateIosUpdateRequirement({
        enforcementEnabled: true,
        minimumVersion: "1.0.5",
        installedVersion: "1.0.4",
        isNative: true,
        platform: "ios",
      }),
    ).toEqual({ required: true, reason: "outdated" });
  });

  test("allows the minimum version and compares version segments numerically", () => {
    const requirement = (installedVersion) =>
      evaluateIosUpdateRequirement({
        enforcementEnabled: true,
        minimumVersion: "1.0.5",
        installedVersion,
        isNative: true,
        platform: "ios",
      });

    expect(requirement("1.0.5")).toEqual({ required: false, reason: "current" });
    expect(requirement("1.0.10")).toEqual({ required: false, reason: "current" });
  });

  test("blocks a legacy iOS binary that cannot report its installed version", () => {
    expect(
      evaluateIosUpdateRequirement({
        enforcementEnabled: true,
        minimumVersion: "1.0.5",
        installedVersion: null,
        isNative: true,
        platform: "ios",
      }),
    ).toEqual({ required: true, reason: "legacy_build" });
  });

  test("never blocks the website or a non-iOS native app", () => {
    const policy = {
      enforcementEnabled: true,
      minimumVersion: "1.0.5",
      installedVersion: null,
    };

    expect(evaluateIosUpdateRequirement({ ...policy, isNative: false, platform: "web" })).toEqual({
      required: false,
      reason: "not_ios",
    });
    expect(
      evaluateIosUpdateRequirement({ ...policy, isNative: true, platform: "android" }),
    ).toEqual({ required: false, reason: "not_ios" });
  });

  test("fails open unless enforcement and a valid minimum version are both configured", () => {
    expect(
      readPublicAppUpdatePolicy({
        IOS_FORCE_UPDATE_ENABLED: "true",
        IOS_MINIMUM_APP_VERSION: "not-a-version",
      }),
    ).toEqual({
      enforcementEnabled: false,
      minimumVersion: "0.0.0",
      appStoreUrl: "https://apps.apple.com/il/app/cloud-core/id6786035836",
    });

    expect(
      readPublicAppUpdatePolicy({
        IOS_FORCE_UPDATE_ENABLED: "true",
        IOS_MINIMUM_APP_VERSION: "1.0.5",
        APP_STORE_URL: "https://apps.apple.com/il/app/cloud-core/id6786035836?campaign=update",
      }),
    ).toEqual({
      enforcementEnabled: true,
      minimumVersion: "1.0.5",
      appStoreUrl: "https://apps.apple.com/il/app/cloud-core/id6786035836?campaign=update",
    });
  });
});
