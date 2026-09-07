import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildHypReconciliationId,
  chargeHypSavedToken,
  createHypPaymentPage,
  getHypConfig,
  getHypTokenForTransaction,
  hypRedirectMetadata,
  inquireHypTransactionsByUser,
  type HypInquiryTransaction,
} from "@/lib/hyp.server";
import { issueEzcountReceiptForKidsPayment } from "@/lib/ezcountReceiptIssuance.server";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function pickSearchParam(params: URLSearchParams, ...names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null && value.trim() !== "") return value.trim();
  }
  return "";
}

function normalizeUserId(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 9 ? digits : "000000000";
}

function amountToAgorot(amount: number) {
  return Math.round(Number(amount) * 100);
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

function hypTransactionDate(value: string) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}+03:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
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
  params.set("_hyp_sync_source", "kids_inquireTransactions");
  return params;
}

function paramsFromHypTokenChargeResult(input: {
  result: Awaited<ReturnType<typeof chargeHypSavedToken>>;
  reconciliationId: string;
  cardLast4: string;
}) {
  return new URLSearchParams({
    CCode: "0",
    user: input.reconciliationId,
    Id: input.result.id,
    txId: input.result.id,
    Amount: input.result.amount,
    ACode: input.result.acode,
    Hesh: input.result.hesh,
    token_last4: input.cardLast4,
    _hyp_sync_source: "kids_softToken",
  });
}

