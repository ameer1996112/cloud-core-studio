import { describe, expect, test } from "bun:test";
import {
  parsePersonalConciergePreference,
  parsePersonalConciergePause,
} from "../../src/lib/personalConciergePreferences.ts";

describe("member-controlled Concierge memory", () => {
  test("accepts only explicit, supported member preferences", () => {
    expect(
      parsePersonalConciergePreference({
        key: "communication_pace",
        value: "quiet",
      }),
    ).toEqual({ key: "communication_pace", value: "quiet" });
    expect(() =>
      parsePersonalConciergePreference({
        key: "communication_pace",
        value: "marketing",
      }),
    ).toThrow();
    expect(
      parsePersonalConciergePreference({
        key: "onboarding_status",
        value: "deferred",
      }),
    ).toEqual({ key: "onboarding_status", value: "deferred" });
    expect(() =>
      parsePersonalConciergePreference({ key: "health_condition", value: "injury" }),
    ).toThrow();
  });

  test("requires an explicit boolean to pause personalization", () => {
    expect(parsePersonalConciergePause({ paused: true })).toEqual({ paused: true });
    expect(() => parsePersonalConciergePause({ paused: "true" })).toThrow();
  });
});
