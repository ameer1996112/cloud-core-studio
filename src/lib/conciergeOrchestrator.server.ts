import { randomUUID } from "node:crypto";
import { notificationDatabase } from "@/server/notifications/database-scope.server";
import {
  runConciergeBatchWithRepository,
  type ConciergeAutomationConfig,
  type ConciergeBatchRepository,
  type ConciergeDomainEvent,
} from "@/lib/conciergeOrchestration";
import { CONCIERGE_POLICY_VERSION } from "@/lib/conciergePolicy";
import { logMessagingEvent } from "@/lib/messagingLogging.server";

type DomainOutboxRow = {
  id: string;
  studio_id: string;
  event_type: string;
  schema_version: number;
  aggregate_type: string;
  aggregate_id: string;
  participant_id: string | null;
  communication_recipient_id: string | null;
  occurred_at: string;
  correlation_id: string;
  causation_id: string | null;
  deduplication_key: string;
  payload: Record<string, unknown>;
};

function mapDomainEvent(row: DomainOutboxRow): ConciergeDomainEvent {
  return {
    id: row.id,
    studioId: row.studio_id,
    type: row.event_type,
    schemaVersion: row.schema_version,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    participantId: row.participant_id,
    communicationRecipientId: row.communication_recipient_id,
    occurredAt: row.occurred_at,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    deduplicationKey: row.deduplication_key,
    payload: row.payload ?? {},
  };
}

function allowlistedRecipientIds(env: NodeJS.ProcessEnv) {
  return (env.CONCIERGE_TEST_RECIPIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function createSupabaseConciergeRepository(signal?: AbortSignal): ConciergeBatchRepository {
  const db = notificationDatabase as any;
  const active = () => signal?.throwIfAborted();
  return {
    async claim(input) {
      active();
      const result = await db.rpc("claim_domain_outbox", {
        p_worker_identifier: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: 120,
      });
      active();
      if (result.error) throw result.error;
      return ((result.data ?? []) as DomainOutboxRow[]).map(mapDomainEvent);
    },

    async getAutomation(studioId, journeyType): Promise<ConciergeAutomationConfig> {
      active();
      const result = await db
        .from("automation_config_versions")
        .select("mode,version")
        .eq("studio_id", studioId)
        .eq("journey_type", journeyType)
        .is("retired_at", null)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      active();
      if (!result.data) return { mode: "paused", version: 0 };
      return result.data as ConciergeAutomationConfig;
    },

    async materialize(input) {
      active();
      const result = await db.rpc("materialize_concierge_claim", {
        p_outbox_id: input.outboxId,
        p_worker_identifier: input.workerId,
        p_journey_type: input.normalized.journeyType,
        p_purpose: input.normalized.purpose,
        p_priority: input.normalized.priority,
        p_journey_key: input.normalized.journeyKey,
        p_intent_key: input.normalized.intentKey,
        p_eligible_at: input.normalized.eligibleAt,
        p_expires_at: input.normalized.expiresAt,
        p_cancellation_conditions: input.normalized.cancellationConditions,
        p_policy_version: CONCIERGE_POLICY_VERSION,
        p_automation_config_version: input.automationConfigVersion,
        p_create_customer_intent: input.createCustomerIntent,
        p_execution_action: input.executionAction,
        p_execution_reason: input.executionReason,
      });
      active();
      if (result.error) throw result.error;
    },

    async defer(input) {
      active();
      const result = await db.rpc("defer_domain_outbox_claim", {
        p_outbox_id: input.outboxId,
        p_worker_identifier: input.workerId,
        p_reason: input.reason,
        p_next_attempt_at: input.nextAttemptAt,
      });
      active();
      if (result.error) throw result.error;
      if (result.data !== true) throw new Error("outbox_defer_claim_not_owned");
    },

    async fail(input) {
      active();
      const result = await db.rpc("fail_domain_outbox_claim", {
        p_outbox_id: input.outboxId,
        p_worker_identifier: input.workerId,
        p_error: input.error,
        p_retryable: input.retryable,
        p_max_attempts: 8,
      });
      active();
      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      return { deadLettered: row?.dead_lettered === true };
    },
  };
}

export function normalizeConciergeRunLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.trunc(parsed))) : 25;
}

export async function runConciergeOrchestrator(input?: {
  limit?: number;
  workerId?: string;
  now?: Date;
  signal?: AbortSignal;
}) {
  input?.signal?.throwIfAborted();
  const startedAt = Date.now();
  const workerId = input?.workerId ?? `concierge:${randomUUID()}`;
  const result = await runConciergeBatchWithRepository({
    repository: createSupabaseConciergeRepository(input?.signal),
    workerId,
    limit: normalizeConciergeRunLimit(input?.limit),
    allowlistedRecipientIds: allowlistedRecipientIds(process.env),
    now: input?.now ?? new Date(),
  });
  input?.signal?.throwIfAborted();
  logMessagingEvent("concierge_batch_completed", {
    workerId,
    outcome: result.failed > 0 ? "partial_failure" : "completed",
    durationMs: Date.now() - startedAt,
    status: `claimed:${result.claimed}`,
  });
  return { workerId, ...result };
}
