import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  resolvePersonalConciergeOnboarding,
  parsePersonalConciergeOnboardingChoice,
  personalConciergeOnboardingPreference,
} from "../../src/lib/personalConciergeOnboarding.ts";

describe("personal Concierge onboarding", () => {
  test("keeps deferred onboarding within the existing preference evidence table", () => {
    const migration = readFileSync(
      new URL(
        "../../supabase/migrations/20260727190000_personal_concierge_onboarding_status.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("'onboarding_status'");
    expect(migration).not.toContain("CREATE TABLE");
  });

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

    expect(
      resolvePersonalConciergeOnboarding({
        conciergeAvailable: true,
        hasUpcomingBooking: true,
        hasAttended: false,
        preferences: [{ preference_key: "onboarding_status", preference_value: "deferred" }],
      }),
    ).toEqual({
      visible: false,
      defaultChoice: "balanced",
      reason: "onboarding_deferred",
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

  test("persists a choice separately from a deferred onboarding", () => {
    expect(personalConciergeOnboardingPreference({ kind: "choice", choice: "attentive" })).toEqual({
      key: "communication_pace",
      value: "attentive",
    });
    expect(personalConciergeOnboardingPreference({ kind: "deferred" })).toEqual({
      key: "onboarding_status",
      value: "deferred",
    });
  });
});
