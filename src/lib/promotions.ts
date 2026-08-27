import { supabase } from "@/integrations/supabase/client";
import { promotionEngagementSchema, type PromotionLanguage } from "@/lib/promotionCampaigns";

export type PromotionCopy = { eyebrow: string; title: string; body: string; cta: string };
export type MemberPromotion = {
  id: string;
  slug: string;
  promotionType: "announcement" | "free_class_credit";
  localizedContent: Record<PromotionLanguage, PromotionCopy>;
  actionUrl: string;
  priority: number;
  remaining: number;
  claimLimit: number;
  soldOut: boolean;
  claimedByCurrentUser: boolean;
  entitlementStatus: "active" | "reserved" | "consumed" | "revoked" | "expired" | null;
  creditAvailable: boolean;
  startsAt: string;
  endsAt: string;
  creditExpiresAt: string | null;
};

export type PromotionClaimResult = {
  status: "claimed" | "already_claimed" | "sold_out" | "ineligible" | "rate_limited" | "error";
  reason?: string;
  message?: string;
};

function storage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function persistentStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function idempotencyKey(promotionId: string, action: string) {
  const key = `cc:promotion:${promotionId}:${action}`;
  const existing = storage()?.getItem(key);
  if (existing) return existing;
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  storage()?.setItem(key, value);
  return value;
}

export async function fetchMemberPromotions(): Promise<MemberPromotion[]> {
  const { data, error } = await supabase.rpc("get_member_promotions" as never);
  if (error) throw error;
  return (data ?? []) as unknown as MemberPromotion[];
}

export async function fetchPublicPromotion(slug: string): Promise<MemberPromotion | null> {
  const { data, error } = await supabase.rpc(
    "get_public_promotion" as never,
    { p_slug: slug } as never,
  );
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as unknown as MemberPromotion),
    priority: 0,
    claimedByCurrentUser: false,
    entitlementStatus: null,
    creditAvailable: false,
  };
}

export async function capturePromotionAttribution(slug: string, search: string) {
  const params = new URLSearchParams(search);
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  const key = `cc:promotion:${slug}:attribution`;
  if (!utmSource && !utmMedium && !utmCampaign) return persistentStorage()?.getItem(key) ?? null;
  const { data, error } = await supabase.rpc("begin_promotion_attribution", {
    p_slug: slug,
    p_utm_source: utmSource,
    p_utm_medium: utmMedium,
    p_utm_campaign: utmCampaign,
  } as never);
  if (error) throw error;
  const token = typeof data === "string" ? data : null;
  if (token) persistentStorage()?.setItem(key, token);
  return token;
}

export async function claimPublicPromotion(promotion: MemberPromotion) {
  const token = persistentStorage()?.getItem(`cc:promotion:${promotion.slug}:attribution`) ?? null;
  const { data, error } = await supabase.rpc("claim_promotion", {
    p_slug: promotion.slug,
    p_attribution_token: token,
    p_idempotency_key: idempotencyKey(promotion.id, "public-claim"),
  } as never);
  if (error) return { status: "error", message: error.message } as PromotionClaimResult;
  return data as unknown as PromotionClaimResult;
}

export async function claimMemberPromotion(promotion: MemberPromotion) {
  await trackPromotionEngagement(promotion.slug, "claim_started", promotion.id);
  const { data, error } = await supabase.rpc("claim_promotion", {
    p_slug: promotion.slug,
    p_attribution_token: null,
    p_idempotency_key: idempotencyKey(promotion.id, "claim"),
  } as never);
  if (error) return { status: "error", message: error.message } as PromotionClaimResult;
  const result = data as unknown as PromotionClaimResult;
  if (result.status === "claimed" || result.status === "already_claimed") {
    await trackPromotionEngagement(promotion.slug, "claim_succeeded", promotion.id);
  }
  return result;
}

export async function trackPromotionEngagement(
  slug: string,
  eventType:
    | "impression"
    | "cta_clicked"
    | "dismissed"
    | "claim_started"
    | "claim_succeeded"
    | "booking_completed",
  promotionId: string,
  metadata: Record<string, unknown> = {},
) {
  const input = promotionEngagementSchema.parse({
    campaignId: promotionId,
    event: eventType,
    source: "in_app",
  });
  const { error } = await supabase.rpc(
    "track_promotion_engagement" as never,
    {
      p_slug: slug,
      p_event_type: input.event,
      p_channel: input.source,
      p_idempotency_key: idempotencyKey(promotionId, eventType),
      p_metadata: metadata,
    } as never,
  );
  if (error) throw error;
}
