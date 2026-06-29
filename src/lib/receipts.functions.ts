import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

/** Member: list my own receipts. RLS enforces ownership. */
export const listMyReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("receipts")
      .select(
        "id, receipt_number, receipt_type, amount, currency, plan_name_snapshot, method_snapshot, issued_at, payment_id",
      )
      .eq("member_id", context.userId)
      .order("issued_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

/** Anyone signed-in can fetch a receipt by id; RLS restricts to owner or admin. */
export const getReceiptById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase
      .from("receipts")
      .select(
        "*, payment:payments(id, amount, currency, method, provider, provider_status, paid_at, confirmed_at, reference, notes, plan:plans(name, description, credits, duration_days, price_cents, currency))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!r) return null;
    return r;
  });

/** Admin: confirm a manual/pending payment, grant the plan + credits, and issue a receipt. Idempotent. */
export const confirmPaymentAndIssueReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        payment_id: z.string().uuid(),
        provider_payment_id: z.string().optional(),
        provider_session_id: z.string().optional(),
        provider_status: z.string().optional(),
        receipt_url: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("forbidden");
    const { data: res, error } = await (context.supabase as any).rpc(
      "confirm_payment_and_issue_receipt",
      {
        p_actor_id: context.userId,
        p_payment_id: data.payment_id,
        p_provider_payment_id: data.provider_payment_id ?? null,
        p_provider_session_id: data.provider_session_id ?? null,
        p_provider_status: data.provider_status ?? null,
        p_receipt_url: data.receipt_url ?? null,
        p_metadata: null,
      },
    );
    if (error) throw error;
    if ((res as any)?.status === "error") throw new Error((res as any).message ?? "confirm_failed");
    return res as {
      status: string;
      payment_id: string;
      receipt_id: string;
      receipt_number: string;
      member_plan_id?: string | null;
    };
  });

/**
 * Stub for online checkout. Returns provider_not_configured until Stripe/Paddle
 * is enabled at the studio level. The signature is intentionally stable so the
 * UI can call this today and the implementation can be filled in later without
 * changing the call site.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ context }) => {
    const { data: s } = await context.supabase
      .from("studio_settings")
      .select("payments_enabled, payments_provider, payments_mode")
      .eq("id", 1)
      .maybeSingle();
    const provider = (s as any)?.payments_provider ?? "none";
    const enabled = !!(s as any)?.payments_enabled;
    if (!enabled || provider === "none" || provider === "manual") {
      return {
        status: "provider_not_configured" as const,
        message:
          "Online payments are not connected yet. Please use the Request package option, and the studio will contact you.",
      };
    }
    // Provider-specific implementation will land in the next pass once
    // Stripe/Paddle is enabled. Server fn surface remains the same.
    return {
      status: "provider_not_configured" as const,
      message: "This provider is configured but checkout is not implemented yet.",
    };
  });
