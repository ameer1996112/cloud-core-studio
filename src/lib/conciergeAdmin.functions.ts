import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  chooseNextRecipientAction,
  type PendingRecipientAction,
  type RecipientPolicyState,
} from "@/lib/conciergePolicy";
import {
  CONCIERGE_META_TEMPLATE_CATALOG,
  CONCIERGE_PREMIUM_META_TEMPLATE_CATALOG,
} from "@/lib/conciergeTemplateCatalog";
import {
  deriveProductionChannelStatus,
  deriveProductionJourneyStatus,
  type NotificationRolloutRow,
} from "@/lib/productionJourneyStatus";
import { templateContentHash } from "@/lib/whatsappTemplateProvisioning";

async function adminDb(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const profile = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile.error) throw profile.error;
  if (profile.data?.role !== "admin") throw new Error("Admin access required");
  return db;
}

export const getConciergeCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.userId);
    const studio = await db
      .from("studios")
      .select("id,name,timezone")
      .eq("slug", "cloud-core")
      .single();
    if (studio.error) throw studio.error;
    const trustedProvider = await db
      .from("concierge_trusted_provider_settings")
      .select("whatsapp_waba_id")
      .eq("studio_id", studio.data.id)
      .maybeSingle();
    if (trustedProvider.error) throw trustedProvider.error;
    const trustedWhatsappWabaId = trustedProvider.data?.whatsapp_waba_id ?? "";
    const [
      automations,
      channels,
      attention,
      deliveries,
      decisions,
      pendingOutbox,
      deadOutbox,
      oldestPending,
      templates,
      whatsappDeployments,
      deliveryVersions,
      deliverySelections,
      promotionEvidence,
      notificationRollouts,
    ] = await Promise.all([
      db
        .from("automation_config_versions")
        .select("id,journey_type,version,mode,config,created_at")
        .eq("studio_id", studio.data.id)
        .is("retired_at", null)
        .order("journey_type"),
      db
        .from("concierge_channel_controls")
        .select("channel,enabled,maintenance_only,updated_at")
        .eq("studio_id", studio.data.id)
        .order("channel"),
      db
        .from("admin_attention_items")
        .select("id,item_type,severity,title,status,created_at")
        .eq("studio_id", studio.data.id)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(25),
      db.from("message_deliveries").select("status").eq("studio_id", studio.data.id).limit(5000),
      db
        .from("concierge_decisions")
        .select("simulated,suppression_reason,decided_at")
        .eq("studio_id", studio.data.id)
        .order("decided_at", { ascending: false })
        .limit(1000),
      db
        .from("domain_outbox")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio.data.id)
        .is("processed_at", null)
        .is("dead_lettered_at", null),
      db
        .from("domain_outbox")
        .select("id", { count: "exact", head: true })
        .eq("studio_id", studio.data.id)
        .not("dead_lettered_at", "is", null),
      db
        .from("domain_outbox")
        .select("occurred_at")
        .eq("studio_id", studio.data.id)
        .is("processed_at", null)
        .is("dead_lettered_at", null)
        .order("occurred_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from("concierge_template_versions")
        .select(
          "id,template_key,channel,locale,version,lifecycle_status,subject_template,body_template,required_variables,content_hash,approved_at,approved_by",
        )
        .eq("studio_id", studio.data.id)
        .is("retired_at", null)
        .order("template_key")
        .order("channel")
        .order("locale"),
      db
        .from("whatsapp_template_deployments")
        .select("template_name,language,approval_status,content_hash")
        .eq("waba_id", trustedWhatsappWabaId),
      db
        .from("concierge_delivery_versions")
        .select(
          "id,template_key,channel,locale,source_template_id,source_template_version,source_content_hash,source_approved_by,source_approved_at,presentation_version,presentation_key,presentation_hash,presentation_contract,email_shell_version,email_shell_hash,presentation_approved_by,presentation_approved_at,provider_template_name,provider_content_hash",
        )
        .eq("studio_id", studio.data.id)
        .order("template_key")
        .order("channel")
        .order("locale")
        .order("presentation_version"),
      db
        .from("concierge_delivery_selections")
        .select("id,delivery_mode,delivery_version_id")
        .eq("studio_id", studio.data.id)
        .is("retired_at", null),
      db
        .from("concierge_delivery_promotion_evidence")
        .select("delivery_version_id")
        .eq("studio_id", studio.data.id),
      db
        .from("notification_event_rollouts")
        .select("event_type,enabled,allowlist_only,copy_reviewed,enabled_channels")
        .order("event_type"),
    ]);
    for (const result of [
      automations,
      channels,
      attention,
      deliveries,
      decisions,
      pendingOutbox,
      deadOutbox,
      oldestPending,
      templates,
      whatsappDeployments,
      deliveryVersions,
      deliverySelections,
      promotionEvidence,
      notificationRollouts,
    ]) {
      if (result.error) throw result.error;
    }
    const deliveryHealth = (deliveries.data ?? []).reduce(
      (counts: Record<string, number>, row: { status: string }) => {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const decisionRows = (decisions.data ?? []) as Array<{
      simulated: boolean;
      suppression_reason: string | null;
    }>;
    const suppressionSummary = decisionRows.reduce((counts: Record<string, number>, row) => {
      if (row.suppression_reason) {
        counts[row.suppression_reason] = (counts[row.suppression_reason] ?? 0) + 1;
      }
      return counts;
    }, {});
    const rolloutRows = (notificationRollouts.data ?? []) as NotificationRolloutRow[];
    return {
      studio: studio.data,
      automations: automations.data ?? [],
      productionJourneys: deriveProductionJourneyStatus(rolloutRows),
      channels: deriveProductionChannelStatus(rolloutRows),
      attention: attention.data ?? [],
      deliveryHealth,
      shadowSummary: {
        evaluated: decisionRows.filter((row) => row.simulated).length,
        suppressions: suppressionSummary,
      },
      queueHealth: {
        pending: pendingOutbox.count ?? 0,
        deadLettered: deadOutbox.count ?? 0,
        oldestPendingAt: oldestPending.data?.occurred_at ?? null,
      },
      templateHealth: {
        total: templates.data?.length ?? 0,
        approved:
          templates.data?.filter(
            (template: {
              lifecycle_status: string;
              approved_by: string | null;
              approved_at: string | null;
            }) =>
              template.lifecycle_status === "approved" &&
              template.approved_by &&
              template.approved_at,
          ).length ?? 0,
        awaitingApproval:
          templates.data?.filter(
            (template: {
              lifecycle_status: string;
              approved_by: string | null;
              approved_at: string | null;
            }) =>
              template.lifecycle_status !== "approved" ||
              !template.approved_by ||
              !template.approved_at,
          ).length ?? 0,
      },
      templates: templates.data ?? [],
      whatsappDeployments: whatsappDeployments.data ?? [],
      trustedWhatsappWabaId,
      deliveryVersions: deliveryVersions.data ?? [],
      deliverySelections: deliverySelections.data ?? [],
      promotionEligibleVersionIds: [
        ...new Set(
          (promotionEvidence.data ?? []).map(
            (evidence: { delivery_version_id: string }) => evidence.delivery_version_id,
          ),
        ),
      ],
      whatsappExpectedContentHashes: Object.fromEntries(
        [...CONCIERGE_META_TEMPLATE_CATALOG, ...CONCIERGE_PREMIUM_META_TEMPLATE_CATALOG].map(
          (template) => [`${template.name}:${template.language}`, templateContentHash(template)],
        ),
      ),
    };
  });

