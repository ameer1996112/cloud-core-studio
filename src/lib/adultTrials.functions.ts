import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data?.role !== "admin") throw new Error("forbidden");
}

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(8).max(200);

export const listAdultInquiryBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const db = supabaseAdmin as any;
    const { error: expiryError } = await db.rpc("expire_adult_trial_holds", {
      p_actor_id: context.userId,
      p_class_id: null,
    });
    if (expiryError) throw expiryError;

    const { data, error } = await db
      .from("lead_journeys")
      .select(
        "id,state,service,locality,source,primary_question,assigned_staff_id,next_action,trial_interest,offered_class_id,continuation_outcome,linked_member_id,created_at,updated_at,recipient:communication_recipients(id,display_name,phone_e164,email,preferred_locale),offered_class:classes(id,title,starts_at,room),reservations:adult_trial_reservations(id,class_id,state,booking_route,hold_expires_at,attendance_status,attendance_marked_at,created_at,class:classes(id,title,starts_at,room),payments:adult_trial_payments(id,method,provider,status,paid_at,confirmed_at,created_at))",
      )
      .eq("provider", "manual")
      .like("provider_lead_id", "adult:%")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return data ?? [];
  });

export const listAdultTrialClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ service: z.string().trim().max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const query = (supabaseAdmin as any)
      .from("classes")
      .select(
        "id,title,starts_at,room,capacity,booked_count,program_type:program_types(id,name_en,name_he,name_ar)",
      )
      .eq("status", "scheduled")
      .eq("member_visible", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(100);
    const { data: rows, error } = await query;
    if (error) throw error;
    const normalized = data.service?.trim().toLowerCase();
    if (!normalized) return rows ?? [];
    return (rows ?? []).filter((row: any) => {
      const program = row.program_type ?? {};
      return [row.title, program.name_en, program.name_he, program.name_ar]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  });

export const createAdultInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        contactName: z.string().trim().min(1).max(160),
        phoneE164: z.string().trim().max(40).optional(),
        email: z.string().trim().email().max(320).optional().or(z.literal("")),
        locale: z.enum(["ar", "he", "en"]).default("ar"),
        service: z.string().trim().min(1).max(100),
        locality: z.string().trim().max(120).optional(),
        source: z.string().trim().max(100).optional(),
        attributionEvidence: z.record(z.string(), z.string().max(200)).optional(),
        primaryQuestion: z.string().trim().max(500).optional(),
        assignedStaffId: uuid.optional(),
        trialInterest: z.boolean().default(true),
        idempotencyKey,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc("create_adult_inquiry", {
      p_actor_id: context.userId,
      p_contact_name: data.contactName,
      p_phone_e164: data.phoneE164 || null,
      p_email: data.email || null,
      p_locale: data.locale,
      p_service: data.service,
      p_locality: data.locality || null,
      p_source: data.source || null,
      p_attribution_evidence: data.attributionEvidence ?? {},
      p_primary_question: data.primaryQuestion || null,
      p_assigned_staff_id: data.assignedStaffId || context.userId,
      p_trial_interest: data.trialInterest,
      p_idempotency_key: data.idempotencyKey,
    });
    if (error) throw error;
    return result;
  });

export const offerAdultTrialClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        leadJourneyId: uuid,
        classId: uuid.optional(),
        nextAction: z.enum(["offer_class", "waiting_suitable_time", "waiting_next_schedule"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc("offer_adult_trial_class", {
      p_actor_id: context.userId,
      p_lead_journey_id: data.leadJourneyId,
      p_class_id: data.classId ?? null,
      p_next_action: data.nextAction,
    });
    if (error) throw error;
    return result;
  });

export const reserveAdultTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        leadJourneyId: uuid,
        classId: uuid,
        holdExpiresAt: z.string().datetime().optional(),
        idempotencyKey,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc("reserve_adult_trial", {
      p_actor_id: context.userId,
      p_lead_journey_id: data.leadJourneyId,
      p_class_id: data.classId,
      p_booking_route: "assisted",
      p_hold_expires_at: data.holdExpiresAt ?? null,
      p_idempotency_key: data.idempotencyKey,
    });
    if (error) throw error;
    return result;
  });

export const cancelAdultTrialReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ reservationId: uuid, reason: z.string().trim().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "cancel_adult_trial_reservation",
      {
        p_actor_id: context.userId,
        p_reservation_id: data.reservationId,
        p_reason: data.reason ?? null,
      },
    );
    if (error) throw error;
    return result;
  });

export const rescheduleAdultTrialReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reservationId: uuid, classId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "reschedule_adult_trial_reservation",
      {
        p_actor_id: context.userId,
        p_reservation_id: data.reservationId,
        p_new_class_id: data.classId,
      },
    );
    if (error) throw error;
    return result;
  });

