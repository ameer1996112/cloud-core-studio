import { z } from "zod";

const preferenceSchema = z
  .object({
    key: z.enum([
      "class_style",
      "time_window",
      "instructor",
      "location",
      "communication_pace",
      "member_intention",
      "onboarding_status",
    ]),
    value: z.string().trim().min(1).max(120),
  })
  .superRefine((preference, context) => {
    if (
      preference.key === "communication_pace" &&
      !["quiet", "balanced", "attentive"].includes(preference.value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Unsupported communication pace",
        path: ["value"],
      });
    }
    if (preference.key === "onboarding_status" && preference.value !== "deferred") {
      context.addIssue({
        code: "custom",
        message: "Unsupported onboarding status",
        path: ["value"],
      });
    }
  });

const pauseSchema = z.object({ paused: z.boolean() });

export type PersonalConciergePreferenceInput = z.infer<typeof preferenceSchema>;

export function parsePersonalConciergePreference(input: unknown) {
  return preferenceSchema.parse(input);
}

export function parsePersonalConciergePause(input: unknown) {
  return pauseSchema.parse(input);
}
