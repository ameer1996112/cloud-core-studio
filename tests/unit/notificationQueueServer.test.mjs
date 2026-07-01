import { describe, expect, test } from "bun:test";
import {
  PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS,
  runPaymentConfirmedOpenwaPass,
} from "../../src/lib/notificationQueue.server.ts";

function makeRow(overrides = {}) {
  return {
    id: "row-1",
    attempt_count: 0,
    generated_text: "Payment approved",
    last_attempt_at: null,
    scheduled_for: null,
    next_attempt_at: null,
    status: "queued",
    trigger_type: "payment_confirmed",
    channel: "whatsapp",
    provider: "openwa",
    member: { phone: "+972501234567" },
    ...overrides,
  };
}

function createDeps(rows, options = {}) {
  const operations = [];
  const claims = options.claims ?? new Map();

  return {
    operations,
    deps: {
      async listRows({ limit }) {
        return rows.slice(0, limit);
      },
      async claimRow({ row }) {
        operations.push({ type: "claim", rowId: row.id });
        if (options.claimRow) return options.claimRow({ row });
        if (claims.has(row.id)) return claims.get(row.id);
        return { id: row.id, attemptCount: row.attempt_count + 1 };
      },
      async sendText({ to, text }) {
        operations.push({ type: "send", to, text });
        if (options.sendResult instanceof Error) throw options.sendResult;
        return options.sendResult ?? { ok: true, providerMessageId: "provider-msg-1" };
      },
      async markSent(payload) {
        operations.push({ type: "sent", ...payload });
        if (options.markSentError) throw options.markSentError;
      },
      async requeue(payload) {
        operations.push({ type: "requeue", ...payload });
      },
      async markFailed(payload) {
        operations.push({ type: "failed", ...payload });
      },
      computeRetryAt({ attemptCount, failedAt }) {
        if (options.computeRetryAt) return options.computeRetryAt({ attemptCount, failedAt });
        return new Date(failedAt.getTime() + 5 * 60_000);
      },
    },
  };
}

