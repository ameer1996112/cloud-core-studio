import { describe, expect, test } from "bun:test";

const migration = await Bun.file(
  new URL("../../supabase/migrations/20260903180000_adult_trial_funnel_p0.sql", import.meta.url),
).text();

describe("adult trial P0 database contract", () => {
  test("keeps prospects outside auth members and records canonical events", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.adult_trial_reservations");
    expect(migration).toContain("communication_recipient_id uuid NOT NULL");
    expect(migration).not.toContain("INSERT INTO public.members");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.adult_acquisition_events");
    expect(migration).toContain("adult_inquiry_created");
    expect(migration).toContain("active_paying_adult_created");
    expect(migration).not.toMatch(/Meta Pixel|Conversions API|fbq\s*\(/i);
  });

  test("uses transactional RPC seams for capacity, verification, and release", () => {
    for (const routine of [
      "reserve_adult_trial",
      "cancel_adult_trial_reservation",
      "reschedule_adult_trial_reservation",
      "expire_adult_trial_holds",
      "confirm_adult_trial_payment",
      "claim_adult_trial_hyp_checkout",
      "finalize_adult_trial_attendance",
    ]) {
      expect(migration).toContain(`FUNCTION public.${routine}`);
    }
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("booked_count = booked_count + 1");
    expect(migration).toContain("booked_count=GREATEST(0,booked_count-1)");
    expect(migration).toContain("IF NOT p_verified THEN");
  });

  test("makes trial payment selection non-authoritative until reconciliation", () => {
    expect(migration).toContain("status text NOT NULL DEFAULT 'requested'");
    expect(migration).toContain(
      "status = 'paid' AND paid_at IS NOT NULL AND confirmed_at IS NOT NULL",
      "status <> 'paid' AND paid_at IS NULL AND confirmed_at IS NULL",
    );
    expect(migration).toContain("trial_credit_applied_to_payment_id");
    expect(migration).toContain("adult_trial_payments_one_credit_per_package_payment_idx");
    expect(migration).toContain("attendance_status='attended'");
    expect(migration).toContain("confirmed_at IS NOT NULL AND amount > 0");
    expect(migration).toContain("recipient_already_linked");
    expect(migration).toContain("p_provider_order_id IS DISTINCT FROM v_payment.id::text");
    expect(migration).toContain("p_provider_amount IS DISTINCT FROM v_payment.amount");
    expect(migration).toContain("p_provider_currency");
    expect(migration).toContain("payment_not_pending");
    expect(migration).toContain("provider_status='reservation_cancelled'");
    expect(migration).toContain("reservation_not_active");
  });

  test("uses a class-first, deterministic lock order for every capacity mutation", () => {
    const expiry = migration.slice(
      migration.indexOf("FUNCTION public.expire_adult_trial_holds"),
      migration.indexOf("FUNCTION public.create_adult_inquiry"),
    );
    const reserve = migration.slice(
      migration.indexOf("FUNCTION public.reserve_adult_trial"),
      migration.indexOf("FUNCTION public.cancel_adult_trial_reservation"),
    );
    const cancel = migration.slice(
      migration.indexOf("FUNCTION public.cancel_adult_trial_reservation"),
      migration.indexOf("FUNCTION public.reschedule_adult_trial_reservation"),
    );
    const reschedule = migration.slice(
      migration.indexOf("FUNCTION public.reschedule_adult_trial_reservation"),
      migration.indexOf("FUNCTION public.request_adult_trial_payment"),
    );
    const attendance = migration.slice(
      migration.indexOf("FUNCTION public.finalize_adult_trial_attendance"),
      migration.indexOf("FUNCTION public.link_adult_prospect_to_member"),
    );

    expect(expiry.indexOf("FOR UPDATE OF c")).toBeLessThan(
      expiry.indexOf("WHERE class_id = v_class.id AND state = 'hold'"),
    );
    expect(expiry).toContain("ORDER BY c.id");
    expect(reserve.indexOf("FROM public.classes WHERE id = p_class_id FOR UPDATE")).toBeLessThan(
      reserve.indexOf("PERFORM public.expire_adult_trial_holds"),
    );
    expect(reserve.indexOf("WHERE id = p_lead_journey_id;")).toBeLessThan(
      reserve.indexOf("FROM public.classes WHERE id = p_class_id FOR UPDATE"),
    );
    expect(reserve.indexOf("WHERE id = p_lead_journey_id FOR UPDATE")).toBeGreaterThan(
      reserve.indexOf("FROM public.classes WHERE id = p_class_id FOR UPDATE"),
    );
    for (const operation of [cancel, attendance]) {
      expect(operation.indexOf("FOR UPDATE OF c")).toBeLessThan(
        operation.indexOf("WHERE id=p_reservation_id FOR UPDATE"),
      );
    }
    expect(reschedule.indexOf("ORDER BY c.id FOR UPDATE")).toBeLessThan(
      reschedule.indexOf("WHERE id=p_reservation_id FOR UPDATE"),
    );
    expect(reschedule).toContain("reservation_changed_retry");
  });

  test("enforces one active HYP checkout and an append-only event ledger", () => {
    expect(migration).toContain("adult_trial_payments_one_active_hyp_checkout_per_reservation");
    expect(migration).toContain("status IN ('checkout_creating','pending')");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.claim_adult_trial_hyp_checkout");
    expect(migration).toContain("REVOKE ALL ON public.adult_acquisition_events FROM service_role");
    expect(migration).toContain(
      "GRANT SELECT, INSERT ON public.adult_acquisition_events TO service_role",
    );
    expect(migration).toContain("adult_acquisition_events_are_append_only");
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON public.adult_acquisition_events");
  });

  test("keeps P0 table mutations behind service-role RPCs", () => {
    expect(migration).toContain(
      "REVOKE ALL ON public.adult_trial_reservations, public.adult_trial_payments, public.adult_acquisition_events FROM anon, authenticated",
    );
    expect(migration).toContain(
      'CREATE POLICY "admins read adult trial reservations" ON public.adult_trial_reservations',
    );
    expect(migration).toContain(
      'CREATE POLICY "admins read adult trial payments" ON public.adult_trial_payments',
    );
    expect(migration).toContain(
      "GRANT SELECT ON public.adult_trial_reservations, public.adult_trial_payments, public.adult_acquisition_events TO authenticated",
    );
  });

  test("returns the canonical active reservation when a different idempotency key collides", () => {
    const reserve = migration.slice(
      migration.indexOf("FUNCTION public.reserve_adult_trial"),
      migration.indexOf("FUNCTION public.cancel_adult_trial_reservation"),
    );
    expect(reserve).toContain(
      "WHERE class_id = p_class_id AND communication_recipient_id = v_journey.communication_recipient_id",
    );
    expect(reserve).toContain("reservation_conflict");
  });
});
