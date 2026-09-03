import { afterEach, describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

// This suite intentionally requires a disposable Supabase project populated
// only with synthetic data. Provide three dedicated empty classes: one with
// capacity 1 for final-seat races and two with capacity >= 2 for reschedules.
const url = process.env.ADULT_TRIAL_TEST_SUPABASE_URL;
const serviceKey = process.env.ADULT_TRIAL_TEST_SERVICE_ROLE_KEY;
const actorId = process.env.ADULT_TRIAL_TEST_ADMIN_ID;
const finalSeatClassId = process.env.ADULT_TRIAL_TEST_FINAL_SEAT_CLASS_ID;
const classAId = process.env.ADULT_TRIAL_TEST_CLASS_A_ID;
const classBId = process.env.ADULT_TRIAL_TEST_CLASS_B_ID;
const publishableKey = process.env.ADULT_TRIAL_TEST_PUBLISHABLE_KEY;
const enabled = Boolean(
  url &&
  serviceKey &&
  actorId &&
  finalSeatClassId &&
  classAId &&
  classBId &&
  process.env.ADULT_TRIAL_TEST_ALLOW_MUTATION === "true",
);

describe.skipIf(!enabled)("Adult trial P0 disposable-Postgres concurrency", () => {
  // The fallback only makes registration of skipped tests safe; no request is
  // made unless every disposable-environment variable above is supplied.
  const db = createClient(url ?? "http://127.0.0.1:54321", serviceKey ?? "test-key", {
    auth: { persistSession: false },
  });
  const reservations = new Set();

  async function rpc(name, args) {
    const result = await db.rpc(name, args);
    if (result.error) throw result.error;
    return result.data;
  }

  async function inquiry(label) {
    const idempotencyKey = `adult-p0-it-${label}-${crypto.randomUUID()}`;
    const result = await rpc("create_adult_inquiry", {
      p_actor_id: actorId,
      p_contact_name: `Synthetic ${label}`,
      p_phone_e164: null,
      p_email: `${idempotencyKey}@example.invalid`,
      p_locale: "en",
      p_service: "adult-p0-test",
      p_locality: "synthetic",
      p_source: "integration_test",
      p_attribution_evidence: {},
      p_primary_question: null,
      p_assigned_staff_id: actorId,
      p_trial_interest: true,
      p_idempotency_key: idempotencyKey,
    });
    return result.lead_journey_id;
  }

  async function reserve(leadJourneyId, classId, key, holdExpiresAt = null) {
    const result = await rpc("reserve_adult_trial", {
      p_actor_id: actorId,
      p_lead_journey_id: leadJourneyId,
      p_class_id: classId,
      p_booking_route: "assisted",
      p_hold_expires_at: holdExpiresAt,
      p_idempotency_key: key,
    });
    if (result.reservation_id) reservations.add(result.reservation_id);
    return result;
  }

  afterEach(async () => {
    await Promise.all(
      [...reservations].map((reservationId) =>
        db.rpc("cancel_adult_trial_reservation", {
          p_actor_id: actorId,
          p_reservation_id: reservationId,
          p_reason: "integration cleanup",
        }),
      ),
    );
    reservations.clear();
  });

  test("final-seat and duplicate-reservation races preserve capacity", async () => {
    const [leadA, leadB] = await Promise.all([inquiry("final-a"), inquiry("final-b")]);
    const [first, second] = await Promise.all([
      reserve(leadA, finalSeatClassId, crypto.randomUUID()),
      reserve(leadB, finalSeatClassId, crypto.randomUUID()),
    ]);
    expect([first.status, second.status].filter((status) => status === "booked")).toHaveLength(1);
    expect([first.status, second.status].filter((status) => status === "full")).toHaveLength(1);
    const finalClass = await db
      .from("classes")
      .select("booked_count,capacity")
      .eq("id", finalSeatClassId)
      .single();
    if (finalClass.error) throw finalClass.error;
    expect(finalClass.data.booked_count).toBe(finalClass.data.capacity);

    const duplicate = await reserve(leadA, classAId, "adult-p0-repeat-key");
    const duplicateRetry = await reserve(leadA, classAId, "adult-p0-repeat-key");
    expect(duplicateRetry.status).toBe("already_reserved");
    expect(duplicateRetry.reservation_id).toBe(duplicate.reservation_id);
  });

  test("a different idempotency key returns the existing canonical reservation without another booking event", async () => {
    const lead = await inquiry("same-recipient-different-key");
    const before = await db.from("classes").select("booked_count").eq("id", classAId).single();
    if (before.error) throw before.error;

    const first = await reserve(lead, classAId, crypto.randomUUID());
    const retry = await reserve(lead, classAId, crypto.randomUUID());
    expect(retry.status).toBe("already_reserved");
    expect(retry.reservation_id).toBe(first.reservation_id);

    const [after, active, bookingEvents] = await Promise.all([
      db.from("classes").select("booked_count").eq("id", classAId).single(),
      db
        .from("adult_trial_reservations")
        .select("id", { count: "exact" })
        .eq("lead_journey_id", lead)
        .in("state", ["hold", "booked"]),
      db
        .from("adult_acquisition_events")
        .select("id", { count: "exact" })
        .eq("reservation_id", first.reservation_id)
        .eq("event_type", "trial_booking_created"),
    ]);
    if (after.error || active.error || bookingEvents.error) {
      throw after.error ?? active.error ?? bookingEvents.error;
    }
    expect(after.data.booked_count).toBe(before.data.booked_count + 1);
    expect(active.count).toBe(1);
    expect(bookingEvents.count).toBe(1);
  });

  test("hold expiry, cancellation, and reschedules do not leak or double-release capacity", async () => {
    const holdLead = await inquiry("hold");
    const hold = await reserve(
      holdLead,
      classAId,
      crypto.randomUUID(),
      new Date(Date.now() + 250).toISOString(),
    );
    await Bun.sleep(400);
    const expiry = await Promise.all([
      rpc("expire_adult_trial_holds", { p_actor_id: actorId, p_class_id: classAId }),
      rpc("expire_adult_trial_holds", { p_actor_id: actorId, p_class_id: classAId }),
    ]);
    expect(expiry.reduce((sum, count) => sum + Number(count), 0)).toBe(1);

    const [oldLead, newLead] = await Promise.all([inquiry("cancel-old"), inquiry("cancel-new")]);
    const old = await reserve(oldLead, finalSeatClassId, crypto.randomUUID());
    const [cancelled, replacement] = await Promise.all([
      rpc("cancel_adult_trial_reservation", {
        p_actor_id: actorId,
        p_reservation_id: old.reservation_id,
        p_reason: "race",
      }),
      reserve(newLead, finalSeatClassId, crypto.randomUUID()),
    ]);
    expect(cancelled.status).toBe("cancelled");
    expect(replacement.status).toBe("booked");

    const [leadA, leadB] = await Promise.all([inquiry("swap-a"), inquiry("swap-b")]);
    const [a, b] = await Promise.all([
      reserve(leadA, classAId, crypto.randomUUID()),
      reserve(leadB, classBId, crypto.randomUUID()),
    ]);
    const swaps = await Promise.all([
      rpc("reschedule_adult_trial_reservation", {
        p_actor_id: actorId,
        p_reservation_id: a.reservation_id,
        p_new_class_id: classBId,
      }),
      rpc("reschedule_adult_trial_reservation", {
        p_actor_id: actorId,
        p_reservation_id: b.reservation_id,
        p_new_class_id: classAId,
      }),
    ]);
    expect(swaps.map((item) => item.status).sort()).toEqual(["rescheduled", "rescheduled"]);
    // The previously expired hold is never a cancellable active reservation.
    reservations.delete(hold.reservation_id);
  });

  test("concurrent card checkout claims leave exactly one active HYP payment", async () => {
    const lead = await inquiry("checkout");
    const booking = await reserve(lead, classAId, crypto.randomUUID());
    const [first, second] = await Promise.all([
      rpc("claim_adult_trial_hyp_checkout", {
        p_actor_id: actorId,
        p_reservation_id: booking.reservation_id,
        p_idempotency_key: crypto.randomUUID(),
      }),
      rpc("claim_adult_trial_hyp_checkout", {
        p_actor_id: actorId,
        p_reservation_id: booking.reservation_id,
        p_idempotency_key: crypto.randomUUID(),
      }),
    ]);
    expect([first.status, second.status].sort()).toEqual([
      "checkout_claimed",
      "checkout_in_progress",
    ]);
    const payments = await db
      .from("adult_trial_payments")
      .select("id,status", { count: "exact" })
      .eq("reservation_id", booking.reservation_id)
      .eq("provider", "hyp")
      .in("status", ["checkout_creating", "pending"]);
    expect(payments.error).toBeNull();
    expect(payments.count).toBe(1);
  });

  test("service-role ledger writes are immutable after insertion", async () => {
    const lead = await inquiry("ledger");
    const events = await db
      .from("adult_acquisition_events")
      .select("id")
      .eq("lead_journey_id", lead)
      .eq("event_type", "adult_inquiry_created")
      .limit(1)
      .single();
    if (events.error) throw events.error;
    const update = await db
      .from("adult_acquisition_events")
      .update({ source: "mutated" })
      .eq("id", events.data.id);
    const deletion = await db.from("adult_acquisition_events").delete().eq("id", events.data.id);
    expect(update.error?.message).toMatch(
      /adult_acquisition_events_are_append_only|permission denied/i,
    );
    expect(deletion.error?.message).toMatch(
      /adult_acquisition_events_are_append_only|permission denied/i,
    );
  });

  test.skipIf(!publishableKey)(
    "an authenticated admin cannot directly mutate P0 reservations or payments",
    async () => {
      const password = `Cc!${crypto.randomUUID()}aA1`;
      const email = `adult-p0-rls-${crypto.randomUUID()}@example.invalid`;
      const created = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: "Adult P0 RLS admin",
          notification_consent_version: "2",
          marketing_updates_enabled: false,
          whatsapp_signup_opt_in_v2: false,
        },
      });
      if (created.error) throw created.error;
      const adminUserId = created.data.user.id;
      try {
        const role = await db.from("profiles").update({ role: "admin" }).eq("id", adminUserId);
        if (role.error) throw role.error;
        const client = createClient(url, publishableKey, { auth: { persistSession: false } });
        const signedIn = await client.auth.signInWithPassword({ email, password });
        if (signedIn.error) throw signedIn.error;

        const lead = await inquiry("admin-direct-mutation");
        const booking = await reserve(lead, classAId, crypto.randomUUID());
        const requested = await rpc("request_adult_trial_payment", {
          p_actor_id: actorId,
          p_reservation_id: booking.reservation_id,
          p_method: "cash",
          p_provider: "manual",
          p_idempotency_key: crypto.randomUUID(),
        });

        const [reservationMutation, paymentMutation] = await Promise.all([
          client
            .from("adult_trial_reservations")
            .update({ state: "cancelled", hold_expires_at: null })
            .eq("id", booking.reservation_id),
          client
            .from("adult_trial_payments")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              confirmed_at: new Date().toISOString(),
            })
            .eq("id", requested.payment_id),
        ]);
        expect(reservationMutation.error?.code).toBe("42501");
        expect(paymentMutation.error?.code).toBe("42501");

        const [reservation, payment] = await Promise.all([
          db
            .from("adult_trial_reservations")
            .select("state")
            .eq("id", booking.reservation_id)
            .single(),
          db.from("adult_trial_payments").select("status").eq("id", requested.payment_id).single(),
        ]);
        if (reservation.error || payment.error) throw reservation.error ?? payment.error;
        expect(reservation.data.state).toBe("booked");
        expect(payment.data.status).toBe("requested");
      } finally {
        await db.auth.admin.deleteUser(adminUserId);
      }
    },
  );
});
