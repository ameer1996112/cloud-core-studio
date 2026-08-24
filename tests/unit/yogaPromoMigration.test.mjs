import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260824120000_yoga_lina_launch_promotion.sql",
    import.meta.url,
  ),
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

  test("rejects a forged entitlement for a different class type", () => {
    expect(migration).toContain("PROMO_CREDIT_NOT_VALID_FOR_CLASS");
    expect(migration).toContain("pct.program_type_id=v_class.program_type_id");
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
  });

  test("direct writes are not granted to members", () => {
    expect(migration).toContain("ALTER TABLE public.promotion_claims ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("GRANT SELECT ON public.promotion_claims");
    expect(migration).not.toMatch(/GRANT\s+(INSERT|ALL).*promotion_claims.*authenticated/i);
  });
});
