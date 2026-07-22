import { describe, expect, test } from "bun:test";
import {
  filterDeliveryRows,
  isDeliveryRetryCandidate,
  summarizeDeliveries,
} from "../../src/lib/deliveryMonitoring.ts";

function delivery(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    message_id: crypto.randomUUID(),
    channel: "push",
    provider: "apns",
    status: "sent",
    provider_status: null,
    attempt_count: 1,
    failure_class: null,
    error_code: null,
    error_message: null,
    scheduled_for: "2026-07-22T09:00:00.000Z",
    next_attempt_at: null,
    expires_at: null,
    accepted_at: null,
    sent_at: "2026-07-22T09:00:01.000Z",
    delivered_at: null,
    read_at: null,
    failed_at: null,
    created_at: "2026-07-22T09:00:00.000Z",
    updated_at: "2026-07-22T09:00:01.000Z",
    attempts: [],
    targets: [],
    message: {
      id: crypto.randomUUID(),
      event_type: "booking_confirmed",
      subject: "Booking confirmed",
      member_id: "member-1",
      language: "en",
      template_key: "booking_confirmed",
      template_version: "v2",
      created_at: "2026-07-22T09:00:00.000Z",
      member: {
        id: "member-1",
        name: "Noa Levy",
        phone: "+972500000001",
        email: "noa@example.com",
        preferred_language: "he",
        status: "active",
      },
    },
    ...overrides,
  };
}

describe("delivery monitoring", () => {
  test("separates provider handoff from provider-confirmed delivery", () => {
    const rows = [
      delivery({ status: "sent" }),
      delivery({ status: "delivered" }),
      delivery({ status: "read" }),
      delivery({ status: "suppressed" }),
      delivery({ status: "dead_letter" }),
    ];
    expect(summarizeDeliveries(rows)).toEqual({
      total: 5,
      successfulHandoffs: 3,
      providerConfirmed: 2,
      needsAttention: 1,
      inFlight: 0,
      policySkipped: 1,
      membersReached: 1,
    });
  });

  test("searches member identity, contact, subject and event", () => {
    const rows = [delivery(), delivery({ id: "other", message: null })];
    for (const query of ["noa", "0001", "example.com", "confirmed", "booking_"]) {
      expect(
        filterDeliveryRows(rows, { query, channel: "all", status: "all", memberId: null }),
      ).toHaveLength(1);
    }
  });

  test("combines member, channel and attention filters", () => {
    const rows = [
      delivery({ status: "failed", channel: "email" }),
      delivery({ status: "sent", channel: "push" }),
      delivery({
        status: "dead_letter",
        channel: "email",
        message: {
          ...delivery().message,
          member_id: "member-2",
          member: { ...delivery().message.member, id: "member-2" },
        },
      }),
    ];
    expect(
      filterDeliveryRows(rows, {
        query: "",
        channel: "email",
        status: "attention",
        memberId: "member-1",
      }),
    ).toHaveLength(1);
  });

  test("never presents ambiguous, suppressed, permanent or expired deliveries as retryable", () => {
    const now = new Date("2026-07-22T10:00:00.000Z");
    expect(
      isDeliveryRetryCandidate(delivery({ status: "failed", failure_class: "transient" }), now),
    ).toBe(true);
    expect(
      isDeliveryRetryCandidate(
        delivery({ status: "delivery_unknown", failure_class: "ambiguous" }),
        now,
      ),
    ).toBe(false);
    expect(isDeliveryRetryCandidate(delivery({ status: "suppressed" }), now)).toBe(false);
    expect(
      isDeliveryRetryCandidate(
        delivery({ status: "dead_letter", failure_class: "permanent" }),
        now,
      ),
    ).toBe(false);
    expect(
      isDeliveryRetryCandidate(
        delivery({ status: "failed", expires_at: "2026-07-22T09:59:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });
});
