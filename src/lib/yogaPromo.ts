import { supabase } from "@/integrations/supabase/client";

export const YOGA_PROMO_SLUG = "yoga-lina-launch";
export const YOGA_PROMO_PATH = "/promo/yoga-lina";
export const YOGA_PROMO_CAMPAIGN_URL =
  "https://cloudandcorestudio.com/promo/yoga-lina?utm_source=instagram&utm_medium=dm&utm_campaign=yoga_lina_launch";
export const YOGA_PROMO_ATTRIBUTION_KEY = "cc:yoga-lina-launch:attribution";
export const YOGA_PROMO_IDEMPOTENCY_KEY = "cc:yoga-lina-launch:idempotency";

export type YogaPromoStatus = {
  active: boolean;
  remaining: number;
  claimLimit: number;
  claimedByCurrentUser: boolean;
  entitlementStatus: "active" | "reserved" | "consumed" | "revoked" | "expired" | null;
  creditAvailable: boolean;
  eligible: boolean;
  soldOut: boolean;
  startsAt: string | null;
  endsAt: string | null;
  creditExpiresAt: string | null;
  eligibleClassTypeId: string | null;
  eligibleClassTypeName: string | null;
};

export type YogaPromoClaimResult = {
  status: "claimed" | "already_claimed" | "sold_out" | "ineligible" | "rate_limited" | "error";
  reason?: string;
  message?: string;
  claimId?: string;
  entitlementId?: string;
  remaining?: number;
};

function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getYogaPromoAttributionToken() {
  return storage()?.getItem(YOGA_PROMO_ATTRIBUTION_KEY) ?? null;
}

export async function captureYogaPromoAttribution(search: string) {
  const params = new URLSearchParams(search);
  if (
    params.get("utm_source") !== "instagram" ||
    params.get("utm_medium") !== "dm" ||
    params.get("utm_campaign") !== "yoga_lina_launch"
  ) {
    return getYogaPromoAttributionToken();
  }
  const { data, error } = await supabase.rpc("begin_promotion_attribution", {
    p_slug: YOGA_PROMO_SLUG,
    p_utm_source: "instagram",
    p_utm_medium: "dm",
    p_utm_campaign: "yoga_lina_launch",
  } as never);
  if (error) throw error;
  const token = typeof data === "string" ? data : null;
  if (token) storage()?.setItem(YOGA_PROMO_ATTRIBUTION_KEY, token);
  return token;
}

export async function fetchYogaPromoStatus(): Promise<YogaPromoStatus> {
  const { data, error } = await supabase.rpc("get_promotion_status", {
    p_slug: YOGA_PROMO_SLUG,
    p_attribution_token: getYogaPromoAttributionToken(),
  } as never);
  if (error) throw error;
  return data as unknown as YogaPromoStatus;
}

function getIdempotencyKey() {
  const existing = storage()?.getItem(YOGA_PROMO_IDEMPOTENCY_KEY);
  if (existing) return existing;
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  storage()?.setItem(YOGA_PROMO_IDEMPOTENCY_KEY, value);
  return value;
}

export async function claimYogaPromo(): Promise<YogaPromoClaimResult> {
  const token = getYogaPromoAttributionToken();
  const { data, error } = await supabase.rpc("claim_promotion", {
    p_slug: YOGA_PROMO_SLUG,
    p_attribution_token: token,
    p_idempotency_key: getIdempotencyKey(),
  } as never);
  if (error) return { status: "error", message: error.message };
  return data as unknown as YogaPromoClaimResult;
}

export type YogaPromoEventName =
  | "yoga_promo_landing_viewed"
  | "yoga_promo_banner_viewed"
  | "yoga_promo_cta_clicked"
  | "yoga_promo_signup_started"
  | "yoga_promo_signup_completed"
  | "yoga_promo_claim_succeeded"
  | "yoga_promo_claim_already_exists"
  | "yoga_promo_claim_ineligible"
  | "yoga_promo_claim_sold_out"
  | "yoga_promo_credit_viewed"
  | "yoga_promo_booking_started"
  | "yoga_promo_credit_reserved"
  | "yoga_promo_credit_redeemed"
  | "yoga_promo_credit_restored"
  | "yoga_promo_credit_expired";

export function trackYogaPromo(event: YogaPromoEventName, detail: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = { event, campaign_slug: YOGA_PROMO_SLUG, ...detail };
  window.dispatchEvent(new CustomEvent("cloudcore:analytics", { detail: payload }));
  const analyticsWindow = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  analyticsWindow.dataLayer?.push(payload);
}
