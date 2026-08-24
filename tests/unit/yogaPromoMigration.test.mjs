import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = [
  "20260824120000_yoga_lina_launch_promotion.sql",
  "20260824130000_yoga_promotion_exact_class.sql",
]
  .map((file) =>
    readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"),
  )
  .join("\n");
const classDetail = readFileSync(
  new URL("../../src/components/member/ClassDetailSheet.tsx", import.meta.url),
  "utf8",
);

describe("Yoga with Lina promotion database contract", () => {
  test("ships disabled with a ten-claim cap", () => {
    expect(migration).toContain("'yoga-lina-launch', 'Yoga with Lina Launch', false, 10");
    expect(migration).toContain("CHECK (claimed_count <= claim_limit)");
  });

  test("claims are unique, row locked, and issue one restricted entitlement", () => {
    expect(migration).toContain("UNIQUE (promotion_id, user_id)");
    expect(migration).toContain("WHERE slug = p_slug FOR UPDATE");
    expect(migration).toContain(
      "credit_quantity integer NOT NULL DEFAULT 1 CHECK (credit_quantity = 1)",
    );
    expect(migration).toContain("promotion_eligible_class_types");
  });

  test("does not add promotional credits to the general member balance", () => {
    const claimFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.claim_promotion"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.expire_promotion_entitlements"),
    );
    expect(claimFunction).not.toContain("UPDATE public.members SET remaining_credits");
  });

  test("preserves ordinary member and admin paid-credit safeguards", () => {
    expect(migration).toContain(
      "IF NOT FOUND THEN RETURN jsonb_build_object('status','error','message','member_not_found'); END IF;",
    );
    expect(migration).toContain("PERFORM public.sweep_member_credits(p_member_id);");
  });

  test("makes configured class instances authoritative for redemption", () => {
    expect(migration).toContain("CREATE TABLE public.promotion_eligible_classes");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.promotion_allows_class");
    expect(migration).toContain("pc.slug = 'yoga-lina-launch'");
    expect(migration).toContain("pec.class_id = p_class_id");
    expect(migration).toContain("WHERE slug='yoga-lina-launch';");
    expect(migration).toContain("PROMO_CREDIT_NOT_VALID_FOR_CLASS");
    expect(migration).toContain("public.promotion_allows_class(v_ent.promotion_id, v_class.id)");
    expect(migration).toContain("credit_expiry_must_match_class_start");
  });

  test("restores the restricted entitlement on timely cancellation only", () => {
    expect(migration).toContain(
      "p_booking_id,'timely member cancellation','expired before cancellation restoration'",
    );
    expect(migration).toContain(
      "IF now()>v_deadline THEN RETURN jsonb_build_object('status','window_passed'",
    );
    expect(migration).toContain("'expired before cancellation restoration'");
    expect(migration).toContain("cannot_restore_active_booking");
  });

  test("reports availability separately from historical claim ownership", () => {
    expect(migration).toContain("'entitlementStatus', v_entitlement_status");
    expect(migration).toContain(
      "'creditAvailable', v_entitlement_status = 'active' AND v_entitlement_expires_at > v_now",
    );
    expect(migration).toContain("'eligibleClassTypeId', v_class_type_id");
    expect(migration).toContain("'eligibleClassId', v_class_id");
  });

  test("direct writes are not granted to members", () => {
    expect(migration).toContain("ALTER TABLE public.promotion_claims ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("GRANT SELECT ON public.promotion_claims");
    expect(migration).not.toMatch(/GRANT\s+(INSERT|ALL).*promotion_claims.*authenticated/i);
  });

  test("class details advertise the gift only for the exact configured class", () => {
    const exactMatch = classDetail.slice(
      classDetail.indexOf("const matchesYogaPromoClass"),
      classDetail.indexOf("const title ="),
    );
    expect(exactMatch).toContain(
      "yogaPromo.data?.eligibleClassId && yogaPromo.data.eligibleClassId === cls?.id",
    );
    expect(exactMatch).not.toContain("eligibleClassTypeId");
  });
});
