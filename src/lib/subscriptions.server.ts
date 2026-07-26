import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handleHypConfirmedPayment } from "@/lib/hypPaymentConfirmation.server";
import {
  chargeHypSavedToken,
  getHypTokenForTransaction,
  inquireHypTransactionsByUser,
  validateHypRedirect,
  type HypInquiryTransaction,
} from "@/lib/hyp.server";

type InitialSubscriptionInput = {
  paymentId: string;
  memberPlanId?: string | null;
  hkId?: string | null;
  cardMask?: string | null;
  transId?: string | null;
  userId?: string | null;
};

function pickSearchParam(params: URLSearchParams, ...names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null && value.trim() !== "") return value.trim();
  }
  return "";
}

function addPlanPeriod(start: Date, durationDays?: number | null) {
  const end = new Date(start);
  const days = Number(durationDays ?? 0);
  if (Number.isFinite(days) && days > 0) {
    end.setDate(end.getDate() + days);
    return end;
  }
  end.setMonth(end.getMonth() + 1);
  return end;
}

function isRecurringSetupPayment(payment: any) {
  return payment?.provider === "hyp" && payment?.metadata?.subscription_setup === true;
}

function subscriptionManagement(paymentOrSubscription: any) {
  return String(paymentOrSubscription?.metadata?.subscription_management ?? "hyp_managed_hk");
}

function hypTransactionDate(value: string) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}+03:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSuccessfulHypDebit(tx: HypInquiryTransaction) {
  const status = tx.status === "000" || tx.status === "0";
  const financialStatus = tx.financialStatus.toLowerCase();
  const validation = tx.validation.toLowerCase();
  return (
    status &&
    ["captured", "transmitted"].includes(financialStatus) &&
    validation !== "txnsetup" &&
    Boolean(tx.tranId || tx.cgUid)
  );
}

function paramsFromHypInquiryTransaction(tx: HypInquiryTransaction, reconciliationId: string) {
  const params = new URLSearchParams({
    CCode: "0",
    user: reconciliationId,
    Id: tx.tranId || tx.cgUid,
    txId: tx.tranId || tx.cgUid,
    Amount: tx.amount,
    status: tx.status,
    statusText: tx.statusText,
    financialStatus: tx.financialStatus,
    transactionDate: tx.transactionDate,
  });
  if (tx.cgUid) params.set("cgUid", tx.cgUid);
  if (tx.authNumber) params.set("authNumber", tx.authNumber);
  if (tx.cardMask) params.set("cardMask", tx.cardMask);
  if (tx.cardExp) params.set("cardExp", tx.cardExp);
  params.set("_hyp_sync_source", "inquireTransactions");
  return params;
}

function paramsFromHypTokenChargeResult(input: {
  result: Awaited<ReturnType<typeof chargeHypSavedToken>>;
  reconciliationId: string;
}) {
  const params = new URLSearchParams({
    CCode: "0",
    user: input.reconciliationId,
    Id: input.result.id,
    txId: input.result.id,
    Amount: input.result.amount,
    ACode: input.result.acode,
    Hesh: input.result.hesh,
    _hyp_sync_source: "softToken",
  });
  return params;
}