export const requestAdultTrialPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        reservationId: uuid,
        method: z.enum(["card", "apple_pay", "bit", "cash", "other"]),
        provider: z.enum(["hyp", "manual", "other"]),
        idempotencyKey,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "request_adult_trial_payment",
      {
        p_actor_id: context.userId,
        p_reservation_id: data.reservationId,
        p_method: data.method,
        p_provider: data.provider,
        p_idempotency_key: data.idempotencyKey,
      },
    );
    if (error) throw error;
    return result;
  });

export const createAdultTrialHypCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reservationId: uuid, idempotencyKey }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const db = supabaseAdmin as any;
    const { data: settings, error: settingsError } = await db
      .from("studio_settings")
      .select("payments_enabled,payments_provider,payments_mode")
      .eq("id", 1)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.payments_enabled || settings?.payments_provider !== "hyp") {
      return { status: "provider_not_configured" as const };
    }
    const { data: requested, error: requestError } = await db.rpc(
      "claim_adult_trial_hyp_checkout",
      {
        p_actor_id: context.userId,
        p_reservation_id: data.reservationId,
        p_idempotency_key: data.idempotencyKey,
      },
    );
    if (requestError) throw requestError;
    const paymentId = requested?.payment_id as string | undefined;
    if (!paymentId) throw new Error("trial_payment_request_failed");
    if (requested?.status === "already_paid") return { status: "already_paid" as const, paymentId };
    if (requested?.status === "ready" && typeof requested?.checkout_url === "string") {
      return { status: "ready" as const, paymentId, checkoutUrl: requested.checkout_url };
    }
    if (requested?.status !== "checkout_claimed") {
      return { status: "checkout_in_progress" as const, paymentId };
    }
    const { data: payment, error: paymentError } = await db
      .from("adult_trial_payments")
      .select("id,status,metadata")
      .eq("id", paymentId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (payment?.status === "paid") return { status: "already_paid" as const, paymentId };

    const { buildHypReconciliationId, createHypPaymentPage } = await import("@/lib/hyp.server");
    const reconciliationId = buildHypReconciliationId(paymentId);
    try {
      const page = await createHypPaymentPage({
        paymentId,
        amountAgorot: 8000,
        language: "HEB",
        description: "Cloud & Core - שיעור ניסיון",
        paymentMethod: "card",
        reconciliationId,
      });
      const metadata = {
        ...(payment?.metadata ?? {}),
        payment_url: page.paymentUrl,
        hyp_reconciliation_id: reconciliationId,
        hyp_result: page.result,
      };
      const { error: updateError } = await db
        .from("adult_trial_payments")
        .update({
          status: "pending",
          provider_status: "payment_page_created",
          provider_session_id: page.token || null,
          provider_payment_id: page.cgUid || null,
          metadata,
        })
        .eq("id", paymentId)
        .eq("status", "checkout_creating");
      if (updateError) throw updateError;
      return { status: "ready" as const, paymentId, checkoutUrl: page.paymentUrl };
    } catch (error) {
      await db
        .from("adult_trial_payments")
        .update({ status: "failed", provider_status: "payment_page_failed" })
        .eq("id", paymentId)
        .eq("status", "checkout_creating");
      throw error;
    }
  });

export const reconcileAdultTrialPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paymentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: payment, error: paymentError } = await (supabaseAdmin as any)
      .from("adult_trial_payments")
      .select("method,provider,status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (payment?.provider !== "manual" || !["bit", "cash"].includes(payment.method)) {
      throw new Error("manual_reconciliation_not_allowed_for_payment");
    }
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "confirm_adult_trial_payment",
      {
        p_actor_id: context.userId,
        p_payment_id: data.paymentId,
        p_verified: true,
        p_provider_payment_id: null,
        p_provider_session_id: null,
        p_provider_status: "manually_reconciled",
      },
    );
    if (error) throw error;
    return result;
  });

export const finalizeAdultTrialAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ reservationId: uuid, status: z.enum(["attended", "no_show", "cancelled"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "finalize_adult_trial_attendance",
      {
        p_actor_id: context.userId,
        p_reservation_id: data.reservationId,
        p_attendance_status: data.status,
      },
    );
    if (error) throw error;
    return result;
  });

export const linkAdultProspectToMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadJourneyId: uuid, memberId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "link_adult_prospect_to_member",
      {
        p_actor_id: context.userId,
        p_lead_journey_id: data.leadJourneyId,
        p_member_id: data.memberId,
      },
    );
    if (error) throw error;
    return result;
  });

export const setAdultTrialContinuation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        leadJourneyId: uuid,
        outcome: z.enum(["pending", "purchased", "did_not_purchase", "unknown"]),
        packagePaymentId: uuid.optional(),
        trialPaymentId: uuid.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "record_adult_trial_continuation",
      {
        p_actor_id: context.userId,
        p_lead_journey_id: data.leadJourneyId,
        p_outcome: data.outcome,
        p_package_payment_id: data.packagePaymentId ?? null,
        p_trial_payment_id: data.trialPaymentId ?? null,
      },
    );
    if (error) throw error;
    return result;
  });

export const adultAcquisitionExport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await (supabaseAdmin as any)
      .from("adult_acquisition_funnel_export")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data ?? [];
  });
