import type { ConciergePurpose, PaymentOutcome } from "@/lib/conciergePolicy";

export type ConciergeAutomationMode = "paused" | "shadow" | "test_only" | "live";

export type ConciergeDomainEvent = {
  id: string;
  studioId: string;
  type: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  participantId?: string | null;
  communicationRecipientId?: string | null;
  occurredAt: string;
  correlationId: string;
  causationId?: string | null;
  deduplicationKey: string;
  payload: Record<string, unknown>;
};

export type NormalizedJourneyIntent = {
  journeyType: string;
  purpose: ConciergePurpose;
  priority: number;
  urgent: boolean;
  journeyKey: string;
  intentKey: string;
  eligibleAt: string;
  expiresAt: string | null;
  cancellationConditions: string[];
  paymentOutcome?: PaymentOutcome;
  createCustomerIntent: boolean;
};

type EventRule = {
  journeyType: string;
  purpose: ConciergePurpose;
  priority: number;
  urgent?: boolean;
  cancellationConditions?: string[];
};

const EVENT_RULES: Record<string, EventRule> = {
  "booking.confirmed": {
    journeyType: "booking",
    purpose: "transactional",
    priority: 3,
    cancellationConditions: ["booking_not_active", "class_cancelled"],
  },
  "booking.cancelled": {
    journeyType: "booking_cancellation",
    purpose: "transactional",
    priority: 3,
    cancellationConditions: ["booking_reactivated"],
  },
  "class.cancelled": {
    journeyType: "class_change",
    purpose: "operational",
    priority: 1,
    urgent: true,
  },
  "class.time_changed": {
    journeyType: "class_change",
    purpose: "operational",
    priority: 1,
    urgent: true,
  },
  "receipt.issued": {
    journeyType: "payment_outcome",
    purpose: "receipt",
    priority: 3,
  },
  "payment.succeeded": {
    journeyType: "payment_outcome",
    purpose: "transactional",
    priority: 3,
  },
  "payment.failed": {
    journeyType: "payment_outcome",
    purpose: "transactional",
    priority: 2,
    cancellationConditions: ["payment_recovered"],
  },
  "payment.requires_action": {
    journeyType: "payment_outcome",
    purpose: "transactional",
    priority: 2,
    cancellationConditions: ["payment_recovered"],
  },
  "payment.retry_scheduled": {
    journeyType: "payment_outcome",
    purpose: "transactional",
    priority: 2,
    cancellationConditions: ["payment_recovered"],
  },
  "payment.recovered": {
    journeyType: "payment_outcome",
    purpose: "transactional",
    priority: 3,
  },
  "waitlist.offer_created": {
    journeyType: "waitlist",
    purpose: "transactional",
    priority: 2,
    cancellationConditions: ["offer_expired", "offer_claimed", "class_cancelled"],
  },
  "attendance.recorded": {
    journeyType: "retention",
    purpose: "promotional",
    priority: 6,
  },
  "lead.received": {
    journeyType: "lead_to_trial",
    purpose: "transactional",
    priority: 3,
  },
  "schedule.published": {
    journeyType: "weekly_schedule",
    purpose: "schedule",
    priority: 5,
  },
};

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function paymentOutcome(event: ConciergeDomainEvent): PaymentOutcome | undefined {
  switch (event.type) {
    case "payment.succeeded":
      return stringPayload(event.payload, "subscription_id")
        ? "subscription_renewal_succeeded"
        : "one_time_payment_succeeded";
    case "payment.requires_action":
      return "payment_requires_action";
    case "payment.retry_scheduled":
      return "payment_retry_scheduled";
    case "payment.failed":
      return event.payload.retryable === true || stringPayload(event.payload, "retry_scheduled_at")
        ? "payment_retry_scheduled"
        : "payment_terminally_failed";
    case "payment.recovered":
      return "payment_recovered";
    default:
      return undefined;
  }
}

function journeyBusinessIdentity(event: ConciergeDomainEvent, journeyType: string) {
  if (journeyType === "payment_outcome") {
    return (
      stringPayload(event.payload, "business_payment_id") ??
      stringPayload(event.payload, "provider_payment_id") ??
      stringPayload(event.payload, "payment_id") ??
      event.aggregateId
    );
  }
  return event.aggregateId;
}

export function normalizeDomainEvent(event: ConciergeDomainEvent): NormalizedJourneyIntent {
  if (event.schemaVersion !== 1) throw new Error("unsupported_schema_version");
  const rule = EVENT_RULES[event.type];
  if (!rule) throw new Error(`unsupported_domain_event:${event.type}`);
  const outcome = paymentOutcome(event);
  const businessIdentity = journeyBusinessIdentity(event, rule.journeyType);
  const expiresAt =
    stringPayload(event.payload, "expires_at") ?? stringPayload(event.payload, "offer_expires_at");

  return {
    journeyType: rule.journeyType,
    purpose: rule.purpose,
    priority: rule.priority,
    urgent: rule.urgent === true,
    journeyKey: `${rule.journeyType}:${event.studioId}:${businessIdentity}`,
    intentKey: `intent:${event.deduplicationKey}`,
    eligibleAt: event.occurredAt,
    expiresAt,
    cancellationConditions: rule.cancellationConditions ?? [],
    paymentOutcome: outcome,
    createCustomerIntent: outcome !== "payment_retry_scheduled",
  };
}

