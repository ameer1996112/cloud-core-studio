import { describe, expect, test } from "bun:test";
import {
  normalizeDomainEvent,
  runConciergeBatchWithRepository,
  resolveAutomationExecution,
} from "../../src/lib/conciergeOrchestration.ts";

const baseEvent = {
  id: "event-1",
  studioId: "studio-1",
  schemaVersion: 1,
  aggregateType: "bookings",
  aggregateId: "booking-1",
  participantId: "member-1",
  communicationRecipientId: "recipient-1",
  occurredAt: "2026-07-26T10:00:00.000Z",
  correlationId: "correlation-1",
  deduplicationKey: "booking.confirmed:booking-1:booked",
  payload: { booking_id: "booking-1", status: "booked" },
};

describe("concierge domain-event normalization", () => {
  test("maps booking and urgent class events into prioritized journey intents", () => {
    expect(normalizeDomainEvent({ ...baseEvent, type: "booking.confirmed" })).toMatchObject({
      journeyType: "booking",
      purpose: "transactional",
      priority: 3,
      intentKey: "intent:booking.confirmed:booking-1:booked",
    });
    expect(
      normalizeDomainEvent({
        ...baseEvent,
        type: "class.cancelled",
        aggregateType: "classes",
        aggregateId: "class-1",
      }),
    ).toMatchObject({
      journeyType: "class_change",
      purpose: "operational",
      priority: 1,
      urgent: true,
    });
  });

  test("consolidates payment and renewal inputs into one outcome identity", () => {
    expect(
      normalizeDomainEvent({
        ...baseEvent,
        type: "payment.succeeded",
        aggregateType: "payments",
        aggregateId: "payment-1",
        deduplicationKey: "payment:business-charge-1",
        payload: {
          payment_id: "payment-1",
          business_payment_id: "business-charge-1",
          subscription_id: "subscription-1",
          status: "paid",
        },
      }),
    ).toMatchObject({
      journeyType: "payment_outcome",
      paymentOutcome: "subscription_renewal_succeeded",
      journeyKey: "payment_outcome:studio-1:business-charge-1",
    });
  });

  test("does not convert an automatic retry into a customer interruption", () => {
    expect(
      normalizeDomainEvent({
        ...baseEvent,
        type: "payment.retry_scheduled",
        aggregateType: "payments",
        aggregateId: "payment-1",
      }),
    ).toMatchObject({
      paymentOutcome: "payment_retry_scheduled",
      createCustomerIntent: false,
      priority: 2,
    });
    expect(
      normalizeDomainEvent({
        ...baseEvent,
        type: "payment.failed",
        aggregateType: "payments",
        aggregateId: "payment-1",
        payload: { retryable: true, retry_scheduled_at: "2026-07-27T10:00:00.000Z" },
      }),
    ).toMatchObject({
      paymentOutcome: "payment_retry_scheduled",
      createCustomerIntent: false,
    });
  });

  test("rejects unknown or future-schema events without guessing", () => {
    expect(() => normalizeDomainEvent({ ...baseEvent, type: "unknown.event" })).toThrow(
      "unsupported_domain_event",
    );
    expect(() =>
      normalizeDomainEvent({ ...baseEvent, type: "booking.confirmed", schemaVersion: 2 }),
    ).toThrow("unsupported_schema_version");
  });
});

