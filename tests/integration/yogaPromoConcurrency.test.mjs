import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.PROMO_TEST_SUPABASE_URL;
const serviceKey = process.env.PROMO_TEST_SERVICE_ROLE_KEY;
const publishableKey = process.env.PROMO_TEST_PUBLISHABLE_KEY;
const enabled = Boolean(
  url && serviceKey && publishableKey && process.env.PROMO_TEST_ALLOW_MUTATION === "true",
);

describe.skipIf(!enabled)("Yoga promotion real database concurrency", () => {
  let admin;
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = `yoga-promo-concurrency-${suffix}`;
  const programSlug = `yoga-lina-concurrency-${suffix}`;
  const password = `Cc!${crypto.randomUUID()}aA1`;
  const userIds = [];
  const classIds = [];
  let campaignId;
  let programTypeId;

  beforeAll(async () => {
    admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const startsAt = new Date(Date.now() - 2_000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const type = await admin
      .from("program_types")
      .insert({
        slug: programSlug,
        name_en: "Yoga with Lina concurrency",
        name_he: "יוגה עם לינה בדיקת עומס",
        name_ar: "يوغا مع لينا اختبار تزامن",
        active: true,
      })
      .select("id")
      .single();
    if (type.error) throw type.error;
    programTypeId = type.data.id;
    const campaign = await admin
      .from("promotion_campaigns")
      .insert({
        slug,
        name: "Concurrency test",
        enabled: true,
        starts_at: startsAt,
        ends_at: endsAt,
        claim_limit: 10,
        credit_quantity: 1,
        new_accounts_only: true,
        credit_expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (campaign.error) throw campaign.error;
    campaignId = campaign.data.id;
    const relation = await admin
      .from("promotion_eligible_class_types")
      .insert({ promotion_id: campaignId, program_type_id: programTypeId });
    if (relation.error) throw relation.error;
  });

  afterAll(async () => {
    if (userIds.length) await admin.from("bookings").delete().in("member_id", userIds);
    if (classIds.length) await admin.from("classes").delete().in("id", classIds);
    if (campaignId) {
      const entitlementIds = await admin
        .from("promotion_entitlements")
        .select("id")
        .eq("promotion_id", campaignId);
      const ids = (entitlementIds.data ?? []).map((row) => row.id);
      if (ids.length)
        await admin.from("promotion_entitlement_audit").delete().in("entitlement_id", ids);
      await admin.from("promotion_entitlements").delete().eq("promotion_id", campaignId);
      await admin.from("promotion_claims").delete().eq("promotion_id", campaignId);
      await admin.from("promotion_claim_rate_limits").delete().eq("promotion_id", campaignId);
      await admin.from("promotion_attributions").delete().eq("promotion_id", campaignId);
      await admin.from("promotion_eligible_class_types").delete().eq("promotion_id", campaignId);
      await admin.from("promotion_campaigns").delete().eq("id", campaignId);
    }
    if (programTypeId) await admin.from("program_types").delete().eq("id", programTypeId);
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  test("ten simultaneous users succeed and the eleventh is sold out", async () => {
    const clients = await Promise.all(
      Array.from({ length: 11 }, async (_, index) => {
        const email = `promo-concurrency-${suffix}-${index}@example.invalid`;
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: `Concurrency member ${index}`,
            preferred_language: "en",
            notification_consent_version: "2",
            whatsapp_signup_opt_in_v2: false,
            marketing_updates_enabled: false,
          },
        });
        if (created.error) throw created.error;
        userIds.push(created.data.user.id);
        const client = createClient(url, publishableKey, { auth: { persistSession: false } });
        const signed = await client.auth.signInWithPassword({ email, password });
        if (signed.error) throw signed.error;
        const attribution = await client.rpc("begin_promotion_attribution", {
          p_slug: slug,
          p_utm_source: "integration",
          p_utm_medium: "test",
          p_utm_campaign: suffix,
        });
        if (attribution.error) throw attribution.error;
        return { client, token: attribution.data, userId: created.data.user.id };
      }),
    );

    const results = await Promise.all(
      clients.map(({ client, token }) =>
        client.rpc("claim_promotion", {
          p_slug: slug,
          p_attribution_token: token,
          p_idempotency_key: crypto.randomUUID(),
        }),
      ),
    );
    for (const result of results) if (result.error) throw result.error;
    const statuses = results.map((result) => result.data.status);
    expect(statuses.filter((status) => status === "claimed")).toHaveLength(10);
    expect(statuses.filter((status) => status === "sold_out")).toHaveLength(1);

    const [campaign, claims, entitlements] = await Promise.all([
      admin.from("promotion_campaigns").select("claimed_count").eq("id", campaignId).single(),
      admin
        .from("promotion_claims")
        .select("id", { count: "exact", head: true })
        .eq("promotion_id", campaignId),
      admin
        .from("promotion_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("promotion_id", campaignId),
    ]);
    expect(campaign.data.claimed_count).toBe(10);
    expect(claims.count).toBe(10);
    expect(entitlements.count).toBe(10);

    const winnerIndex = statuses.findIndex((status) => status === "claimed");
    const winner = clients[winnerIndex];
    const winnerUserId = winner.userId;
    const winnerEntitlementId = results[winnerIndex].data.entitlementId;
    const ineligibleType = await admin
      .from("program_types")
      .select("id")
      .neq("id", programTypeId)
      .limit(1)
      .single();
    if (ineligibleType.error) throw ineligibleType.error;
    const startsAt = new Date(Date.now() + 48 * 60 * 60_000).toISOString();
    const classes = await admin
      .from("classes")
      .insert([
        {
          title: "Yoga with Lina eligibility test",
          starts_at: startsAt,
          duration_minutes: 60,
          capacity: 12,
          room: "Local test room",
          energy: "calm",
          credit_cost: 1,
          program_type_id: programTypeId,
        },
        {
          title: "Ineligible promotion test",
          starts_at: startsAt,
          duration_minutes: 60,
          capacity: 12,
          room: "Local test room",
          energy: "calm",
          credit_cost: 1,
          program_type_id: ineligibleType.data.id,
        },
      ])
      .select("id,program_type_id");
    if (classes.error) throw classes.error;
    classIds.push(...classes.data.map((row) => row.id));
    const eligibleClass = classes.data.find((row) => row.program_type_id === programTypeId);
    const ineligibleClass = classes.data.find((row) => row.program_type_id !== programTypeId);

    const forged = await winner.client.rpc("book_class_v3", {
      p_actor_id: winnerUserId,
      p_class_id: ineligibleClass.id,
      p_promotion_entitlement_id: winnerEntitlementId,
    });
    if (forged.error) throw forged.error;
    expect(forged.data).toMatchObject({
      status: "error",
      message: "PROMO_CREDIT_NOT_VALID_FOR_CLASS",
    });

    const ordinaryIndex = statuses.findIndex((status) => status === "sold_out");
    const ordinary = clients[ordinaryIndex];
    const [funded, fundingLedger] = await Promise.all([
      admin.from("members").update({ remaining_credits: 1 }).eq("id", ordinary.userId),
      admin.from("credit_transactions").insert({
        member_id: ordinary.userId,
        amount_delta: 1,
        reason: "compatibility test manual credit",
        created_by: ordinary.userId,
      }),
    ]);
    if (funded.error) throw funded.error;
    if (fundingLedger.error) throw fundingLedger.error;
    const ordinaryBooking = await ordinary.client.rpc("book_class_v2", {
      p_actor_id: ordinary.userId,
      p_class_id: ineligibleClass.id,
    });
    if (ordinaryBooking.error) throw ordinaryBooking.error;
    expect(ordinaryBooking.data.status).toBe("booked");
    expect(ordinaryBooking.data.promotion_entitlement_id).toBeNull();
    const ordinaryBalance = await admin
      .from("members")
      .select("remaining_credits")
      .eq("id", ordinary.userId)
      .single();
    expect(ordinaryBalance.data.remaining_credits).toBe(0);

    const booked = await winner.client.rpc("book_class_v3", {
      p_actor_id: winnerUserId,
      p_class_id: eligibleClass.id,
      p_promotion_entitlement_id: winnerEntitlementId,
    });
    if (booked.error) throw booked.error;
    expect(booked.data.status).toBe("booked");
    expect(booked.data.promotion_entitlement_id).toBe(winnerEntitlementId);
    const financialState = await Promise.all([
      admin
        .from("promotion_entitlements")
        .select("status,consumed_booking_id")
        .eq("id", winnerEntitlementId)
        .single(),
      admin.from("members").select("remaining_credits").eq("id", winnerUserId).single(),
    ]);
    expect(financialState[0].data.status).toBe("consumed");
    expect(financialState[1].data.remaining_credits).toBe(0);

    const cancelled = await admin.rpc("member_cancel_booking", {
      p_actor_id: winnerUserId,
      p_booking_id: booked.data.booking_id,
    });
    if (cancelled.error) throw cancelled.error;
    expect(cancelled.data.status).toBe("cancelled");
    const restored = await admin
      .from("promotion_entitlements")
      .select("status,consumed_booking_id")
      .eq("id", winnerEntitlementId)
      .single();
    expect(restored.data).toMatchObject({ status: "active", consumed_booking_id: null });
  }, 60_000);
});
