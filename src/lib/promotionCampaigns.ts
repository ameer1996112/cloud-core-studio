import { z } from "zod";
import { safeNotificationActionUrl } from "@/lib/memberNotificationsApi";

export const PROMOTION_LANGUAGES = ["he", "ar", "en"] as const;
export const PROMOTION_CHANNELS = ["in_app", "push", "whatsapp"] as const;
export const PROMOTION_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "ended",
  "archived",
] as const;

export type PromotionLanguage = (typeof PROMOTION_LANGUAGES)[number];
export type PromotionChannel = (typeof PROMOTION_CHANNELS)[number];
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

const localizedPromotionCopySchema = z.object({
  eyebrow: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  cta: z.string().trim().min(1).max(60),
});

const safePromotionActionUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => safeNotificationActionUrl(value) === value, "Unsafe promotion destination");

const whatsappTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/),
  status: z.enum(["pending", "approved", "rejected"]),
});

export const promotionAudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all_marketing") }),
  z.object({ kind: z.literal("never_booked") }),
  z.object({ kind: z.literal("no_upcoming") }),
  z.object({ kind: z.literal("inactive_14d") }),
  z.object({ kind: z.literal("low_credits") }),
  z.object({ kind: z.literal("expiring_7d") }),
  z.object({ kind: z.literal("not_attended_program") }),
  z.object({
    kind: z.literal("specific"),
    memberIds: z.array(z.string().uuid()).min(1).max(500),
  }),
]);

export const promotionCampaignDraftSchema = z.object({
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  promotionType: z.enum(["announcement", "free_class_credit"]),
  localizedContent: z.object({
    he: localizedPromotionCopySchema,
    ar: localizedPromotionCopySchema,
    en: localizedPromotionCopySchema,
  }),
  actionUrl: safePromotionActionUrlSchema,
  audience: promotionAudienceSchema,
  channels: z.array(z.enum(PROMOTION_CHANNELS)).min(1).max(PROMOTION_CHANNELS.length),
  public: z.boolean(),
  featured: z.boolean(),
  priority: z.number().int().min(0).max(100),
  claimLimit: z.number().int().positive().max(100_000).nullable().optional(),
  creditQuantity: z.number().int().min(1).max(10).nullable().optional(),
  eligibleProgramTypeIds: z.array(z.string().uuid()).max(100),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  creditExpiresAt: z.string().datetime({ offset: true }).nullable(),
  whatsappTemplates: z
    .object({ he: whatsappTemplateSchema, ar: whatsappTemplateSchema, en: whatsappTemplateSchema })
    .nullable(),
});

export type PromotionCampaignDraft = z.infer<typeof promotionCampaignDraftSchema>;
export type PromotionAudience = z.infer<typeof promotionAudienceSchema>;

type ActivationCandidate = Pick<
  PromotionCampaignDraft,
  | "promotionType"
  | "localizedContent"
  | "channels"
  | "eligibleProgramTypeIds"
  | "claimLimit"
  | "creditQuantity"
  | "startsAt"
  | "endsAt"
  | "creditExpiresAt"
  | "whatsappTemplates"
> & {
  audiencePreviewedAt: string | null;
  testSentAt: string | null;
};

export function validatePromotionForActivation(input: ActivationCandidate) {
  const errors: string[] = [];
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    errors.push("campaign_window_invalid");
  }
  if (input.promotionType === "free_class_credit") {
    if (!input.eligibleProgramTypeIds.length) errors.push("eligible_program_required");
    if (!input.claimLimit || input.claimLimit < 1) errors.push("claim_limit_required");
    if (!input.creditQuantity || input.creditQuantity < 1) errors.push("credit_quantity_required");
    const creditExpiresAt = input.creditExpiresAt
      ? new Date(input.creditExpiresAt).getTime()
      : Number.NaN;
    if (!Number.isFinite(creditExpiresAt) || creditExpiresAt <= endsAt) {
      errors.push("credit_expiry_must_follow_campaign");
    }
  }
  if (input.channels.includes("whatsapp")) {
    for (const language of PROMOTION_LANGUAGES) {
      if (input.whatsappTemplates?.[language]?.status !== "approved") {
        errors.push(`whatsapp_template_${language}_not_approved`);
      }
    }
  }
  if (!input.audiencePreviewedAt) errors.push("audience_preview_required");
  if (!input.testSentAt) errors.push("test_send_required");
  return { ok: errors.length === 0, errors };
}

type LifecycleCampaign = {
  status: PromotionStatus;
  startsAt: string;
  endsAt: string;
};

export function promotionLifecycle(
  campaign: LifecycleCampaign,
  now = new Date(),
): PromotionStatus {
  if (["draft", "paused", "archived"].includes(campaign.status)) return campaign.status;
  const at = now.getTime();
  if (at < new Date(campaign.startsAt).getTime()) return "scheduled";
  if (at >= new Date(campaign.endsAt).getTime()) return "ended";
  return "active";
}

