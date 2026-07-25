import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateRecipientShadowDispatch } from "@/lib/conciergeEngagement.server";
import { CONCIERGE_POLICY_VERSION } from "@/lib/conciergePolicy";
import { logMessagingEvent } from "@/lib/messagingLogging.server";

function evaluationKey(input: { intentId: string; policyVersion: string; evaluation: unknown }) {
  const hash = createHash("sha256")
    .update(JSON.stringify(input.evaluation))
    .digest("hex")
    .slice(0, 24);
  return `shadow_dispatch:${input.intentId}:${input.policyVersion}:${hash}`;
}

export function normalizeConciergeDispatchLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.trunc(parsed))) : 25;
}

export async function runConciergeShadowDispatch(input?: {
  limit?: number;
  now?: Date;
  workerId?: string;
}) {
  const db = supabaseAdmin as any;
  const now = input?.now ?? new Date();
  const workerId = input?.workerId ?? `concierge-dispatch:${randomUUID()}`;
  const startedAt = Date.now();
  const configurations = await db
    .from("automation_config_versions")
    .select("studio_id,journey_type,version")
    .eq("mode", "shadow")
    .is("retired_at", null)
    .order("version", { ascending: false });
  if (configurations.error) throw configurations.error;
  const configRows = (configurations.data ?? []) as Array<{
    studio_id: string;
    journey_type: string;
    version: number;
  }>;
  const currentConfigs = new Map<string, (typeof configRows)[number]>();
  for (const configuration of configRows) {
    const key = `${configuration.studio_id}:${configuration.journey_type}`;
    if (!currentConfigs.has(key)) currentConfigs.set(key, configuration);
  }
  const configsByStudio = new Map<string, Array<(typeof configRows)[number]>>();
  for (const configuration of currentConfigs.values()) {
    const studioConfigs = configsByStudio.get(configuration.studio_id) ?? [];
    studioConfigs.push(configuration);
    configsByStudio.set(configuration.studio_id, studioConfigs);
  }
  const evaluations: Array<{
    recipientId: string;
    selectedActionId: string | null;
    suppressionReason: string | null;
    channels: string[];
  }> = [];
  let failed = 0;

  for (const [studioId, studioConfigs] of configsByStudio) {
    if (evaluations.length >= normalizeConciergeDispatchLimit(input?.limit)) break;
    const intents = await db
      .from("journey_intents")
      .select("id,communication_recipient_id,journey_type")
      .eq("studio_id", studioId)
      .in(
        "journey_type",
        studioConfigs.map((configuration) => configuration.journey_type),
      )
      .in("status", ["pending", "postponed", "suppressed"])
      .lte("eligible_at", now.toISOString())
      .order("priority", { ascending: true })
      .limit(normalizeConciergeDispatchLimit(input?.limit));
    if (intents.error) throw intents.error;
    const recipientIds = [
      ...new Set(
        (intents.data ?? []).map(
          (row: { communication_recipient_id: string }) => row.communication_recipient_id,
        ),
      ),
    ];
    for (const recipientId of recipientIds) {
      if (evaluations.length >= normalizeConciergeDispatchLimit(input?.limit)) break;
      try {
        const evaluation = await evaluateRecipientShadowDispatch({
          studioId,
          communicationRecipientId: recipientId,
          now,
          journeyTypes: studioConfigs.map((configuration) => configuration.journey_type),
        });
        const evidenceIntentId =
          evaluation.selectedActionId ?? evaluation.evaluatedActionIds[0] ?? null;
        if (evidenceIntentId) {
          const selectedIntent = await db
            .from("journey_intents")
            .select("journey_type")
            .eq("studio_id", studioId)
            .eq("id", evidenceIntentId)
            .single();
          if (selectedIntent.error) throw selectedIntent.error;
          const selectedConfiguration = currentConfigs.get(
            `${studioId}:${selectedIntent.data.journey_type}`,
          );
          if (!selectedConfiguration) throw new Error("shadow_config_not_found");
          const selectedRender = evaluation.rendered[0] ?? null;
          const recipientLocale = await db
            .from("communication_recipients")
            .select("preferred_locale")
            .eq("studio_id", studioId)
            .eq("id", recipientId)
            .single();
          if (recipientLocale.error) throw recipientLocale.error;
          const recorded = await db.rpc("record_concierge_shadow_evaluation", {
            p_studio_id: studioId,
            p_recipient_id: recipientId,
            p_selected_intent_id: evidenceIntentId,
            p_evaluation_key: evaluationKey({
              intentId: evidenceIntentId,
              policyVersion: CONCIERGE_POLICY_VERSION,
              evaluation,
            }),
            p_policy_version: CONCIERGE_POLICY_VERSION,
            p_automation_config_version: selectedConfiguration.version,
            p_template_id: selectedRender?.templateId ?? null,
            p_template_version: selectedRender?.templateVersion ?? null,
            p_locale: recipientLocale.data.preferred_locale,
            p_reason_codes: [
              ...evaluation.reasonCodes,
              ...evaluation.channels.map((channel) => `would_send:${channel}`),
            ],
            p_suppression_reason: evaluation.suppressionReason,
            p_competing_action_ids: evaluation.evaluatedActionIds.filter(
              (id) => id !== evidenceIntentId,
            ),
            p_attention_reasons: evaluation.attentionReasons,
          });
          if (recorded.error) throw recorded.error;
        }
        evaluations.push({
          recipientId,
          selectedActionId: evaluation.selectedActionId,
          suppressionReason: evaluation.suppressionReason,
          channels: evaluation.channels,
        });
      } catch {
        failed += 1;
      }
    }
  }

  logMessagingEvent("concierge_shadow_dispatch_completed", {
    workerId,
    outcome: failed > 0 ? "partial_failure" : "completed",
    durationMs: Date.now() - startedAt,
    status: `evaluated:${evaluations.length}`,
  });
  return { workerId, evaluated: evaluations.length, failed, evaluations };
}
