import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { YOGA_PROMO_SLUG } from "@/lib/yogaPromo";

async function requireAdmin(context: any) {
  const { data } = await context.supabase
    .from("profiles")
    .select("role")
    .eq("id", context.userId)
    .maybeSingle();
  if (data?.role !== "admin") throw new Error("forbidden");
}

export const getYogaPromotionAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = context.supabase as any;
    const { data: campaign, error } = await db
      .from("promotion_campaigns")
      .select("*")
      .eq("slug", YOGA_PROMO_SLUG)
      .single();
    if (error) throw error;
    const [types, eligible, entitlements] = await Promise.all([
      db.from("program_types").select("id,slug,name_en,name_he,name_ar,active").order("sort_order"),
      db
        .from("promotion_eligible_class_types")
        .select("program_type_id")
        .eq("promotion_id", campaign.id),
      db
        .from("promotion_entitlements")
        .select("id,status,member_id,issued_at,expires_at,consumed_at")
        .eq("promotion_id", campaign.id)
        .order("issued_at", { ascending: false }),
    ]);
    for (const result of [types, eligible, entitlements]) if (result.error) throw result.error;
    const rows = entitlements.data ?? [];
    const entitlementIds = rows.map((row: any) => row.id);
    const audit = entitlementIds.length
      ? await db
          .from("promotion_entitlement_audit")
          .select("id,entitlement_id,actor_id,action,reason,created_at")
          .in("entitlement_id", entitlementIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [], error: null };
    if (audit.error) throw audit.error;
    return {
      campaign,
      programTypes: types.data ?? [],
      eligibleProgramTypeIds: (eligible.data ?? []).map((row: any) => row.program_type_id),
      entitlements: rows,
      audit: audit.data ?? [],
      metrics: {
        claims: campaign.claimed_count,
        remaining: Math.max(campaign.claim_limit - campaign.claimed_count, 0),
        used: rows.filter((row: any) => row.status === "consumed").length,
        restored: (audit.data ?? []).filter((row: any) =>
          ["restored", "admin_restored"].includes(row.action),
        ).length,
        expired: rows.filter((row: any) => row.status === "expired").length,
      },
    };
  });

export const updateYogaPromotionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        enabled: z.boolean(),
        startsAt: z.string().datetime().nullable(),
        endsAt: z.string().datetime().nullable(),
        claimLimit: z.number().int().positive(),
        creditExpiresAt: z.string().datetime().nullable(),
        programTypeIds: z.array(z.string().uuid()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: result, error } = await (context.supabase as any).rpc("admin_update_promotion", {
      p_actor_id: context.userId,
      p_slug: YOGA_PROMO_SLUG,
      p_enabled: data.enabled,
      p_starts_at: data.startsAt,
      p_ends_at: data.endsAt,
      p_claim_limit: data.claimLimit,
      p_credit_expires_at: data.creditExpiresAt,
      p_program_type_ids: data.programTypeIds,
    });
    if (error) throw error;
    if (result?.status !== "ok") throw new Error(result?.message ?? "promotion_update_failed");
    return result;
  });

export const adjustYogaPromotionEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        entitlementId: z.string().uuid(),
        action: z.enum(["revoke", "restore"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: result, error } = await (context.supabase as any).rpc(
      "admin_adjust_promotion_entitlement",
      {
        p_actor_id: context.userId,
        p_entitlement_id: data.entitlementId,
        p_action: data.action,
        p_reason: data.reason,
      },
    );
    if (error) throw error;
    if (result?.status !== "ok") throw new Error(result?.message ?? "adjustment_failed");
    return result;
  });