export function resolveAutomationExecution(input: {
  mode: ConciergeAutomationMode;
  recipientId: string | null | undefined;
  allowlistedRecipientIds: string[];
}) {
  if (input.mode === "paused") {
    return { action: "postpone" as const, reason: "journey_paused" as const };
  }
  if (input.mode === "live") {
    return { action: "postpone" as const, reason: "live_delivery_runtime_not_ready" as const };
  }
  if (input.mode === "shadow") {
    return { action: "shadow" as const, reason: "shadow_evaluation" as const };
  }
  if (!input.recipientId || !input.allowlistedRecipientIds.includes(input.recipientId)) {
    return { action: "suppress" as const, reason: "recipient_not_allowlisted" as const };
  }
  return { action: "postpone" as const, reason: "test_delivery_runtime_not_ready" as const };
}

export type ConciergeAutomationConfig = {
  mode: ConciergeAutomationMode;
  version: number;
};

type MaterializeInput = {
  outboxId: string;
  workerId: string;
  normalized: NormalizedJourneyIntent;
  automationConfigVersion: number;
  createCustomerIntent: boolean;
  executionAction: "shadow" | "suppress" | "test_only";
  executionReason: string;
};

export type ConciergeBatchRepository = {
  claim(input: { workerId: string; limit: number }): Promise<ConciergeDomainEvent[]>;
  getAutomation(studioId: string, journeyType: string): Promise<ConciergeAutomationConfig>;
  materialize(input: MaterializeInput): Promise<void>;
  defer(input: {
    outboxId: string;
    workerId: string;
    reason: string;
    nextAttemptAt: string;
  }): Promise<void>;
  fail(input: {
    outboxId: string;
    workerId: string;
    error: string;
    retryable: boolean;
  }): Promise<{ deadLettered: boolean }>;
};

export type ConciergeBatchResult = {
  claimed: number;
  materialized: number;
  shadowed: number;
  testOnly: number;
  suppressed: number;
  postponed: number;
  failed: number;
  deadLettered: number;
};

function isPermanentOrchestrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("unsupported_domain_event") || message === "unsupported_schema_version";
}

export async function runConciergeBatchWithRepository(input: {
  repository: ConciergeBatchRepository;
  workerId: string;
  limit: number;
  allowlistedRecipientIds: string[];
  now: Date;
}): Promise<ConciergeBatchResult> {
  const events = await input.repository.claim({
    workerId: input.workerId,
    limit: input.limit,
  });
  const result: ConciergeBatchResult = {
    claimed: events.length,
    materialized: 0,
    shadowed: 0,
    testOnly: 0,
    suppressed: 0,
    postponed: 0,
    failed: 0,
    deadLettered: 0,
  };

  for (const event of events) {
    try {
      const normalized = normalizeDomainEvent(event);
      const automation = await input.repository.getAutomation(
        event.studioId,
        normalized.journeyType,
      );
      const execution = resolveAutomationExecution({
        mode: automation.mode,
        recipientId: event.communicationRecipientId,
        allowlistedRecipientIds: input.allowlistedRecipientIds,
      });

      if (execution.action === "postpone") {
        await input.repository.defer({
          outboxId: event.id,
          workerId: input.workerId,
          reason: execution.reason,
          nextAttemptAt: new Date(input.now.getTime() + 15 * 60_000).toISOString(),
        });
        result.postponed += 1;
        continue;
      }
      if (execution.action === "block") throw new Error(execution.reason);

      await input.repository.materialize({
        outboxId: event.id,
        workerId: input.workerId,
        normalized,
        automationConfigVersion: automation.version,
        createCustomerIntent: normalized.createCustomerIntent,
        executionAction: execution.action,
        executionReason: execution.reason,
      });
      result.materialized += 1;
      if (execution.action === "shadow") result.shadowed += 1;
      if (execution.action === "test_only") result.testOnly += 1;
      if (execution.action === "suppress") result.suppressed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed += 1;
      try {
        const failure = await input.repository.fail({
          outboxId: event.id,
          workerId: input.workerId,
          error: message,
          retryable: !isPermanentOrchestrationError(error),
        });
        if (failure.deadLettered) result.deadLettered += 1;
      } catch {
        // A lost lease or temporary database failure must not strand later rows
        // from the same claimed batch. This row becomes eligible after lease expiry.
      }
    }
  }
  return result;
}
