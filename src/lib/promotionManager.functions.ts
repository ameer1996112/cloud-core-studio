import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PROMOTION_LANGUAGES,
  promotionCampaignDraftSchema,
  validatePromotionForActivation,
} from "@/lib/promotionCampaigns";

const idSchema = z.object({ promotionId: z.string().uuid() });
const saveSchema = promotionCampaignDraftSchema.extend({
  promotionId: z.string().uuid().optional(),
});

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.role !== "admin") throw new Error("Admin access required");
  return db;
}

export const getPromotionManager = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.userId);
    const [campaigns, programTypes, entitlements, engagement, deliveries, audit] =
      await Promise.all([
        db.from("promotion_campaigns").select("*").order("created_at", { ascending: false }),
        db
          .from("program_types")
          .select("id,slug,name_en,name_he,name_ar,active")
          .order("sort_order"),
        db.from("promotion_entitlements").select("promotion_id,status"),
        db.from("promotion_engagement_events").select("promotion_id,event_type"),
        db.from("promotion_deliveries").select("promotion_id,status,channel"),
        db
          .from("promotion_campaign_audit")
          .select("id,promotion_id,action,previous_status,next_status,metadata,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    for (const result of [campaigns, programTypes, entitlements, engagement, deliveries, audit]) {
      if (result.error) throw result.error;
    }
    const campaignIds = (campaigns.data ?? []).map((campaign: any) => campaign.id);
    const { data: eligible, error: eligibleError } = campaignIds.length
      ? await db
          .from("promotion_eligible_class_types")
          .select("promotion_id,program_type_id")
          .in("promotion_id", campaignIds)
      : { data: [], error: null };
    if (eligibleError) throw eligibleError;
    return {
      campaigns: (campaigns.data ?? []).map((campaign: any) => ({
        ...campaign,
        eligibleProgramTypeIds: (eligible ?? [])
          .filter((row: any) => row.promotion_id === campaign.id)
          .map((row: any) => row.program_type_id),
        metrics: {
          claims: campaign.claimed_count,
          remaining: Math.max(campaign.claim_limit - campaign.claimed_count, 0),
          impressions: (engagement.data ?? []).filter(
            (row: any) => row.promotion_id === campaign.id && row.event_type === "impression",
          ).length,
          clicks: (engagement.data ?? []).filter(
            (row: any) => row.promotion_id === campaign.id && row.event_type === "cta_clicked",
          ).length,
          bookings: (entitlements.data ?? []).filter(
            (row: any) => row.promotion_id === campaign.id && row.status === "consumed",
          ).length,
          sent: (deliveries.data ?? []).filter(
            (row: any) => row.promotion_id === campaign.id && row.status === "sent",
          ).length,
        },
      })),
      programTypes: programTypes.data ?? [],
      audit: audit.data ?? [],
    };
  });

export const savePromotionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.userId);
    const row = {
      slug: data.slug,
      name: data.name,
      promotion_type: data.promotionType,
      status: "draft",
      enabled: false,
      localized_content: data.localizedContent,
      audience: data.audience,
      channels: data.channels,
      whatsapp_templates: data.whatsappTemplates ?? {},
      action_url: data.actionUrl,
      is_public: data.public,
      is_featured: data.featured,
      priority: data.priority,
      claim_limit: data.claimLimit ?? 1,
      credit_quantity: data.creditQuantity ?? 1,
      new_accounts_only: false,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      credit_expires_at: data.creditExpiresAt,
      audience_previewed_at: null,
      audience_preview_count: null,
      test_sent_at: null,
      test_sent_to: null,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const existing = data.promotionId
      ? await db.from("promotion_campaigns").select("id,status").eq("id", data.promotionId).single()
      : null;
    if (existing?.error) throw existing.error;
    if (existing?.data && !["draft", "paused"].includes(existing.data.status)) {
      throw new Error("Pause an active or scheduled promotion before editing it");
    }
    const result = data.promotionId
      ? await db
          .from("promotion_campaigns")
          .update(row)
          .eq("id", data.promotionId)
          .select("id")
          .single()
      : await db
          .from("promotion_campaigns")
          .insert({ ...row, created_by: context.userId })
          .select("id")
          .single();
    if (result.error) throw result.error;
    const promotionId = result.data.id as string;
    const deleted = await db
      .from("promotion_eligible_class_types")
      .delete()
      .eq("promotion_id", promotionId);
    if (deleted.error) throw deleted.error;
    if (data.eligibleProgramTypeIds.length) {
      const inserted = await db.from("promotion_eligible_class_types").insert(
        data.eligibleProgramTypeIds.map((programTypeId) => ({
          promotion_id: promotionId,
          program_type_id: programTypeId,
        })),
      );
      if (inserted.error) throw inserted.error;
    }
    const audit = await db.from("promotion_campaign_audit").insert({
      promotion_id: promotionId,
      actor_id: context.userId,
      action: data.promotionId ? "draft_updated" : "draft_created",
      next_status: "draft",
    });
    if (audit.error) throw audit.error;
    return { status: "ok" as const, promotionId };
  });