export async function createKidsHypPaymentLink(input: {
  childId: string;
  packageId: string;
  amount?: number | null;
  billingMonth?: string | null;
  notes?: string | null;
  actorId: string;
}) {
  const { data: child, error: childError } = await (supabaseAdmin as any)
    .from("kid_aerial_children")
    .select("id,child_name,guardian_name")
    .eq("id", input.childId)
    .maybeSingle();
  if (childError) throw childError;
  if (!child) throw new Error("kid_child_not_found");

  const { data: pkg, error: packageError } = await (supabaseAdmin as any)
    .from("kid_aerial_packages")
    .select("*")
    .eq("id", input.packageId)
    .eq("active", true)
    .maybeSingle();
  if (packageError) throw packageError;
  if (!pkg) throw new Error("kid_package_not_found");

  const amount = Number(input.amount ?? pkg.price);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid_payment_amount");
  const now = new Date();
  const expiresAt = addDays(now, 7);
  const recurring = pkg.code === "monthly" && Boolean(pkg.recurring_available);

  const { data: payment, error: paymentError } = await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .insert({
      child_id: child.id,
      package_id: pkg.id,
      amount,
      billing_month: input.billingMonth ? `${input.billingMonth}-01` : null,
      currency: pkg.currency ?? "ILS",
      method: "card",
      status: "pending",
      provider: "hyp",
      payment_link_expires_at: expiresAt.toISOString(),
      recorded_by: input.actorId,
      notes: input.notes || null,
      metadata: {
        payment_link_created_by: input.actorId,
        subscription_setup: recurring,
      },
    })
    .select("id")
    .single();
  if (paymentError) throw paymentError;

  const config = getHypConfig();
  const reconciliationId = buildHypReconciliationId(payment.id);
  const page = await createHypPaymentPage(
    {
      paymentId: payment.id,
      amountAgorot: amountToAgorot(amount),
      language: "HEB",
      description: `יוגה אווירית לילדים - ${pkg.name}`,
      recurring,
      recurringMode: config.recurringMode,
      reconciliationId,
    },
    config,
  );

  const { error: updateError } = await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .update({
      provider_payment_url: page.paymentUrl,
      provider_session_id: page.cgUid || null,
      metadata: {
        payment_link_created_by: input.actorId,
        subscription_setup: recurring,
        subscription_management:
          recurring && config.recurringMode === "merchant_token"
            ? "hyp_merchant_token"
            : recurring
              ? "hyp_managed_hk"
              : null,
        hyp_reconciliation_id: reconciliationId,
        hyp_sign_response: page.raw,
      },
    })
    .eq("id", payment.id);
  if (updateError) throw updateError;

  return {
    paymentId: payment.id,
    paymentUrl: page.paymentUrl,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function activateKidsPaymentPeriod(input: {
  paymentId: string;
  actorId?: string | null;
  params?: URLSearchParams | null;
  providerPaymentId?: string | null;
  providerSessionId?: string | null;
}) {
  const { data: payment, error: paymentError } = await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .select(
      "*, child:kid_aerial_children(id,child_name,guardian_name), package:kid_aerial_packages(*)",
    )
    .eq("id", input.paymentId)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment) throw new Error("kid_payment_not_found");
  if (payment.status === "paid" && payment.enrollment_id) {
    return {
      status: "already_paid" as const,
      paymentId: payment.id,
      enrollmentId: payment.enrollment_id,
    };
  }

  const pkg = payment.package;
  if (!pkg) throw new Error("kid_payment_package_missing");
  const now = new Date();
  const periodStart = payment.period_start ? new Date(payment.period_start) : now;
  const periodEnd = payment.period_end
    ? new Date(payment.period_end)
    : addDays(periodStart, Number(pkg.period_days ?? 30));
  const creditsGranted = Number(payment.credits_granted || pkg.credits_per_period || 4);
  const nextIndex = Number(payment.period_index || 1);

  const { data: activeEnrollment, error: enrollmentReadError } = await (supabaseAdmin as any)
    .from("kid_aerial_enrollments")
    .select("*")
    .eq("child_id", payment.child_id)
    .in("status", ["active", "past_due"])
    .maybeSingle();
  if (enrollmentReadError) throw enrollmentReadError;

  let enrollmentId = activeEnrollment?.id;
  if (!activeEnrollment) {
    const { data: enrollment, error: enrollmentError } = await (supabaseAdmin as any)
      .from("kid_aerial_enrollments")
      .insert({
        child_id: payment.child_id,
        package_id: payment.package_id,
        status: "active",
        payment_method: payment.method,
        price: payment.amount,
        total_periods: pkg.total_periods,
        current_period_index: nextIndex,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        credits_total: creditsGranted,
        credits_remaining: creditsGranted,
        expires_at: addDays(
          periodStart,
          Number(pkg.period_days ?? 30) * Number(pkg.total_periods ?? 10),
        ).toISOString(),
        notes: payment.notes || null,
        created_by: input.actorId || payment.recorded_by || null,
      })
      .select("id")
      .single();
    if (enrollmentError) throw enrollmentError;
    enrollmentId = enrollment.id;
  } else {
    const isSamePaymentPeriod =
      payment.enrollment_id === activeEnrollment.id &&
      payment.status === "paid" &&
      Number(payment.credits_granted ?? 0) > 0;
    if (!isSamePaymentPeriod) {
      const { error: updateEnrollmentError } = await (supabaseAdmin as any)
        .from("kid_aerial_enrollments")
        .update({
          status: "active",
          package_id: payment.package_id,
          payment_method: payment.method,
          price: payment.amount,
          current_period_index: nextIndex,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          credits_total: Number(activeEnrollment.credits_total ?? 0) + creditsGranted,
          credits_remaining: Number(activeEnrollment.credits_remaining ?? 0) + creditsGranted,
          notes: payment.notes || activeEnrollment.notes || null,
        })
        .eq("id", activeEnrollment.id);
      if (updateEnrollmentError) throw updateEnrollmentError;
    }
  }

  const metadata = {
    ...(payment.metadata ?? {}),
    ...(input.params ? { hyp_payload: hypRedirectMetadata(input.params) } : {}),
  };
  const { error: updatePaymentError } = await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .update({
      enrollment_id: enrollmentId,
      status: "paid",
      paid_at: payment.paid_at || now.toISOString(),
      period_index: nextIndex,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      credits_granted: creditsGranted,
      provider_payment_id: input.providerPaymentId || payment.provider_payment_id || null,
      provider_session_id: input.providerSessionId || payment.provider_session_id || null,
      provider_status: input.params ? "paid" : payment.provider_status,
      recorded_by: input.actorId || payment.recorded_by || null,
      metadata,
    })
    .eq("id", payment.id);
  if (updatePaymentError) throw updatePaymentError;

  await (supabaseAdmin as any).from("admin_activity_log").insert({
    actor_id: input.actorId || payment.recorded_by || null,
    action: "kid_aerial.payment_activated",
    entity_type: "kid_aerial_payment",
    entity_id: payment.id,
    metadata: {
      child_id: payment.child_id,
      enrollment_id: enrollmentId,
      credits_granted: creditsGranted,
      amount: payment.amount,
    },
  });

  return { status: "paid" as const, paymentId: payment.id, enrollmentId };
}

export async function createKidsSubscriptionFromInitialPayment(input: {
  paymentId: string;
  enrollmentId: string;
  hkId?: string | null;
  cardMask?: string | null;
  transId?: string | null;
  userId?: string | null;
}) {
  const { data: existing, error: existingError } = await (supabaseAdmin as any)
    .from("kid_aerial_subscriptions")
    .select("id,status")
    .eq("initial_payment_id", input.paymentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { status: "already_exists" as const, subscriptionId: existing.id };

  const { data: payment, error: paymentError } = await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .select("*, package:kid_aerial_packages(*)")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment || payment.status !== "paid") return { status: "payment_not_paid" as const };
  if (payment.package?.code !== "monthly" || payment.metadata?.subscription_setup !== true) {
    return { status: "not_recurring" as const };
  }

  const management = String(payment.metadata?.subscription_management ?? "hyp_managed_hk");
  const merchantManaged = management === "hyp_merchant_token";
  let savedToken: { token: string; month: string; year: string } | null = null;

  if (merchantManaged) {
    if (!input.transId) return { status: "missing_transaction_id" as const };
    savedToken = await getHypTokenForTransaction(input.transId);
  } else if (!input.hkId) {
    return { status: "missing_hkid" as const };
  }

  const periodStart = new Date(payment.period_start);
  const periodEnd = new Date(payment.period_end);
  const { data: subscription, error: subscriptionError } = await (supabaseAdmin as any)
    .from("kid_aerial_subscriptions")
    .insert({
      child_id: payment.child_id,
      package_id: payment.package_id,
      enrollment_id: input.enrollmentId,
      status: "active",
      provider: "hyp",
      provider_subscription_id: input.hkId || null,
      initial_payment_id: payment.id,
      last_payment_id: payment.id,
      amount: payment.amount,
      currency: payment.currency ?? "ILS",
      current_period_index: 1,
      total_periods: payment.package.total_periods,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_charge_at: periodEnd.toISOString(),
      card_mask: input.cardMask || null,
      metadata: {
        initial_payment_id: payment.id,
        hyp_hk_id: input.hkId ?? null,
        hyp_reconciliation_id: payment.metadata?.hyp_reconciliation_id ?? null,
        subscription_management: management,
        token_saved: Boolean(savedToken),
        token_last4: savedToken?.token.slice(-4) ?? null,
      },
    })
    .select("id")
    .single();
  if (subscriptionError) throw subscriptionError;

  if (savedToken) {
    const { error: tokenError } = await (supabaseAdmin as any)
      .from("kid_aerial_payment_tokens")
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
        },
        { onConflict: "subscription_id" },
      );
    if (tokenError) throw tokenError;
  }

  await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .update({
      metadata: {
        ...(payment.metadata ?? {}),
        subscription_id: subscription.id,
        subscription_status: "active",
        hyp_hk_id: input.hkId ?? null,
        token_saved: Boolean(savedToken),
      },
    })
    .eq("id", payment.id);

  return { status: "created" as const, subscriptionId: subscription.id };
}

