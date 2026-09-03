import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function firstAdminUserId() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("adult_trial_payment_no_admin_actor");
  return data.id;
}

export async function findAdultTrialPayment(paymentId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("adult_trial_payments")
    .select("id,reservation_id,amount,currency,method,provider,status")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    reservation_id: string;
    amount: number;
    currency: string;
    method: string;
    provider: string;
    status: string;
  } | null;
}

/**
 * Called only after a trusted HYP webhook or an independently verified HYP
 * return. A browser redirect itself is never passed as verified evidence.
 */
export async function confirmVerifiedAdultTrialHypPayment(input: {
  paymentId: string;
  providerPaymentId?: string | null;
  providerSessionId?: string | null;
  providerStatus?: string | null;
  providerAmount: number;
  providerCurrency: string;
  providerOrderId: string;
}) {
  const actorId = await firstAdminUserId();
  const { data, error } = await (supabaseAdmin as any).rpc("confirm_adult_trial_payment", {
    p_actor_id: actorId,
    p_payment_id: input.paymentId,
    p_verified: true,
    p_provider_payment_id: input.providerPaymentId ?? null,
    p_provider_session_id: input.providerSessionId ?? null,
    p_provider_status: input.providerStatus ?? "paid",
    p_provider_amount: input.providerAmount,
    p_provider_currency: input.providerCurrency,
    p_provider_order_id: input.providerOrderId,
  });
  if (error || !["paid", "already_paid"].includes(data?.status)) {
    throw error ?? new Error(data?.status ?? "adult_trial_payment_confirm_failed");
  }
  return data as { status: string; payment_id?: string };
}

export async function failAdultTrialHypPayment(paymentId: string, providerStatus: string) {
  const actorId = await firstAdminUserId();
  const { data, error } = await (supabaseAdmin as any).rpc("fail_adult_trial_payment", {
    p_actor_id: actorId,
    p_payment_id: paymentId,
    p_provider_status: providerStatus,
  });
  if (error) throw error;
  return data as { status: string };
}
