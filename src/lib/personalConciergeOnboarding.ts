import { z } from "zod";

const onboardingChoiceSchema = z.enum(["quiet", "balanced", "attentive"]);

type PreferenceEvidence = {
  preference_key: string;
  preference_value: string;
};

type OnboardingInput = {
  conciergeAvailable: boolean;
  hasUpcomingBooking: boolean;
  hasAttended: boolean;
  preferences: PreferenceEvidence[];
};

export type PersonalConciergeOnboardingChoice = z.infer<typeof onboardingChoiceSchema>;

export function parsePersonalConciergeOnboardingChoice(input: unknown) {
  return onboardingChoiceSchema.parse(input);
}

export function personalConciergeOnboardingPreference(
  resolution: { kind: "choice"; choice: PersonalConciergeOnboardingChoice } | { kind: "deferred" },
) {
  return resolution.kind === "choice"
    ? {
        key: "communication_pace" as const,
        value: parsePersonalConciergeOnboardingChoice(resolution.choice),
      }
    : { key: "onboarding_status" as const, value: "deferred" as const };
}

export function resolvePersonalConciergeOnboarding(input: OnboardingInput) {
  const defaultChoice: PersonalConciergeOnboardingChoice = "balanced";

  if (!input.conciergeAvailable) {
    return { visible: false, defaultChoice, reason: "concierge_unavailable" as const };
  }
  if (!input.hasUpcomingBooking) {
    return { visible: false, defaultChoice, reason: "no_upcoming_booking" as const };
  }
  if (input.hasAttended) {
    return { visible: false, defaultChoice, reason: "member_already_attended" as const };
  }
  if (input.preferences.some((preference) => preference.preference_key === "onboarding_status")) {
    return { visible: false, defaultChoice, reason: "onboarding_deferred" as const };
  }
  if (input.preferences.some((preference) => preference.preference_key === "communication_pace")) {
    return {
      visible: false,
      defaultChoice,
      reason: "communication_preference_already_resolved" as const,
    };
  }

  return {
    visible: true,
    defaultChoice,
    reason: "first_booking_without_communication_preference" as const,
  };
}