export async function processKidsHypReturn(params: URLSearchParams) {
  const paymentId = pickSearchParam(params, "Order", "uniqueID", "uniqueId", "uniqueid");
  if (!paymentId) return { status: "missing_payment_id" as const };

  const { data: payment, error: paymentError } = await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .select("id,status,provider")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment) return { status: "not_kids_payment" as const, paymentId };

  if (pickSearchParam(params, "status") === "cancel") {
    await (supabaseAdmin as any)
      .from("kid_aerial_payments")
      .update({
        status: "failed",
        provider_status: "cancelled",
        metadata: hypRedirectMetadata(params),
      })
      .eq("id", paymentId)
      .eq("status", "pending");
    return { status: "cancelled" as const, paymentId };
  }

  const providerPaymentId = pickSearchParam(params, "ACode", "cgUid", "authNumber");
  const providerSessionId = pickSearchParam(params, "Id", "txId");
  const result = await activateKidsPaymentPeriod({
    paymentId,
    actorId: null,
    params,
    providerPaymentId: providerPaymentId || providerSessionId || null,
    providerSessionId: providerSessionId || null,
  });

  try {
    await createKidsSubscriptionFromInitialPayment({
      paymentId,
      enrollmentId: result.enrollmentId,
      hkId: pickSearchParam(params, "HKId", "hkId"),
      cardMask: pickSearchParam(params, "cardMask", "L4digit"),
      transId: providerSessionId,
      userId: pickSearchParam(params, "UserId"),
    });
  } catch (error) {
    console.error("kids_hyp_subscription_setup_failed", error);
  }

  try {
    await issueEzcountReceiptForKidsPayment(paymentId);
  } catch (error) {
    console.error("ezcount_kids_receipt_issue_failed", error);
  }

  return { status: "success" as const, paymentId, enrollmentId: result.enrollmentId };
}

