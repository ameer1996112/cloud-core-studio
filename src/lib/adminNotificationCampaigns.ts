import { z } from "zod";
import { safeNotificationActionUrl } from "@/lib/memberNotificationsApi";

const localizedCopySchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
});

export const campaignAudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_marketing") }),
  z.object({ kind: z.literal("never_booked") }),
  z.object({ kind: z.literal("no_upcoming") }),
  z.object({ kind: z.literal("inactive_14d") }),
  z.object({ kind: z.literal("low_credits") }),
  z.object({ kind: z.literal("expiring_7d") }),
  z.object({ kind: z.literal("specific"), memberIds: z.array(z.string().uuid()).min(1).max(500) }),
]);

export const adminNotificationCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["activation", "marketing", "retention", "schedule"]),
  localizedContent: z.object({
    he: localizedCopySchema,
    ar: localizedCopySchema,
    en: localizedCopySchema,
  }),
  actionUrl: z.string().transform(safeNotificationActionUrl),
  audience: campaignAudienceSchema,
  sendAt: z.string().datetime().nullable(),
});

export type CampaignAudience = z.infer<typeof campaignAudienceSchema>;
export type AdminNotificationCampaignInput = z.infer<typeof adminNotificationCampaignSchema>;

export type CampaignAudienceMember = {
  id: string;
  remainingCredits: number;
  lastVisitAt: string | null;
};

export function selectCampaignAudience<T extends CampaignAudienceMember>(input: {
  members: T[];
  audience: CampaignAudience;
  bookedMemberIds: Set<string>;
  upcomingMemberIds: Set<string>;
  expiringMemberIds: Set<string>;
  now: Date;
}) {
  const inactiveCutoff = input.now.getTime() - 14 * 86_400_000;
  const selectedIds = input.audience.kind === "specific" ? new Set(input.audience.memberIds) : null;

  return input.members.filter((member) => {
    switch (input.audience.kind) {
      case "all_marketing":
        return true;
      case "never_booked":
        return !input.bookedMemberIds.has(member.id);
      case "no_upcoming":
        return !input.upcomingMemberIds.has(member.id);
      case "inactive_14d": {
        if (!member.lastVisitAt) return true;
        const lastVisit = new Date(member.lastVisitAt).getTime();
        return !Number.isFinite(lastVisit) || lastVisit <= inactiveCutoff;
      }
      case "low_credits":
        return member.remainingCredits <= 2;
      case "expiring_7d":
        return input.expiringMemberIds.has(member.id);
      case "specific":
        return selectedIds?.has(member.id) ?? false;
    }
  });
}