export const approveConciergeTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        confirmation: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const expectedConfirmation = `APPROVE SOURCE ${data.templateId} ${data.contentHash}`;
    if (data.confirmation !== expectedConfirmation) {
      throw new Error(`Confirmation must exactly match "${expectedConfirmation}"`);
    }
    const db = await adminDb(context.userId);
    const studio = await db.from("studios").select("id").eq("slug", "cloud-core").single();
    if (studio.error) throw studio.error;
    const result = await db.rpc("approve_concierge_template_version", {
      p_studio_id: studio.data.id,
      p_template_id: data.templateId,
      p_expected_content_hash: data.contentHash,
      p_actor_id: context.userId,
      p_confirmation: data.confirmation,
    });
    if (result.error) throw result.error;
    return { approvedTemplateId: result.data };
  });

const previewApprovalSchema = z.object({
  deliveryVersionId: z.string().uuid(),
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  presentationHash: z.string().regex(/^[a-f0-9]{64}$/),
  confirmation: z.string().min(1),
});

export const approveConciergeDeliveryPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => previewApprovalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const expectedConfirmation = `APPROVE PREVIEW ${data.deliveryVersionId} ${data.presentationHash}`;
    if (data.confirmation !== expectedConfirmation) {
      throw new Error(`Confirmation must exactly match "${expectedConfirmation}"`);
    }
    const db = await adminDb(context.userId);
    const studio = await db.from("studios").select("id").eq("slug", "cloud-core").single();
    if (studio.error) throw studio.error;
    const result = await db.rpc("approve_concierge_delivery_preview", {
      p_studio_id: studio.data.id,
      p_delivery_version_id: data.deliveryVersionId,
      p_expected_source_hash: data.sourceContentHash,
      p_expected_presentation_hash: data.presentationHash,
      p_actor_id: context.userId,
      p_confirmation: data.confirmation,
    });
    if (result.error) throw result.error;
    return { previewApprovalId: result.data };
  });

const simulatorSchema = z.object({
  recipientId: z.string().min(1),
  locale: z.enum(["ar", "he", "en"]),
  hasPush: z.boolean(),
  event: z.string().min(1),
  purpose: z.enum(["transactional", "operational", "schedule", "promotional", "receipt"]),
  priority: z.number().int().min(1).max(7),
  simulatedAt: z.string().datetime(),
});

export const simulateConciergeDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => simulatorSchema.parse(input))
  .handler(async ({ data, context }) => {
    await adminDb(context.userId);
    const purposeSet = new Set([data.purpose]);
    const recipient: RecipientPolicyState = {
      id: data.recipientId,
      locale: data.locale,
      isAdult: true,
      hasPush: data.hasPush,
      consents: {
        in_app: purposeSet,
        push: purposeSet,
        email: purposeSet,
        whatsapp: purposeSet,
      },
    };
    const action: PendingRecipientAction = {
      id: `simulation:${data.event}`,
      kind: data.event,
      purpose: data.purpose,
      priority: data.priority,
      eligibleAt: new Date(data.simulatedAt),
      urgent: data.priority === 1,
    };
    const result = chooseNextRecipientAction({
      recipient,
      actions: [action],
      recentContacts: [],
      now: new Date(data.simulatedAt),
    });
    return {
      ...result,
      policyVersion: "concierge-2026-07-v1",
      simulated: true,
      deliveriesCreated: 0,
      reservationsCreated: 0,
    };
  });
