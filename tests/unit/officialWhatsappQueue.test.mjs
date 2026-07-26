import { describe, expect, test } from "bun:test";
import { runOfficialWhatsappQueue } from "../../src/lib/officialWhatsappQueue.server.ts";

describe("legacy official WhatsApp reconciliation", () => {
  test("parks a recovered stale sending row as delivery unknown without another send", async () => {
    const calls = [];
    const now = new Date("2026-07-26T10:00:00Z");
    const row = {
      id: "stale-delivery",
      attempt_count: 1,
      created_at: "2026-07-26T09:00:00Z",
      language: "he",
      last_attempt_at: "2026-07-26T09:40:00Z",
      next_attempt_at: null,
      payload: {},
      provider: "official_whatsapp",
      scheduled_for: "2026-07-26T09:00:00Z",
      status: "sending",
      trigger_type: "payment_failed",
      member: { phone: "0523318478" },
    };

    const result = await runOfficialWhatsappQueue(
      { now },
      {
        listRows: async () => [row],
        claimRow: async () => ({ id: row.id, attemptCount: 2 }),
        markSent: async () => calls.push("sent"),
        requeue: async () => calls.push("requeued"),
        markFailed: async () => calls.push("failed"),
        markAmbiguous: async (input) => calls.push(`ambiguous:${input.error}`),
        computeRetryAt: () => {
          calls.push("computed-retry");
          return new Date("2026-07-26T10:05:00Z");
        },
        send: async () => {
          calls.push("sent-to-provider");
          return { ok: true, providerMessageId: "wamid.duplicate-risk" };
        },
      },
    );

    expect(result).toMatchObject({ processed: 1, ambiguous: 1, requeued: 0, failed: 0 });
    expect(calls).toEqual(["ambiguous:official_whatsapp_stale_sending_recovery"]);
  });

  test("parks an ambiguous transmission for reconciliation without retrying it", async () => {
    const calls = [];
    const now = new Date("2026-07-26T10:00:00Z");
    const row = {
      id: "delivery-1",
      attempt_count: 0,
      created_at: "2026-07-26T09:00:00Z",
      language: "he",
      last_attempt_at: null,
      next_attempt_at: null,
      payload: {},
      provider: "official_whatsapp",
      scheduled_for: "2026-07-26T09:00:00Z",
      status: "queued",
      trigger_type: "payment_failed",
      member: { phone: "0523318478" },
    };
    const result = await runOfficialWhatsappQueue(
      { now },
      {
        listRows: async () => [row],
        claimRow: async () => ({ id: row.id, attemptCount: 1 }),
        markSent: async () => calls.push("sent"),
        requeue: async () => calls.push("requeued"),
        markFailed: async () => calls.push("failed"),
        markAmbiguous: async (input) => calls.push(`ambiguous:${input.error}`),
        computeRetryAt: () => {
          calls.push("computed-retry");
          return new Date("2026-07-26T10:05:00Z");
        },
        send: async () => ({
          ok: false,
          retryable: false,
          ambiguous: true,
          error: "official_whatsapp_network_ambiguous",
        }),
      },
    );

    expect(result).toMatchObject({ processed: 1, ambiguous: 1, requeued: 0, failed: 0 });
    expect(calls).toEqual(["ambiguous:official_whatsapp_network_ambiguous"]);
  });
});
