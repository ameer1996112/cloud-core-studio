import { describe, expect, test } from "bun:test";
import {
  resolvePersonalConciergeOnboarding,
  parsePersonalConciergeOnboardingChoice,
} from "../../src/lib/personalConciergeOnboarding.ts";

describe("personal Concierge onboarding", () => {
  test("offers optional personalization after a member's first booking", () => {
    expect(
      resolvePersonalConciergeOnboarding({
        conciergeAvailable: true,
        hasUpcomingBooking: true,
        hasAttended: false,
        preferences: [],
      }),
    ).toEqual({
      visible: true,
      defaultChoice: "balanced",
      reason: "first_booking_without_communication_preference",
    });
  });

  test("does not interrupt members who already chose or deferred", () => {
    expect(
      resolvePersonalConciergeOnboarding({
        conciergeAvailable: true,
        hasUpcomingBooking: true,
        hasAttended: false,
        preferences: [{ preference_key: "communication_pace", preference_value: "balanced" }],
      }),
    ).toEqual({
      visible: false,
      defaultChoice: "balanced",
      reason: "communication_preference_already_resolved",
    });
  });

  test("does not show before a booking, after attendance, or outside the rollout", () => {
    const base = {
      conciergeAvailable: true,
      hasUpcomingBooking: true,
      hasAttended: false,
      preferences: [],
    };

    expect(resolvePersonalConciergeOnboarding({ ...base, conciergeAvailable: false }).visible).toBe(
      false,
    );
    expect(resolvePersonalConciergeOnboarding({ ...base, hasUpcomingBooking: false }).visible).toBe(
      false,
    );
    expect(resolvePersonalConciergeOnboarding({ ...base, hasAttended: true }).visible).toBe(false);
  });

  test("accepts only the three one-tap communication choices", () => {
    expect(parsePersonalConciergeOnboardingChoice("quiet")).toBe("quiet");
    expect(parsePersonalConciergeOnboardingChoice("balanced")).toBe("balanced");
    expect(parsePersonalConciergeOnboardingChoice("attentive")).toBe("attentive");
    expect(() => parsePersonalConciergeOnboardingChoice("marketing")).toThrow();
  });
});