export async function cancelKidsHypSubscription(input: {
  subscriptionId: string;
  actorId: string;
}) {
  const { updateHypRecurringAgreementStatus } = await import("@/lib/hyp.server");
  const { data: subscription, error } = await (supabaseAdmin as any)
    .from("kid_aerial_subscriptions")
    .select("*")
    .eq("id", input.subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!subscription) throw new Error("kid_subscription_not_found");
  if (subscription.status === "cancelled") return { ok: true, status: "cancelled" };

  const management = String(subscription.metadata?.subscription_management ?? "hyp_managed_hk");
  if (management !== "hyp_merchant_token" && subscription.provider_subscription_id) {
    await updateHypRecurringAgreementStatus(subscription.provider_subscription_id, "terminate");
  }

  const { error: updateError } = await (supabaseAdmin as any)
    .from("kid_aerial_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);
  if (updateError) throw updateError;

  await (supabaseAdmin as any).from("admin_activity_log").insert({
    actor_id: input.actorId,
    action: "kid_aerial.subscription_cancelled",
    entity_type: "kid_aerial_subscription",
    entity_id: subscription.id,
    metadata: { child_id: subscription.child_id },
  });

  return { ok: true, status: "cancelled" };
}

export async function chargeDueKidsHypTokenSubscriptions(options?: { limit?: number; now?: Date }) {
  const now = options?.now ?? new Date();
  const limit = Math.max(1, Math.min(Number(options?.limit ?? 25), 100));
  const { data: subscriptions, error } = await (supabaseAdmin as any)
    .from("kid_aerial_subscriptions")
    .select(
      "id,status,child_id,package_id,enrollment_id,amount,currency,next_charge_at,current_period_end,current_period_index,total_periods,retry_count,metadata,child:kid_aerial_children(id,child_name),package:kid_aerial_packages(*)",
    )
    .in("status", ["active", "past_due"])
    .eq("provider", "hyp")
    .eq("metadata->>subscription_management", "hyp_merchant_token")
    .lte("next_charge_at", now.toISOString())
    .order("next_charge_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results = [];
  for (const subscription of subscriptions ?? []) {
    if (
      Number(subscription.current_period_index ?? 1) >= Number(subscription.total_periods ?? 10)
    ) {
      await (supabaseAdmin as any)
        .from("kid_aerial_subscriptions")
        .update({ status: "completed", updated_at: now.toISOString() })
        .eq("id", subscription.id);
      results.push({ subscriptionId: subscription.id, status: "completed" });
      continue;
    }

    const reconciliationId = String(subscription.metadata?.hyp_reconciliation_id ?? "").trim();
    try {
      const { data: tokenRow, error: tokenError } = await (supabaseAdmin as any)
        .from("kid_aerial_payment_tokens")
        .select("token,token_exp_month,token_exp_year,token_user_id")
        .eq("subscription_id", subscription.id)
        .eq("provider", "hyp")
        .maybeSingle();
      if (tokenError) throw tokenError;
      if (!tokenRow?.token || !tokenRow?.token_exp_month || !tokenRow?.token_exp_year) {
        throw new Error("kid_hyp_token_details_missing");
      }

      const charge = await chargeHypSavedToken({
        token: tokenRow.token,
        expMonth: tokenRow.token_exp_month,
        expYear: tokenRow.token_exp_year,
        amount: Number(subscription.amount),
        userId: tokenRow.token_user_id,
        clientName: subscription.child?.child_name ?? "Cloud Core kids",
        info: `יוגה אווירית לילדים - חידוש חודשי`,
      });
      const params = paramsFromHypTokenChargeResult({
        result: charge,
        reconciliationId,
        cardLast4: tokenRow.token.slice(-4),
      });
      const payment = await createKidsRenewalPayment(subscription, params);
      await activateKidsPaymentPeriod({
        paymentId: payment.id,
        params,
        providerPaymentId: charge.id,
        providerSessionId: charge.id,
      });
      await advanceKidsSubscription(subscription, payment.id, params);
      try {
        await issueEzcountReceiptForKidsPayment(payment.id);
      } catch (receiptError) {
        console.error("ezcount_kids_receipt_issue_failed", receiptError);
      }
      results.push({ subscriptionId: subscription.id, status: "charged", paymentId: payment.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await (supabaseAdmin as any)
        .from("kid_aerial_subscriptions")
        .update({
          status: "past_due",
          last_renewal_attempt_at: now.toISOString(),
          retry_count: Number(subscription.retry_count ?? 0) + 1,
          failure_reason: message,
          updated_at: now.toISOString(),
        })
        .eq("id", subscription.id);
      await (supabaseAdmin as any)
        .from("kid_aerial_enrollments")
        .update({ status: "past_due" })
        .eq("id", subscription.enrollment_id);
      results.push({ subscriptionId: subscription.id, status: "failed", error: message });
    }
  }

  return { status: "ok" as const, checked: (subscriptions ?? []).length, results };
}

async function createKidsRenewalPayment(subscription: any, params: URLSearchParams) {
  const periodStart = new Date(subscription.current_period_end ?? subscription.next_charge_at);
  const periodEnd = addDays(periodStart, Number(subscription.package?.period_days ?? 30));
  const nextIndex = Number(subscription.current_period_index ?? 1) + 1;
  const transId = pickSearchParam(params, "Id", "txId");
  const { data: payment, error } = await (supabaseAdmin as any)
    .from("kid_aerial_payments")
    .insert({
      child_id: subscription.child_id,
      package_id: subscription.package_id,
      enrollment_id: subscription.enrollment_id,
      amount: Number(subscription.amount),
      billing_month: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}-01`,
      currency: subscription.currency ?? "ILS",
      method: "card",
      status: "pending",
      period_index: nextIndex,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      credits_granted: Number(subscription.package?.credits_per_period ?? 4),
      provider: "hyp",
      provider_payment_id: transId || null,
      provider_session_id: transId || null,
      provider_status: "paid",
      notes: "חידוש חודשי לילדים דרך HYP",
      metadata: {
        subscription_id: subscription.id,
        subscription_renewal: true,
        subscription_management: subscription.metadata?.subscription_management,
        hyp_payload: Object.fromEntries(params.entries()),
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return payment;
}

async function advanceKidsSubscription(
  subscription: any,
  paymentId: string,
  params: URLSearchParams,
) {
  const periodStart = new Date(subscription.current_period_end ?? subscription.next_charge_at);
  const periodEnd = addDays(periodStart, Number(subscription.package?.period_days ?? 30));
  const nextIndex = Number(subscription.current_period_index ?? 1) + 1;
  const status = nextIndex >= Number(subscription.total_periods ?? 10) ? "completed" : "active";
  const { error } = await (supabaseAdmin as any)
    .from("kid_aerial_subscriptions")
    .update({
      status,
      last_payment_id: paymentId,
      current_period_index: nextIndex,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_charge_at: periodEnd.toISOString(),
      last_renewal_attempt_at: new Date().toISOString(),
      retry_count: 0,
      failure_reason: null,
      updated_at: new Date().toISOString(),
      metadata: {
        ...(subscription.metadata ?? {}),
        last_hyp_payload: Object.fromEntries(params.entries()),
      },
    })
    .eq("id", subscription.id);
  if (error) throw error;
}

export async function syncDueKidsHypSubscriptions(options?: { limit?: number; now?: Date }) {
  const now = options?.now ?? new Date();
  const limit = Math.max(1, Math.min(Number(options?.limit ?? 25), 100));
  const { data: subscriptions, error } = await (supabaseAdmin as any)
    .from("kid_aerial_subscriptions")
    .select(
      "id,status,child_id,package_id,enrollment_id,amount,currency,next_charge_at,current_period_end,current_period_index,total_periods,retry_count,metadata,provider_subscription_id,package:kid_aerial_packages(*)",
    )
    .in("status", ["active", "past_due"])
    .eq("provider", "hyp")
    .neq("metadata->>subscription_management", "hyp_merchant_token")
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
      const candidate = transactions
        .filter(isSuccessfulHypDebit)
        .filter((tx) => {
          const txDate = hypTransactionDate(tx.transactionDate);
          return !txDate || txDate >= windowStart;
        })
        .sort((a, b) => {
          const ad = hypTransactionDate(a.transactionDate)?.getTime() ?? 0;
          const bd = hypTransactionDate(b.transactionDate)?.getTime() ?? 0;
          return ad - bd;
        })[0];

      if (!candidate) throw new Error("kid_hyp_renewal_not_found");
      const params = paramsFromHypInquiryTransaction(candidate, reconciliationId);
      const payment = await createKidsRenewalPayment(subscription, params);
      await activateKidsPaymentPeriod({
        paymentId: payment.id,
        params,
        providerPaymentId: candidate.tranId || candidate.cgUid,
        providerSessionId: candidate.tranId || candidate.cgUid,
      });
      await advanceKidsSubscription(subscription, payment.id, params);
      results.push({ subscriptionId: subscription.id, status: "processed", paymentId: payment.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await (supabaseAdmin as any)
        .from("kid_aerial_subscriptions")
        .update({
          status: "past_due",
          last_renewal_attempt_at: now.toISOString(),
          retry_count: Number(subscription.retry_count ?? 0) + 1,
          failure_reason: message,
          updated_at: now.toISOString(),
        })
        .eq("id", subscription.id);
      await (supabaseAdmin as any)
        .from("kid_aerial_enrollments")
        .update({ status: "past_due" })
        .eq("id", subscription.enrollment_id);
      results.push({ subscriptionId: subscription.id, status: "failed", error: message });
    }
  }

  return { status: "ok" as const, checked: (subscriptions ?? []).length, results };
}

export async function unlockDueKidsYearlyPeriods(options?: { limit?: number; now?: Date }) {
  const now = options?.now ?? new Date();
  const limit = Math.max(1, Math.min(Number(options?.limit ?? 50), 200));
  const { data: enrollments, error } = await (supabaseAdmin as any)
    .from("kid_aerial_enrollments")
    .select("*, package:kid_aerial_packages(*)")
    .eq("status", "active")
    .lte("current_period_end", now.toISOString())
    .order("current_period_end", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results = [];
  for (const enrollment of (enrollments ?? []).filter(
    (row: any) => row.package?.code === "yearly",
  )) {
    if (
      !enrollment.package ||
      Number(enrollment.current_period_index) >= Number(enrollment.total_periods)
    ) {
      await (supabaseAdmin as any)
        .from("kid_aerial_enrollments")
        .update({ status: "completed" })
        .eq("id", enrollment.id);
      results.push({ enrollmentId: enrollment.id, status: "completed" });
      continue;
    }
    const periodStart = new Date(enrollment.current_period_end);
    const periodEnd = addDays(periodStart, Number(enrollment.package.period_days ?? 30));
    const nextIndex = Number(enrollment.current_period_index) + 1;
    const credits = Number(enrollment.package.credits_per_period ?? 4);
    const { data: payment, error: paymentError } = await (supabaseAdmin as any)
      .from("kid_aerial_payments")
      .insert({
        child_id: enrollment.child_id,
        package_id: enrollment.package_id,
        enrollment_id: enrollment.id,
        amount: 0,
        currency: enrollment.package.currency ?? "ILS",
        method: "other",
        status: "paid",
        paid_at: now.toISOString(),
        period_index: nextIndex,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        credits_granted: credits,
        notes: "פתיחת 4 קרדיטים חודשיים מתוך חבילה שנתית",
      })
      .select("id")
      .single();
    if (paymentError) throw paymentError;
    const { error: updateError } = await (supabaseAdmin as any)
      .from("kid_aerial_enrollments")
      .update({
        current_period_index: nextIndex,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        credits_total: Number(enrollment.credits_total ?? 0) + credits,
        credits_remaining: Number(enrollment.credits_remaining ?? 0) + credits,
        status: nextIndex >= Number(enrollment.total_periods) ? "completed" : "active",
      })
      .eq("id", enrollment.id);
    if (updateError) throw updateError;
    results.push({ enrollmentId: enrollment.id, status: "unlocked", paymentId: payment.id });
  }

  return { status: "ok" as const, checked: (enrollments ?? []).length, results };
}
