import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { updateHypRecurringAgreementStatus } = await import("@/lib/hyp.server");
    const { data: subscription, error: findError } = await (supabaseAdmin as any)
      .from("member_subscriptions")
      .select("id,status,provider,provider_subscription_id,metadata")
      .eq("member_id", context.userId)
      .in("status", ["active", "past_due", "incomplete"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (!subscription) return { status: "not_found" as const };
    if (subscription.provider !== "hyp") {
      throw new Error("subscription_provider_id_missing");
    }
    const management = String(subscription.metadata?.subscription_management ?? "hyp_managed_hk");
    if (management !== "hyp_merchant_token") {
      if (!subscription.provider_subscription_id)
        throw new Error("subscription_provider_id_missing");
      await updateHypRecurringAgreementStatus(subscription.provider_subscription_id, "terminate");
    }

    const now = new Date().toISOString();
    const { error: updateError } = await (supabaseAdmin as any)
      .from("member_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
        failure_reason: null,
      })
      .eq("id", subscription.id)
      .eq("member_id", context.userId);
    if (updateError) throw updateError;

    return { status: "cancelled" as const, subscription_id: subscription.id };
  });