async function firstAdminUserId() {
  const { data, error } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export function isRecurringEligiblePlan(plan: {
  description?: string | null;
  duration_days?: number | string | null;
}) {
  const code = String(plan?.description ?? "").toLowerCase();
  const durationDays = Number(plan?.duration_days ?? 0);
  return code.includes("monthly") || (durationDays >= 27 && durationDays <= 31);
}

function normalizeUserId(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 9 ? digits : "000000000";
}

export async function createSubscriptionFromInitialPayment(input: InitialSubscriptionInput) {
  const { data: existing, error: existingError } = await (supabaseAdmin as any)
    .from("member_subscriptions")
    .select("id,status")
    .eq("initial_payment_id", input.paymentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { status: "already_exists" as const, subscriptionId: existing.id };

  const { data: payment, error: paymentError } = await (supabaseAdmin as any)
    .from("payments")
    .select(
      "id,member_id,plan_id,amount,currency,status,provider,metadata,plan:plans(id,name,description,duration_days)",
    )
    .eq("id", input.paymentId)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment || !isRecurringSetupPayment(payment)) return { status: "not_recurring" as const };
  if (payment.status !== "paid") return { status: "payment_not_paid" as const };
  if (!payment.plan_id || !payment.plan || !isRecurringEligiblePlan(payment.plan as any)) {
    return { status: "plan_not_eligible" as const };
  }
  const management = subscriptionManagement(payment);
  const merchantManaged = management === "hyp_merchant_token";
  let savedToken: {
    token: string;
    month: string;
    year: string;
  } | null = null;

  if (merchantManaged) {
    if (!input.transId) {
      await (supabaseAdmin as any)
        .from("payments")
        .update({
          metadata: {
            ...(payment.metadata ?? {}),
            subscription_setup_failed: "missing_hyp_transaction_id",
          },
        })
        .eq("id", input.paymentId);
      return { status: "missing_transaction_id" as const };
    }
    try {
      savedToken = await getHypTokenForTransaction(input.transId);
    } catch (error) {
      await (supabaseAdmin as any)
        .from("payments")
        .update({
          metadata: {
            ...(payment.metadata ?? {}),
            subscription_setup_failed: "hyp_token_failed",
            subscription_setup_error: error instanceof Error ? error.message : String(error),
          },
        })
        .eq("id", input.paymentId);
      return { status: "token_failed" as const };
    }
  } else if (!input.hkId) {
    await (supabaseAdmin as any)
      .from("payments")
      .update({
        metadata: {
          ...(payment.metadata ?? {}),
          subscription_setup_failed: "missing_hyp_hkid",
        },
      })
      .eq("id", input.paymentId);
    return { status: "missing_hkid" as const };
  }

  let periodStart = new Date();
  let periodEnd = addPlanPeriod(periodStart, (payment.plan as any).duration_days);
  if (input.memberPlanId) {
    const { data: memberPlan, error: memberPlanError } = await (supabaseAdmin as any)
      .from("member_plans")
      .select("starts_at,expires_at")
      .eq("id", input.memberPlanId)
      .maybeSingle();
    if (memberPlanError) throw memberPlanError;
    if (memberPlan?.starts_at) periodStart = new Date(memberPlan.starts_at);
    if (memberPlan?.expires_at) periodEnd = new Date(memberPlan.expires_at);
  }

  const { data: subscription, error: insertError } = await (supabaseAdmin as any)
    .from("member_subscriptions")
    .insert({
      member_id: payment.member_id,
      plan_id: payment.plan_id,
      status: "active",
      provider: "hyp",
      provider_subscription_id: input.hkId || null,
      initial_payment_id: input.paymentId,
      last_payment_id: input.paymentId,
      amount: payment.amount,
      currency: payment.currency ?? "ILS",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_charge_at: periodEnd.toISOString(),
      card_mask: input.cardMask || null,
      metadata: {
        initial_payment_id: input.paymentId,
        hyp_hk_id: input.hkId ?? null,
        hyp_reconciliation_id: payment.metadata?.hyp_reconciliation_id ?? null,
        token_last4: savedToken?.token.slice(-4) ?? null,
        token_expires: savedToken ? `${savedToken.month}/${savedToken.year}` : null,
        subscription_management: management,
      },
    } as any)
    .select("id")
    .single();
  if (insertError) throw insertError;

  if (savedToken) {
    const { error: tokenError } = await (supabaseAdmin as any)
      .from("subscription_payment_tokens")
      .upsert(
        {
          subscription_id: subscription.id,
          provider: "hyp",
          token: savedToken.token,
          token_exp_month: savedToken.month,
          token_exp_year: savedToken.year,
          token_user_id: normalizeUserId(input.userId),
          metadata: {
            hyp_transaction_id: input.transId,
            token_last4: savedToken.token.slice(-4),
            token_expires: `${savedToken.month}/${savedToken.year}`,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "subscription_id" },
      );
    if (tokenError) throw tokenError;
  }

  await (supabaseAdmin as any)
    .from("payments")
    .update({
      subscription_id: subscription.id,
      subscription_period_start: periodStart.toISOString(),
      subscription_period_end: periodEnd.toISOString(),
      metadata: {
        ...(payment.metadata ?? {}),
        subscription_id: subscription.id,
        subscription_status: "active",
        hyp_hk_id: input.hkId ?? null,
        hyp_reconciliation_id: payment.metadata?.hyp_reconciliation_id ?? null,
        subscription_management: management,
        token_saved: Boolean(savedToken),
      },
    } as any)
    .eq("id", input.paymentId);

  return { status: "created" as const, subscriptionId: subscription.id };
}

async function confirmPayment(paymentId: string, params: URLSearchParams) {
  const actorId = await firstAdminUserId();
  if (!actorId) throw new Error("subscription_confirm_no_admin_actor");

  const transId = pickSearchParam(params, "Id", "txId");
  const providerPaymentId = pickSearchParam(params, "ACode", "cgUid", "authNumber");
  const { data, error } = await (supabaseAdmin as any).rpc("confirm_payment_and_issue_receipt", {
    p_actor_id: actorId,
    p_payment_id: paymentId,
    p_provider_payment_id: providerPaymentId || transId || null,
    p_provider_session_id: transId || null,
    p_provider_status: "paid",
    p_receipt_url: null,
    p_metadata: Object.fromEntries(params.entries()),
  });
  if (error || (data as any)?.status === "error") {
    throw error ?? new Error((data as any)?.message ?? "confirm_failed");
  }
  return data as {
    status: string;
    payment_id: string;
    receipt_id: string;
    receipt_number: string;
    member_plan_id?: string | null;
  };
}

async function createAndConfirmSubscriptionRenewal(params: URLSearchParams) {
  const hkId = pickSearchParam(params, "HKId", "hkId");
  const reconciliationId = pickSearchParam(
    params,
    "user",
    "User",
    "Order",
    "uniqueID",
    "uniqueId",
    "uniqueid",
  );
  const transId = pickSearchParam(params, "Id", "txId", "tranId", "cgUid");
  if (!hkId && !reconciliationId) return { status: "missing_subscription_reference" as const };
  if (!transId) return { status: "missing_transaction_id" as const };

  const { data: existingPayment, error: existingPaymentError } = await (supabaseAdmin as any)
    .from("payments")
    .select("id,status")
    .eq("provider", "hyp")
    .or(`provider_payment_id.eq.${transId},provider_session_id.eq.${transId}`)
    .maybeSingle();
  if (existingPaymentError) throw existingPaymentError;
  if (existingPayment) {
    return {
      status: "duplicate_payment" as const,
      paymentId: existingPayment.id,
      paymentStatus: existingPayment.status,
    };
  }

  let subscriptionQuery = (supabaseAdmin as any)
    .from("member_subscriptions")
    .select("*, plan:plans(id,name,description,duration_days,price_cents,currency)")
    .eq("provider", "hyp");
  if (hkId) {
    subscriptionQuery = subscriptionQuery.eq("provider_subscription_id", hkId);
  } else {
    subscriptionQuery = subscriptionQuery.eq("metadata->>hyp_reconciliation_id", reconciliationId);
  }

  const { data: subscription, error: subscriptionError } = await subscriptionQuery.maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription) return { status: "subscription_not_found" as const, hkId, reconciliationId };
  if (subscription.status !== "active" && subscription.status !== "past_due") {
    return { status: "subscription_not_active" as const, subscriptionId: subscription.id };
  }

  const periodStart = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date();
  const periodEnd = addPlanPeriod(periodStart, subscription.plan?.duration_days);
  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();
  const amount = Number(pickSearchParam(params, "Amount")) || Number(subscription.amount);

  const { data: payment, error: paymentError } = await (supabaseAdmin as any)
    .from("payments")
    .insert({
      member_id: subscription.member_id,
      plan_id: subscription.plan_id,
      subscription_id: subscription.id,
      subscription_period_start: periodStartIso,
      subscription_period_end: periodEndIso,
      amount,
      currency: subscription.currency ?? "ILS",
      method: "card",
      provider: "hyp",
      provider_payment_id: transId,
      provider_session_id: transId,
      provider_status: "paid",
      status: "pending",
      notes: `HYP monthly renewal for ${subscription.plan?.name ?? "subscription"}`,
      metadata: {
        subscription_id: subscription.id,
        subscription_renewal: true,
        subscription_management: subscriptionManagement(subscription),
        hyp_hk_id: hkId || subscription.provider_subscription_id,
        hyp_reconciliation_id: reconciliationId || null,
        hyp_payload: Object.fromEntries(params.entries()),
      },
    } as any)
    .select("id")
    .single();
  if (paymentError) throw paymentError;

  const result = await confirmPayment(payment.id, params);
  await (supabaseAdmin as any)
    .from("member_subscriptions")
    .update({
      status: "active",
      last_payment_id: payment.id,
      current_period_start: periodStartIso,
      current_period_end: periodEndIso,
      next_charge_at: periodEndIso,
      last_renewal_attempt_at: new Date().toISOString(),
      retry_count: 0,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", subscription.id);

  return { status: "confirmed" as const, paymentId: payment.id, result };
}

export async function processHypPaymentNotification(params: URLSearchParams, source: string) {
  const eventId =
    pickSearchParam(params, "Id", "txId", "uniqueID", "uniqueId", "Order") ||
    `${source}:${Date.now()}`;
  const payload = Object.fromEntries(params.entries());
  const { error: eventError } = await (supabaseAdmin as any).from("provider_events").insert({
    provider: "hyp",
    event_id: eventId,
    event_type: source,
    payload,
    processing_status: "received",
  });
  if (eventError) {
    if (String((eventError as any).code) === "23505") {
      return { status: "duplicate_event" as const, eventId };
    }
    throw eventError;
  }

  const ccode = pickSearchParam(params, "CCode");
  if (ccode !== "0") {
    await (supabaseAdmin as any)
      .from("provider_events")
      .update({ processing_status: "ignored", error_message: `non_success_ccode:${ccode}` })
      .eq("provider", "hyp")
      .eq("event_id", eventId);
    return { status: "ignored_non_success" as const, eventId, ccode };
  }

  const isTrustedServerSource =
    source === "hyp_sns_webhook" || source === "hyp_inquiry_sync" || source === "hyp_token_charge";
  const isValid = isTrustedServerSource || (await validateHypRedirect(params));
  if (!isValid) {
    await (supabaseAdmin as any)
      .from("provider_events")
      .update({ processing_status: "failed", error_message: "invalid_signature" })
      .eq("provider", "hyp")
      .eq("event_id", eventId);
    return { status: "invalid_signature" as const, eventId };
  }

  try {
    const paymentId = pickSearchParam(params, "Order", "uniqueID", "uniqueId", "uniqueid");
    const result = paymentId
      ? await confirmPayment(paymentId, params).then(async (confirmResult) => {
          await createSubscriptionFromInitialPayment({
            paymentId,
            memberPlanId: confirmResult.member_plan_id ?? null,
            hkId: pickSearchParam(params, "HKId", "hkId"),
            cardMask: pickSearchParam(params, "cardMask", "L4digit"),
            transId: pickSearchParam(params, "Id", "txId"),
            userId: pickSearchParam(params, "UserId"),
          });
          return { status: "confirmed_existing_payment" as const, confirmResult };
        })
      : await createAndConfirmSubscriptionRenewal(params);

    const notificationResult =
      "confirmResult" in result ? result.confirmResult : "result" in result ? result.result : null;
    if (notificationResult) await handleHypConfirmedPayment(notificationResult);

    await (supabaseAdmin as any)
      .from("provider_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "hyp")
      .eq("event_id", eventId);
    return { eventId, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await (supabaseAdmin as any)
      .from("provider_events")
      .update({ processing_status: "failed", error_message: message })
      .eq("provider", "hyp")
      .eq("event_id", eventId);
    throw error;
  }
}

export async function syncDueHypSubscriptions(options?: { limit?: number; now?: Date }) {
  const now = options?.now ?? new Date();
  const limit = Math.max(1, Math.min(Number(options?.limit ?? 25), 100));
  const { data: subscriptions, error } = await (supabaseAdmin as any)
    .from("member_subscriptions")
    .select("id,status,next_charge_at,current_period_end,retry_count,metadata")
    .eq("provider", "hyp")
    .in("status", ["active", "past_due"])
    .lte("next_charge_at", now.toISOString())
    .order("next_charge_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results = [];
  for (const subscription of subscriptions ?? []) {
    const reconciliationId = String(subscription.metadata?.hyp_reconciliation_id ?? "").trim();
    if (!reconciliationId) {
      results.push({ subscriptionId: subscription.id, status: "missing_reconciliation_id" });
      continue;
    }

    try {
      const transactions = await inquireHypTransactionsByUser(reconciliationId);
      const dueAt = new Date(subscription.next_charge_at ?? subscription.current_period_end);
      const windowStart = new Date(dueAt);
      windowStart.setDate(windowStart.getDate() - 3);
      const candidates = transactions
        .filter(isSuccessfulHypDebit)
        .filter((tx) => {
          const txDate = hypTransactionDate(tx.transactionDate);
          return !txDate || txDate >= windowStart;
        })
        .sort((a, b) => {
          const ad = hypTransactionDate(a.transactionDate)?.getTime() ?? 0;
          const bd = hypTransactionDate(b.transactionDate)?.getTime() ?? 0;
          return ad - bd;
        });

      if (!candidates.length) {
        await (supabaseAdmin as any)
          .from("member_subscriptions")
          .update({
            last_renewal_attempt_at: now.toISOString(),
            retry_count: Number(subscription.retry_count ?? 0) + 1,
            failure_reason: "hyp_renewal_not_found",
            updated_at: now.toISOString(),
          } as any)
          .eq("id", subscription.id);
        results.push({ subscriptionId: subscription.id, status: "renewal_not_found" });
        continue;
      }

      const processed = [];
      for (const tx of candidates) {
        const result = await processHypPaymentNotification(
          paramsFromHypInquiryTransaction(tx, reconciliationId),
          "hyp_inquiry_sync",
        );
        processed.push(result);
      }
      results.push({ subscriptionId: subscription.id, status: "processed", processed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await (supabaseAdmin as any)
        .from("member_subscriptions")
        .update({
          last_renewal_attempt_at: now.toISOString(),
          retry_count: Number(subscription.retry_count ?? 0) + 1,
          failure_reason: message,
          updated_at: now.toISOString(),
        } as any)
        .eq("id", subscription.id);
      results.push({ subscriptionId: subscription.id, status: "failed", error: message });
    }
  }

  return {
    status: "ok" as const,
    checked: (subscriptions ?? []).length,
    results,
  };
}

export async function chargeDueHypTokenSubscriptions(options?: { limit?: number; now?: Date }) {
  const now = options?.now ?? new Date();
  const limit = Math.max(1, Math.min(Number(options?.limit ?? 25), 100));
  const { data: subscriptions, error } = await (supabaseAdmin as any)
    .from("member_subscriptions")
    .select(
      "id,status,member_id,amount,currency,next_charge_at,current_period_end,retry_count,metadata,plan:plans(id,name,description,duration_days),member:members(id,name)",
    )
    .eq("provider", "hyp")
    .in("status", ["active", "past_due"])
    .eq("metadata->>subscription_management", "hyp_merchant_token")
    .lte("next_charge_at", now.toISOString())
    .order("next_charge_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results = [];
  for (const subscription of subscriptions ?? []) {
    const reconciliationId = String(subscription.metadata?.hyp_reconciliation_id ?? "").trim();
    if (!reconciliationId) {
      results.push({ subscriptionId: subscription.id, status: "missing_reconciliation_id" });
      continue;
    }

    try {
      const { data: tokenRow, error: tokenError } = await (supabaseAdmin as any)
        .from("subscription_payment_tokens")
        .select("token,token_exp_month,token_exp_year,token_user_id")
        .eq("subscription_id", subscription.id)
        .eq("provider", "hyp")
        .maybeSingle();
      if (tokenError) throw tokenError;
      if (!tokenRow?.token || !tokenRow?.token_exp_month || !tokenRow?.token_exp_year) {
        throw new Error("hyp_token_details_missing");
      }
      const result = await chargeHypSavedToken({
        token: tokenRow.token,
        expMonth: tokenRow.token_exp_month,
        expYear: tokenRow.token_exp_year,
        amount: Number(subscription.amount),
        userId: tokenRow.token_user_id,
        clientName: subscription.member?.name ?? "Cloud Core member",
        info: `Cloud & Core monthly renewal ${subscription.plan?.name ?? ""}`.trim(),
      });

      const processed = await processHypPaymentNotification(
        paramsFromHypTokenChargeResult({ result, reconciliationId }),
        "hyp_token_charge",
      );
      results.push({ subscriptionId: subscription.id, status: "charged", processed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await (supabaseAdmin as any)
        .from("member_subscriptions")
        .update({
          status: "past_due",
          last_renewal_attempt_at: now.toISOString(),
          retry_count: Number(subscription.retry_count ?? 0) + 1,
          failure_reason: message,
          updated_at: now.toISOString(),
        } as any)
        .eq("id", subscription.id);
      results.push({ subscriptionId: subscription.id, status: "failed", error: message });
    }
  }

  return {
    status: "ok" as const,
    checked: (subscriptions ?? []).length,
    results,
  };
}
