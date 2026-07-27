import { z } from "zod";

const preferenceSchema = z.object({
  key: z.enum([
    "class_style",
    "time_window",
    "instructor",
    "location",
    "communication_pace",
    "member_intention",
  ]),
  value: z.string().trim().min(1).max(120),
});

const pauseSchema = z.object({ paused: z.boolean() });

export type PersonalConciergePreferenceInput = z.infer<typeof preferenceSchema>;

export function parsePersonalConciergePreference(input: unknown) {
  return preferenceSchema.parse(input);
}

export function parsePersonalConciergePause(input: unknown) {
  return pauseSchema.parse(input);
}