describe("runPaymentConfirmedOpenwaPass", () => {
  test("processes only queued payment_confirmed whatsapp openwa rows", async () => {
    const rows = [
      makeRow({ id: "process-me" }),
      makeRow({ id: "wrong-trigger", trigger_type: "receipt_issued" }),
      makeRow({ id: "wrong-provider", provider: "other" }),
      makeRow({ id: "wrong-channel", channel: "email" }),
      makeRow({ id: "already-sent", status: "sent" }),
      makeRow({ id: "already-sending", status: "sending" }),
    ];
    const { deps, operations } = createDeps(rows);

    const result = await runPaymentConfirmedOpenwaPass(
      { now: new Date("2026-07-01T10:00:00.000Z"), limit: 10 },
      deps,
    );

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(operations.map((entry) => entry.type)).toEqual(["claim", "send", "sent"]);
    expect(operations[0].rowId).toBe("process-me");
  });

  test("recovers stale sending rows after the explicit timeout", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const staleLastAttemptAt = new Date(
      now.getTime() - PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS,
    ).toISOString();
    const recentLastAttemptAt = new Date(
      now.getTime() - PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS + 60_000,
    ).toISOString();
    const rows = [
      makeRow({
        id: "stale-sending",
        status: "sending",
        last_attempt_at: staleLastAttemptAt,
      }),
      makeRow({
        id: "fresh-sending",
        status: "sending",
        last_attempt_at: recentLastAttemptAt,
      }),
    ];
    const { deps, operations } = createDeps(rows);

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 10 }, deps);

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(operations).toEqual([
      { type: "claim", rowId: "stale-sending" },
      {
        type: "failed",
        rowId: "stale-sending",
        error: "stale_sending_recovery_manual_review",
      },
    ]);
  });

  test("respects scheduled_for and next_attempt_at due filtering", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const rows = [
      makeRow({ id: "due", scheduled_for: "2026-07-01T09:59:00.000Z" }),
      makeRow({ id: "future-scheduled", scheduled_for: "2026-07-01T10:05:00.000Z" }),
      makeRow({ id: "future-retry", next_attempt_at: "2026-07-01T10:10:00.000Z" }),
      makeRow({ id: "due-retry", next_attempt_at: "2026-07-01T09:55:00.000Z" }),
    ];
    const { deps, operations } = createDeps(rows);

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 10 }, deps);

    expect(result).toEqual({ claimed: 2, sent: 2, failed: 0, skipped: 0 });
    expect(
      operations.filter((entry) => entry.type === "claim").map((entry) => entry.rowId),
    ).toEqual(["due", "due-retry"]);
  });

  test("marks successful send as sent", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { deps, operations } = createDeps([makeRow({ id: "success-row" })], {
      sendResult: { ok: true, providerMessageId: "provider-42" },
    });

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 1 }, deps);

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(operations[2]).toEqual({
      type: "sent",
      rowId: "success-row",
      now,
      providerMessageId: "provider-42",
    });
  });

  test("marks current-process finalize failures as terminal manual review without requeueing", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { deps, operations } = createDeps([makeRow({ id: "finalize-failure-row" })], {
      sendResult: { ok: true, providerMessageId: "provider-42" },
      markSentError: new Error("db_commit_failed"),
    });

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 1 }, deps);

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(operations).toEqual([
      { type: "claim", rowId: "finalize-failure-row" },
      { type: "send", to: "+972501234567", text: "Payment approved" },
      {
        type: "sent",
        rowId: "finalize-failure-row",
        now,
        providerMessageId: "provider-42",
      },
      {
        type: "failed",
        rowId: "finalize-failure-row",
        error: "openwa_send_finalize_failed_manual_review:unexpected_worker_error:db_commit_failed",
      },
    ]);
  });

  test("requeues retryable failures with the next retry time", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { deps, operations } = createDeps([makeRow({ id: "retry-row", attempt_count: 1 })], {
      sendResult: { ok: false, retryable: true, error: "openwa_temporarily_unavailable" },
      computeRetryAt: () => new Date("2026-07-01T10:15:00.000Z"),
    });

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 1 }, deps);

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, skipped: 1 });
    expect(operations[2]).toEqual({
      type: "requeue",
      rowId: "retry-row",
      error: "openwa_temporarily_unavailable",
      nextAttemptAt: new Date("2026-07-01T10:15:00.000Z"),
    });
  });

  test("requeues unexpected thrown send errors instead of leaving rows stranded", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { deps, operations } = createDeps([makeRow({ id: "throwing-send-row" })], {
      sendResult: new Error("socket_closed"),
      computeRetryAt: () => new Date("2026-07-01T10:15:00.000Z"),
    });

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 1 }, deps);

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, skipped: 1 });
    expect(operations).toEqual([
      { type: "claim", rowId: "throwing-send-row" },
      { type: "send", to: "+972501234567", text: "Payment approved" },
      {
        type: "requeue",
        rowId: "throwing-send-row",
        error: "unexpected_worker_error:socket_closed",
        nextAttemptAt: new Date("2026-07-01T10:15:00.000Z"),
      },
    ]);
  });

  test("marks terminal failures as failed", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { deps, operations } = createDeps([makeRow({ id: "failed-row" })], {
      sendResult: { ok: false, retryable: false, error: "invalid_whatsapp_phone" },
    });

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 1 }, deps);

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(operations[2]).toEqual({
      type: "failed",
      rowId: "failed-row",
      error: "invalid_whatsapp_phone",
    });
  });

  test("marks retryable failures as failed when no retry slot remains", async () => {
    const now = new Date("2026-07-01T10:00:00.000Z");
    const { deps, operations } = createDeps(
      [makeRow({ id: "retry-exhausted-row", attempt_count: 3 })],
      {
        sendResult: { ok: false, retryable: true, error: "openwa_temporarily_unavailable" },
        computeRetryAt: () => null,
      },
    );

    const result = await runPaymentConfirmedOpenwaPass({ now, limit: 1 }, deps);

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1, skipped: 0 });
    expect(operations).toEqual([
      { type: "claim", rowId: "retry-exhausted-row" },
      { type: "send", to: "+972501234567", text: "Payment approved" },
      {
        type: "failed",
        rowId: "retry-exhausted-row",
        error: "openwa_temporarily_unavailable",
      },
    ]);
  });

  test("marks malformed rows as terminal failures without sending", async () => {
    const rows = [
      makeRow({ id: "missing-text", generated_text: "   " }),
      makeRow({ id: "missing-phone", member: { phone: null } }),
    ];
    const { deps, operations } = createDeps(rows);

    const result = await runPaymentConfirmedOpenwaPass(
      { now: new Date("2026-07-01T10:00:00.000Z"), limit: 10 },
      deps,
    );

    expect(result).toEqual({ claimed: 2, sent: 0, failed: 2, skipped: 0 });
    expect(operations).toEqual([
      { type: "claim", rowId: "missing-text" },
      { type: "failed", rowId: "missing-text", error: "missing_generated_text" },
      { type: "claim", rowId: "missing-phone" },
      { type: "failed", rowId: "missing-phone", error: "missing_whatsapp_phone" },
    ]);
  });

  test("ignores rows that become unavailable before the claim succeeds", async () => {
    const claims = new Map([
      ["postponed-before-claim", null],
      ["claimed", { id: "claimed", attemptCount: 1 }],
    ]);
    const rows = [makeRow({ id: "postponed-before-claim" }), makeRow({ id: "claimed" })];
    const { deps, operations } = createDeps(rows, { claims });

    const result = await runPaymentConfirmedOpenwaPass(
      { now: new Date("2026-07-01T10:00:00.000Z"), limit: 10 },
      deps,
    );

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(operations).toEqual([
      { type: "claim", rowId: "postponed-before-claim" },
      { type: "claim", rowId: "claimed" },
      { type: "send", to: "+972501234567", text: "Payment approved" },
      {
        type: "sent",
        rowId: "claimed",
        now: new Date("2026-07-01T10:00:00.000Z"),
        providerMessageId: "provider-msg-1",
      },
    ]);
  });
});