describe("automation execution safety", () => {
  test("postpones paused and live configuration without consuming its event", () => {
    expect(
      resolveAutomationExecution({
        mode: "paused",
        recipientId: "recipient-1",
        allowlistedRecipientIds: [],
      }),
    ).toEqual({ action: "postpone", reason: "journey_paused" });
    expect(
      resolveAutomationExecution({
        mode: "live",
        recipientId: "recipient-1",
        allowlistedRecipientIds: ["recipient-1"],
      }),
    ).toEqual({ action: "postpone", reason: "live_delivery_runtime_not_ready" });
  });

  test("records shadow decisions without deliveries", () => {
    expect(
      resolveAutomationExecution({
        mode: "shadow",
        recipientId: "recipient-1",
        allowlistedRecipientIds: [],
      }),
    ).toEqual({ action: "shadow", reason: "shadow_evaluation" });
  });

  test("test-only suppresses non-allowlisted recipients and preserves allowlisted work", () => {
    expect(
      resolveAutomationExecution({
        mode: "test_only",
        recipientId: "recipient-1",
        allowlistedRecipientIds: [],
      }),
    ).toEqual({ action: "suppress", reason: "recipient_not_allowlisted" });
    expect(
      resolveAutomationExecution({
        mode: "test_only",
        recipientId: "recipient-1",
        allowlistedRecipientIds: ["recipient-1"],
      }),
    ).toEqual({ action: "postpone", reason: "test_delivery_runtime_not_ready" });
  });
});

describe("concierge batch processing", () => {
  test("materializes shadow events and postpones paused journeys", async () => {
    const materialized = [];
    const deferred = [];
    const repository = {
      claim: async () => [
        { ...baseEvent, id: "event-shadow", type: "booking.confirmed" },
        {
          ...baseEvent,
          id: "event-paused",
          type: "schedule.published",
          aggregateType: "schedule",
          aggregateId: "week-1",
        },
      ],
      getAutomation: async (_studioId, journeyType) =>
        journeyType === "booking" ? { mode: "shadow", version: 2 } : { mode: "paused", version: 1 },
      materialize: async (input) => {
        materialized.push(input);
      },
      defer: async (input) => {
        deferred.push(input);
      },
      fail: async () => {
        throw new Error("unexpected failure");
      },
    };

    const result = await runConciergeBatchWithRepository({
      repository,
      workerId: "worker-1",
      limit: 10,
      allowlistedRecipientIds: [],
      now: new Date("2026-07-26T10:00:00Z"),
    });

    expect(result).toEqual({
      claimed: 2,
      materialized: 1,
      shadowed: 1,
      testOnly: 0,
      suppressed: 0,
      postponed: 1,
      failed: 0,
      deadLettered: 0,
    });
    expect(materialized[0]).toMatchObject({
      outboxId: "event-shadow",
      executionAction: "shadow",
      automationConfigVersion: 2,
      createCustomerIntent: true,
    });
    expect(deferred[0]).toMatchObject({
      outboxId: "event-paused",
      reason: "journey_paused",
    });
  });

  test("dead-letters unsupported events through the repository", async () => {
    const failures = [];
    const repository = {
      claim: async () => [{ ...baseEvent, type: "unsupported.event" }],
      getAutomation: async () => ({ mode: "shadow", version: 1 }),
      materialize: async () => {},
      defer: async () => {},
      fail: async (input) => {
        failures.push(input);
        return { deadLettered: true };
      },
    };
    const result = await runConciergeBatchWithRepository({
      repository,
      workerId: "worker-1",
      limit: 10,
      allowlistedRecipientIds: [],
      now: new Date("2026-07-26T10:00:00Z"),
    });
    expect(result.failed).toBe(1);
    expect(result.deadLettered).toBe(1);
    expect(failures[0]).toMatchObject({ retryable: false });
  });

  test("keeps processing when failure recording temporarily fails", async () => {
    const materialized = [];
    const repository = {
      claim: async () => [
        { ...baseEvent, id: "bad", type: "unsupported.event" },
        { ...baseEvent, id: "good", type: "booking.confirmed" },
      ],
      getAutomation: async () => ({ mode: "shadow", version: 1 }),
      materialize: async (input) => materialized.push(input),
      defer: async () => {},
      fail: async () => {
        throw new Error("database unavailable");
      },
    };
    const result = await runConciergeBatchWithRepository({
      repository,
      workerId: "worker-1",
      limit: 10,
      allowlistedRecipientIds: [],
      now: new Date("2026-07-26T10:00:00Z"),
    });
    expect(result.failed).toBe(1);
    expect(materialized).toHaveLength(1);
  });
});