export const previewPromotionAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: result, error } = await (context.supabase as any).rpc(
      "admin_preview_promotion_audience",
      { p_actor_id: context.userId, p_promotion_id: data.promotionId },
    );
    if (error) throw error;
    if (result?.status !== "ok") throw new Error(result?.message ?? "audience_preview_failed");
    return result as { status: "ok"; eligibleCount: number };
  });

export const sendPromotionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.extend({ language: z.enum(PROMOTION_LANGUAGES) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.userId);
    const { data: campaign, error } = await db
      .from("promotion_campaigns")
      .select("id,localized_content,action_url")
      .eq("id", data.promotionId)
      .single();
    if (error) throw error;
    const copy = campaign.localized_content?.[data.language];
    if (!copy?.title || !copy?.body) throw new Error("Localized test copy is incomplete");
    const { data: tokens, error: tokenError } = await db
      .from("admin_push_tokens")
      .select("token")
      .eq("user_id", context.userId)
      .eq("active", true)
      .eq("platform", "ios");
    if (tokenError) throw tokenError;
    if (!tokens?.length)
      throw new Error("Register this iPhone for admin notifications before test-send");
    const { isApnsConfigured, sendApnsAlert } = await import("@/lib/apns.server");
    if (!isApnsConfigured()) throw new Error("APNs is not configured for test-send");
    const results = await Promise.all(
      tokens.map((token: any) =>
        sendApnsAlert(token.token, {
          title: `[TEST] ${copy.title}`,
          body: copy.body,
          url: campaign.action_url,
        }),
      ),
    );
    if (!results.some((result) => result.ok))
      throw new Error("The test notification was not accepted");
    const { data: marked, error: markedError } = await (context.supabase as any).rpc(
      "admin_mark_promotion_test_sent",
      { p_actor_id: context.userId, p_promotion_id: data.promotionId },
    );
    if (markedError) throw markedError;
    if (marked?.status !== "ok") throw new Error(marked?.message ?? "test_send_not_recorded");
    return { status: "ok" as const, sent: results.filter((result) => result.ok).length };
  });

export const transitionPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    idSchema
      .extend({ nextStatus: z.enum(["scheduled", "active", "paused", "archived"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.userId);
    if (["scheduled", "active"].includes(data.nextStatus)) {
      const { data: campaign, error } = await db
        .from("promotion_campaigns")
        .select("*,promotion_eligible_class_types(program_type_id)")
        .eq("id", data.promotionId)
        .single();
      if (error) throw error;
      const localValidation = validatePromotionForActivation({
        promotionType: campaign.promotion_type,
        localizedContent: campaign.localized_content,
        channels: campaign.channels,
        eligibleProgramTypeIds: (campaign.promotion_eligible_class_types ?? []).map(
          (row: any) => row.program_type_id,
        ),
        claimLimit: campaign.claim_limit,
        creditQuantity: campaign.credit_quantity,
        startsAt: campaign.starts_at,
        endsAt: campaign.ends_at,
        creditExpiresAt: campaign.credit_expires_at,
        whatsappTemplates: campaign.whatsapp_templates,
        audiencePreviewedAt: campaign.audience_previewed_at,
        testSentAt: campaign.test_sent_at,
      });
      if (!localValidation.ok) throw new Error(localValidation.errors.join(", "));
      const requirements = await (context.supabase as any).rpc(
        "promotion_activation_requirements",
        {
          p_promotion_id: data.promotionId,
        },
      );
      if (requirements.error) throw requirements.error;
      if (!requirements.data?.ok) throw new Error((requirements.data?.errors ?? []).join(", "));
    }
    const { data: result, error } = await (context.supabase as any).rpc(
      "admin_transition_promotion",
      {
        p_actor_id: context.userId,
        p_promotion_id: data.promotionId,
        p_next_status: data.nextStatus,
      },
    );
    if (error) throw error;
    if (result?.status !== "ok") throw new Error(result?.message ?? "promotion_transition_failed");
    if (result.nextStatus === "active") {
      const { dispatchPromotionCampaign } = await import("@/lib/promotionBroadcast.server");
      await dispatchPromotionCampaign(data.promotionId);
    }
    return result;
  });
