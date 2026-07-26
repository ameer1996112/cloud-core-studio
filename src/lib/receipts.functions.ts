import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
import { getPlanDisplay } from "@/lib/planDisplay";
import { getHypConfig } from "@/lib/hyp.server";

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

async function assertNoUsableActivePackage(supabase: any, memberId: string) {
  const now = new Date().toISOString();
  const [memberRes, activePlanRes] = await Promise.all([
    supabase.from("members").select("remaining_credits").eq("id", memberId).maybeSingle(),
    supabase
      .from("member_plans")
      .select("id,expires_at")
      .eq("member_id", memberId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(1),
  ]);
  if (memberRes.error) throw memberRes.error;
  if (activePlanRes.error) throw activePlanRes.error;
  if (Number(memberRes.data?.remaining_credits ?? 0) > 0 && (activePlanRes.data ?? []).length > 0) {
    throw new Error("active_package_exists");
  }
}

function isRecurringEligiblePlan(plan: { description?: string | null; duration_days?: unknown }) {
  const code = String(plan?.description ?? "").toLowerCase();
  const durationDays = Number(plan?.duration_days ?? 0);
  return code.includes("monthly") || (durationDays >= 27 && durationDays <= 31);
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
            channels: ["email"],
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
          await insertNotificationDraftRows(context.supabase, paymentRows);
        }
      } catch (draftError) {
        console.error("payment_receipt_draft_prepare_failed", draftError);
      }
    }
    return typedResult;
  });

/** Member: create a hosted checkout session for the configured online payment provider. */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan_id: z.string().uuid(),
        payment_method: z.enum(["card", "bit"]).default("card"),
        recurring: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
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
    if (provider !== "hyp") {
      return {
        status: "provider_not_configured" as const,
        message: "This provider is configured but checkout is not implemented yet.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildHypReconciliationId, createHypPaymentPage } = await import("@/lib/hyp.server");

    await assertNoUsableActivePackage(context.supabase, context.userId);

    const [memberRes, planRes] = await Promise.all([
      context.supabase.from("members").select("id,name").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("plans")
        .select("id,name,description,price_cents,currency,credits,duration_days,active")
        .eq("id", data.plan_id)
        .eq("active", true)
        .maybeSingle(),
    ]);
    if (memberRes.error) throw memberRes.error;
    if (planRes.error) throw planRes.error;
    if (!memberRes.data) throw new Error("member_profile_missing");
    if (!planRes.data) throw new Error("plan_not_found");

    const amountAgorot = Number(planRes.data.price_cents ?? 0);
    if (!Number.isFinite(amountAgorot) || amountAgorot <= 0) throw new Error("invalid_plan_amount");
    const paymentMethod = data.payment_method;
    const recurring = data.recurring === true;
    const recurringMode = recurring ? getHypConfig().recurringMode : null;
    const subscriptionManagement = recurring ? recurringMode : null;
    if (recurring && paymentMethod !== "card") throw new Error("recurring_requires_card");
    if (recurring && !isRecurringEligiblePlan(planRes.data)) throw new Error("plan_not_recurring");
    if (recurring) {
      const { data: existingSubscription, error: subscriptionError } = await (supabaseAdmin as any)
        .from("member_subscriptions")
        .select("id,status")
        .eq("member_id", context.userId)
        .in("status", ["active", "past_due", "incomplete"])
        .limit(1)
        .maybeSingle();
      if (subscriptionError) throw subscriptionError;
      if (existingSubscription) throw new Error("active_subscription_exists");
    }

    const { data: payment, error: insertError } = await supabaseAdmin
      .from("payments")
      .insert({
        member_id: context.userId,
        plan_id: planRes.data.id,
        amount: amountAgorot / 100,
        currency: planRes.data.currency ?? "ILS",
        method: paymentMethod,
        provider: "hyp",
        provider_status: "created",
        status: "pending",
        notes: `HYP ${paymentMethod} checkout for ${planRes.data.name}`,
        metadata: {
          checkout_provider: "hyp",
          requested_payment_method: paymentMethod,
          payments_mode: (s as any)?.payments_mode ?? "test",
          subscription_setup: recurring,
          subscription_management: subscriptionManagement,
        },
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const hypReconciliationId = buildHypReconciliationId(payment.id);

    try {
      const hebrewPlanName = getPlanDisplay(planRes.data, "he").name;
      const hypDescription = recurring
        ? `מנוי חודשי - חיוב ראשון היום ומתחדש כל חודש עד ביטול - ${hebrewPlanName}`
        : hebrewPlanName;
      const page = await createHypPaymentPage({
        paymentId: payment.id,
        amountAgorot,
        language: "HEB",
        description: hypDescription,
        paymentMethod,
        recurring,
        recurringMode: recurringMode ?? undefined,
        reconciliationId: hypReconciliationId,
      });

      await supabaseAdmin
        .from("payments")
        .update({
          provider_status: "payment_page_created",
          provider_session_id: page.token || null,
          provider_payment_id: page.cgUid || null,
          provider_customer_id: recurring ? hypReconciliationId : null,
          metadata: {
            checkout_provider: "hyp",
            requested_payment_method: paymentMethod,
            payments_mode: (s as any)?.payments_mode ?? "test",
            subscription_setup: recurring,
            subscription_management: subscriptionManagement,
            hyp_reconciliation_id: recurring ? hypReconciliationId : null,
            hyp_result: page.result,
            hyp_message: page.message,
          },
        })
        .eq("id", payment.id);

      return {
        status: "ready" as const,
        provider: "hyp" as const,
        payment_id: payment.id,
        checkout_url: page.paymentUrl,
      };
    } catch (error) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          provider_status: "payment_page_failed",
          metadata: {
            checkout_provider: "hyp",
            requested_payment_method: paymentMethod,
            payments_mode: (s as any)?.payments_mode ?? "test",
            subscription_setup: recurring,
            subscription_management: subscriptionManagement,
            hyp_reconciliation_id: recurring ? hypReconciliationId : null,
            error: error instanceof Error ? error.message : String(error),
          },
        })
        .eq("id", payment.id);
      throw error;
    }
  });
