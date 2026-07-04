import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

async function insertNotificationDraftRows(_supabase: any, rows: any[]) {
  if (!rows.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("notification_logs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error("notification_draft_insert_failed", error.message);
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
    const typedResult = res as {
      status: string;
      payment_id: string;
      receipt_id: string;
      receipt_number: string;
      member_plan_id?: string | null;
    };
    if (
      (typedResult.status === "confirmed" || typedResult.status === "already_confirmed") &&
      typedResult.payment_id &&
      typedResult.receipt_id
    ) {
      try {
        const [paymentRes, receiptRes, settingsRes] = await Promise.all([
          context.supabase
            .from("payments")
            .select(
              "id,amount,currency,member:members(id,name,phone,email,preferred_language),plan:plans(name)",
            )
            .eq("id", typedResult.payment_id)
            .maybeSingle(),
          context.supabase
            .from("receipts")
            .select("id,receipt_number,plan_name_snapshot")
            .eq("id", typedResult.receipt_id)
            .maybeSingle(),
          context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (paymentRes.error) throw paymentRes.error;
        if (receiptRes.error) throw receiptRes.error;
        if (settingsRes.error) throw settingsRes.error;
        const payment = paymentRes.data as any;
        const receipt = receiptRes.data as any;
        if (payment?.member) {
          const packageName = payment.plan?.name ?? receipt?.plan_name_snapshot ?? "Studio payment";
          const paymentRows = buildNotificationDraftRows({
            eventKey: "payment_confirmed",
            channels: ["whatsapp", "email"],
            audience: "member",
            member: payment.member,
            appLanguage: null,
            studioSettings: settingsRes.data ?? null,
            relatedIds: {
              paymentId: typedResult.payment_id,
              receiptId: typedResult.receipt_id,
              memberPlanId: typedResult.member_plan_id ?? null,
            },
            variables: {
              package_name: packageName,
              amount: payment.amount,
              currency: payment.currency,
            },
          });
          const receiptRows = receipt
            ? buildNotificationDraftRows({
                eventKey: "receipt_issued",
                channels: ["whatsapp", "email"],
                audience: "member",
                member: payment.member,
                appLanguage: null,
                studioSettings: settingsRes.data ?? null,
                relatedIds: {
                  paymentId: typedResult.payment_id,
                  receiptId: typedResult.receipt_id,
                  memberPlanId: typedResult.member_plan_id ?? null,
                },
                variables: {
                  package_name: packageName,
                  receipt_number: receipt.receipt_number ?? typedResult.receipt_number,
                },
              })
            : [];
          await insertNotificationDraftRows(context.supabase, [...paymentRows, ...receiptRows]);
        }
      } catch (draftError) {
        console.error("payment_receipt_draft_prepare_failed", draftError);
      }
    }
    return typedResult;
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