type PromotionAudienceMember = {
  id: string;
  status: string;
  remainingCredits?: number;
  lastVisitAt?: string | null;
};

export function selectPromotionAudience<T extends PromotionAudienceMember>(input: {
  members: T[];
  audience: PromotionAudience;
  eligibleProgramTypeIds: string[];
  attendedProgramTypeIdsByMember: Map<string, Set<string>>;
  bookedMemberIds?: Set<string>;
  upcomingMemberIds?: Set<string>;
  expiringMemberIds?: Set<string>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const inactiveCutoff = now.getTime() - 14 * 86_400_000;
  const selectedIds =
    input.audience.kind === "specific" ? new Set(input.audience.memberIds) : null;

  return input.members.filter((member) => {
    if (member.status !== "active") return false;
    switch (input.audience.kind) {
      case "all_marketing":
        return true;
      case "never_booked":
        return !input.bookedMemberIds?.has(member.id);
      case "no_upcoming":
        return !input.upcomingMemberIds?.has(member.id);
      case "inactive_14d": {
        if (!member.lastVisitAt) return true;
        const lastVisit = new Date(member.lastVisitAt).getTime();
        return !Number.isFinite(lastVisit) || lastVisit <= inactiveCutoff;
      }
      case "low_credits":
        return (member.remainingCredits ?? 0) <= 2;
      case "expiring_7d":
        return input.expiringMemberIds?.has(member.id) ?? false;
      case "not_attended_program": {
        const attended = input.attendedProgramTypeIdsByMember.get(member.id) ?? new Set<string>();
        return input.eligibleProgramTypeIds.every((programTypeId) => !attended.has(programTypeId));
      }
      case "specific":
        return selectedIds?.has(member.id) ?? false;
    }
  });
}

type FeaturedCampaign = LifecycleCampaign & {
  id: string;
  priority: number;
  featured: boolean;
};

export function selectFeaturedPromotion<T extends FeaturedCampaign>(input: {
  campaigns: T[];
  dismissedCampaignIds: Set<string>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.campaigns
    .filter(
      (campaign) =>
        campaign.featured &&
        !input.dismissedCampaignIds.has(campaign.id) &&
        promotionLifecycle(campaign, now) === "active",
    )
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime(),
    )[0];
}

type PromotionDeliveryInput = {
  requestedChannels: PromotionChannel[];
  marketingConsent: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  hasActivePushDevice: boolean;
  hasWhatsappNumber: boolean;
  promotionalContactsToday: number;
  promotionalContactsThisWeek: number;
  whatsappTemplateApproved: boolean;
};

export function resolvePromotionDeliveryChannels(input: PromotionDeliveryInput) {
  const deliver: PromotionChannel[] = [];
  const suppressed: Partial<Record<Exclude<PromotionChannel, "in_app">, string>> = {};
  if (input.requestedChannels.includes("in_app")) deliver.push("in_app");

  const frequencyLimited =
    input.promotionalContactsToday >= 1 || input.promotionalContactsThisWeek >= 3;
  if (input.requestedChannels.includes("push")) {
    const reason = !input.marketingConsent
      ? "marketing_consent"
      : !input.pushEnabled
        ? "push_disabled"
        : !input.hasActivePushDevice
          ? "no_active_push_device"
          : frequencyLimited
            ? "frequency_limited"
            : null;
    if (reason) suppressed.push = reason;
    else deliver.push("push");
  }
  if (input.requestedChannels.includes("whatsapp")) {
    const reason = !input.marketingConsent
      ? "marketing_consent"
      : !input.whatsappEnabled
        ? "whatsapp_disabled"
        : !input.hasWhatsappNumber
          ? "missing_whatsapp_number"
          : !input.whatsappTemplateApproved
            ? "whatsapp_template_not_approved"
            : frequencyLimited
              ? "frequency_limited"
              : null;
    if (reason) suppressed.whatsapp = reason;
    else deliver.push("whatsapp");
  }
  return { deliver, suppressed };
}

const safeUtmValue = z.string().trim().min(1).max(200).regex(/^[\p{L}\p{N} _.-]+$/u);

export const promotionEngagementSchema = z.object({
  campaignId: z.string().uuid(),
  event: z.enum([
    "impression",
    "cta_clicked",
    "dismissed",
    "claim_started",
    "claim_succeeded",
    "booking_completed",
  ]),
  source: z.enum(["in_app", "push", "whatsapp", "public_link"]),
  utm: z
    .object({
      source: safeUtmValue.optional(),
      medium: safeUtmValue.optional(),
      campaign: safeUtmValue.optional(),
    })
    .optional(),
});

export type PromotionEngagement = z.infer<typeof promotionEngagementSchema>;
