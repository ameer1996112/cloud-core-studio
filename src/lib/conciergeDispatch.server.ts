import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evaluateConciergeDispatch } from "@/lib/conciergeDispatch";
import { loadMemberEngagementState } from "@/lib/conciergeEngagement.server";
import { buildConciergeMaterializationPlan } from "@/lib/conciergeMaterialization";
import { CONCIERGE_POLICY_VERSION, nextConciergeEligibility } from "@/lib/conciergePolicy";
import { logMessagingEvent } from "@/lib/messagingLogging.server";

export function conciergeEvaluationKey(input: {
  mode: "shadow" | "test_only" | "live";
  intentId: string;
  policyVersion: string;
  eligibleAt: string;
  evaluation: unknown;
}) {
  const hash = createHash("sha256")
    .update(JSON.stringify(input.evaluation))
    .digest("hex")
    .slice(0, 24);
  return `${input.mode}_dispatch:${input.intentId}:${input.policyVersion}:${input.eligibleAt}:${hash}`;
}

export function conciergeTestRecipientAllowed(recipientId: string, env: NodeJS.ProcessEnv) {
  return (env.CONCIERGE_TEST_RECIPIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(recipientId);
}

export function normalizeConciergeDispatchLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.trunc(parsed))) : 25;
}

export async function runConciergeDispatch(input?: {
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
    .select("studio_id,journey_type,version,mode")
    .in("mode", ["shadow", "test_only", "live"])
    .is("retired_at", null)
    .order("version", { ascending: false });
  if (configurations.error) throw configurations.error;
  const configRows = (configurations.data ?? []) as Array<{
    studio_id: string;
    journey_type: string;
    version: number;
    mode: "shadow" | "test_only" | "live";
  }>;
  const currentConfigs = new Map<string, (typeof configRows)[number]>();
  for (const configuration of configRows) {
    const key = `${configuration.studio_id}:${configuration.journey_type}`;
    if (!currentConfigs.has(key)) currentConfigs.set(key, configuration);
  }
  const configsByStudioMode = new Map<string, Array<(typeof configRows)[number]>>();
  for (const configuration of currentConfigs.values()) {
    const groupKey = `${configuration.studio_id}:${configuration.mode}`;
    const studioConfigs = configsByStudioMode.get(groupKey) ?? [];
    studioConfigs.push(configuration);
    configsByStudioMode.set(groupKey, studioConfigs);
  }
  const evaluations: Array<{
    recipientId: string;
    selectedActionId: string | null;
    suppressionReason: string | null;
    channels: string[];
    mode: "shadow" | "test_only" | "live";
  }> = [];
  let failed = 0;

  for (const [groupKey, studioConfigs] of configsByStudioMode) {
    if (evaluations.length >= normalizeConciergeDispatchLimit(input?.limit)) break;
    const studioId = groupKey.slice(0, groupKey.lastIndexOf(":"));
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
        const state = await loadMemberEngagementState({
          studioId,
          communicationRecipientId: recipientId,
          now,
          journeyTypes: studioConfigs.map((configuration) => configuration.journey_type),
        });
        const evaluation = evaluateConciergeDispatch({
          ...state,
          pendingActions: state.actions,
          now,
        });
        const evidenceIntentId =
          evaluation.selectedActionId ?? evaluation.evaluatedActionIds[0] ?? null;
        let evaluationMode: "shadow" | "test_only" | "live" = "shadow";
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
          if (!selectedConfiguration) throw new Error("dispatch_config_not_found");
          evaluationMode = selectedConfiguration.mode;
          const selectedRender = evaluation.rendered[0] ?? null;
          const evaluatedAction = state.actions.find((action) => action.id === evidenceIntentId);
          if (!evaluatedAction) throw new Error("dispatch_action_not_found");
          const key = conciergeEvaluationKey({
            mode: selectedConfiguration.mode,
            intentId: evidenceIntentId,
            policyVersion: CONCIERGE_POLICY_VERSION,
            eligibleAt: evaluatedAction.eligibleAt.toISOString(),
            evaluation,
          });
          const competingActionIds = evaluation.evaluatedActionIds.filter(
            (id) => id !== evidenceIntentId,
          );
          const reasonCodes = [
            ...evaluation.reasonCodes,
            ...evaluation.channels.map((channel) => `would_send:${channel}`),
          ];
          const shouldMaterialize =
            evaluation.selectedActionId !== null &&
            evaluation.suppressionReason === null &&
            evaluation.rendered.length > 0 &&
            (selectedConfiguration.mode !== "test_only" ||
              conciergeTestRecipientAllowed(recipientId, process.env)) &&
            (selectedConfiguration.mode !== "live" ||
              process.env.CONCIERGE_LIVE_DELIVERY_ENABLED === "true");

          if (evaluation.postponed && evaluation.suppressionReason) {
            const postponed = await db.rpc("postpone_concierge_intent", {
              p_studio_id: studioId,
              p_recipient_id: recipientId,
              p_intent_id: evidenceIntentId,
              p_reason: evaluation.suppressionReason,
              p_eligible_at: nextConciergeEligibility(
                evaluation.suppressionReason,
                now,
              ).toISOString(),
              p_now: now.toISOString(),
            });
            if (postponed.error) throw postponed.error;
          }

          if (selectedConfiguration.mode === "shadow" || !shouldMaterialize) {
            const recorded = await db.rpc("record_concierge_shadow_evaluation", {
              p_studio_id: studioId,
              p_recipient_id: recipientId,
              p_selected_intent_id: evidenceIntentId,
              p_evaluation_key: key,
              p_policy_version: CONCIERGE_POLICY_VERSION,
              p_automation_config_version: selectedConfiguration.version,
              p_template_id: selectedRender?.templateId ?? null,
              p_template_version: selectedRender?.templateVersion ?? null,
              p_locale: state.recipient.locale,
              p_reason_codes: reasonCodes,
              p_suppression_reason:
                evaluation.suppressionReason ??
                (selectedConfiguration.mode === "test_only"
                  ? "recipient_not_allowlisted"
                  : selectedConfiguration.mode === "live"
                    ? "live_runtime_disabled"
                    : null),
              p_competing_action_ids: competingActionIds,
              p_attention_reasons: evaluation.attentionReasons,
            });
            if (recorded.error) throw recorded.error;
          } else {
            const selectedAction = state.actions.find((action) => action.id === evidenceIntentId);
            const correlationId = state.correlationByActionId[evidenceIntentId];
            if (!selectedAction || !correlationId || !evaluation.selectedTemplateKey) {
              throw new Error("dispatch_evidence_incomplete");
            }
            const materializations = buildConciergeMaterializationPlan({
              decisionKey: key,
              templateKey: evaluation.selectedTemplateKey,
              locale: state.recipient.locale,
              rendered: evaluation.rendered,
              variables: state.variables,
              recipient: state.deliveryTarget,
              scheduledFor: now.toISOString(),
              expiresAt: selectedAction.expiresAt?.toISOString() ?? null,
            });
            const materialized = await db.rpc("materialize_concierge_delivery", {
              p_studio_id: studioId,
              p_recipient_id: recipientId,
              p_intent_id: evidenceIntentId,
              p_decision_key: key,
              p_policy_version: CONCIERGE_POLICY_VERSION,
              p_automation_config_version: selectedConfiguration.version,
              p_mode: selectedConfiguration.mode,
              p_template_key: evaluation.selectedTemplateKey,
              p_correlation_id: correlationId,
              p_reason_codes: reasonCodes,
              p_competing_action_ids: competingActionIds,
              p_rendered_variables: state.variables,
              p_materializations: materializations,
              p_now: now.toISOString(),
            });
            if (materialized.error) throw materialized.error;
          }
        }
        evaluations.push({
          recipientId,
          selectedActionId: evaluation.selectedActionId,
          suppressionReason: evaluation.suppressionReason,
          channels: evaluation.channels,
          mode: evaluationMode,
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

export const runConciergeShadowDispatch = runConciergeDispatch;
