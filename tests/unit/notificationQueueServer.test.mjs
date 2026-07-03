import { describe, expect, test } from "bun:test";
import {
  claimOpenwaNotifications,
  OPENWA_APPROVED_AUTOMATION_EVENT_TYPES,
  OPENWA_LOCAL_STALE_SENDING_MS,
  OPENWA_STALE_SENDING_RECOVERY_ERROR,
  reportOpenwaNotification,
} from "../../src/lib/notificationQueue.server.ts";

function makeRow(overrides = {}) {
  return {
    id: "row-1",
    attempt_count: 0,
    generated_text: "Message ready",
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

function createClaimDeps(rows, options = {}) {
  const operations = [];
  const claims = options.claims ?? new Map();

  return {
    operations,
    deps: {
      async listRows({ limit, testPhone }) {
        operations.push({ type: "list", limit, testPhone: testPhone ?? null });
        return rows.slice(0, limit);
      },
      async claimRow({ row }) {
        operations.push({ type: "claim", rowId: row.id });
        if (claims.has(row.id)) return claims.get(row.id);
        return { id: row.id, attemptCount: row.attempt_count + 1 };
      },
      async markSent(payload) {
        operations.push({ type: "sent", ...payload });
      },
      async requeue(payload) {
        operations.push({ type: "requeue", ...payload });
      },
      async markFailed(payload) {
        operations.push({ type: "failed", ...payload });
      },
      async getReportRow() {
        return null;
      },
      computeRetryAt() {
        return null;
      },
    },
  };
}

function createReportDeps(row, options = {}) {
  const operations = [];

  return {
    operations,
    deps: {
      async listRows() {
        return [];
      },
      async claimRow() {
        return null;
      },
      async markSent(payload) {
        operations.push({ type: "sent", ...payload });
      },
      async requeue(payload) {
        operations.push({ type: "requeue", ...payload });
      },
      async markFailed(payload) {
        operations.push({ type: "failed", ...payload });
      },
      async getReportRow() {
        return row;
      },
      computeRetryAt({ attemptCount, failedAt }) {
        if (options.computeRetryAt) return options.computeRetryAt({ attemptCount, failedAt });
        return new Date(failedAt.getTime() + 5 * 60_000);
      },
    },
  };
}

describe("claimOpenwaNotifications", () => {
  test("claims only approved queued whatsapp rows and returns jobs", async () => {
    const rows = [
      makeRow({ id: "payment" }),
      makeRow({ id: "booking", trigger_type: "booking_confirmed" }),
      makeRow({ id: "email", channel: "email" }),
      makeRow({ id: "other-provider", provider: "other" }),
      makeRow({ id: "wrong-trigger", trigger_type: "receipt_issued" }),
    ];
    const { deps, operations } = createClaimDeps(rows);

    const result = await claimOpenwaNotifications(
      { now: new Date("2026-07-02T09:00:00.000Z"), limit: 10 },
      deps,
    );

    expect(result.jobs.map((job) => job.id)).toEqual(["payment", "booking"]);
    expect(result.claimed).toBe(2);
    expect(
      operations.filter((entry) => entry.type === "claim").map((entry) => entry.rowId),
    ).toEqual(["payment", "booking"]);
  });

  test("approved OpenWA automation event set matches the Mac worker operational scope", () => {
    expect([...OPENWA_APPROVED_AUTOMATION_EVENT_TYPES]).toEqual([
      "payment_confirmed",
      "booking_confirmed",
      "class_reminder_24h",
      "waitlist_spot_available",
      "class_cancelled_by_admin",
      "class_time_changed",
    ]);
  });

  test("dry-run previews jobs without mutating queue state", async () => {
    const { deps, operations } = createClaimDeps([makeRow({ id: "preview-row" })]);

    const result = await claimOpenwaNotifications(
      { now: new Date("2026-07-02T09:00:00.000Z"), limit: 5, dryRun: true },
      deps,
    );

    expect(result).toEqual({
      jobs: [
        {
          id: "preview-row",
          to: "+972501234567",
          text: "Message ready",
          attemptCount: 1,
          triggerType: "payment_confirmed",
        },
      ],
      dryRun: true,
      claimed: 0,
      recovered: 0,
      invalid: 0,
    });
    expect(operations).toEqual([{ type: "list", limit: 5, testPhone: null }]);
  });

  test("recovers stale sending rows instead of handing them to the worker", async () => {
    const now = new Date("2026-07-02T09:00:00.000Z");
    const staleLastAttemptAt = new Date(
      now.getTime() - OPENWA_LOCAL_STALE_SENDING_MS,
    ).toISOString();
    const { deps, operations } = createClaimDeps([
      makeRow({
        id: "stale-row",
        status: "sending",
        last_attempt_at: staleLastAttemptAt,
      }),
    ]);

    const result = await claimOpenwaNotifications({ now, limit: 5 }, deps);

    expect(result.jobs).toEqual([]);
    expect(result.claimed).toBe(1);
    expect(result.recovered).toBe(1);
    expect(operations).toEqual([
      { type: "list", limit: 5, testPhone: null },
      { type: "claim", rowId: "stale-row" },
      {
        type: "failed",
        rowId: "stale-row",
        error: OPENWA_STALE_SENDING_RECOVERY_ERROR,
      },
    ]);
  });

  test("fails malformed rows after claim so they do not loop forever", async () => {
    const { deps, operations } = createClaimDeps([
      makeRow({ id: "missing-text", generated_text: "   " }),
      makeRow({ id: "missing-phone", member: { phone: null } }),
    ]);

    const result = await claimOpenwaNotifications(
      { now: new Date("2026-07-02T09:00:00.000Z"), limit: 10 },
      deps,
    );

    expect(result.jobs).toEqual([]);
    expect(result.invalid).toBe(2);
    expect(operations).toEqual([
      { type: "list", limit: 10, testPhone: null },
      { type: "claim", rowId: "missing-text" },
      { type: "failed", rowId: "missing-text", error: "missing_generated_text" },
      { type: "claim", rowId: "missing-phone" },
      { type: "failed", rowId: "missing-phone", error: "missing_whatsapp_phone" },
    ]);
  });

  test("passes test-phone filtering down to queue selection", async () => {
    const { deps, operations } = createClaimDeps([makeRow({ id: "test-only-row" })]);

    await claimOpenwaNotifications(
      {
        now: new Date("2026-07-02T09:00:00.000Z"),
        limit: 5,
        testPhone: "+972-50-123-4567",
      },
      deps,
    );

    expect(operations[0]).toEqual({
      type: "list",
      limit: 5,
      testPhone: "+972-50-123-4567",
    });
  });
});

describe("reportOpenwaNotification", () => {
  test("marks sent rows as sent with the local provider", async () => {
    const { deps, operations } = createReportDeps({
      id: "job-1",
      attempt_count: 1,
      status: "sending",
      trigger_type: "booking_confirmed",
      channel: "whatsapp",
      provider: "openwa",
    });
    const now = new Date("2026-07-02T09:00:00.000Z");

    const result = await reportOpenwaNotification(
      {
        jobId: "job-1",
        status: "sent",
        providerMessageId: "provider-1",
        workerId: "ameer-macbook",
        now,
      },
      deps,
    );

    expect(result).toEqual({ ok: true, outcome: "sent" });
    expect(operations).toEqual([
      { type: "sent", rowId: "job-1", now, providerMessageId: "provider-1" },
    ]);
  });

  test("requeues retryable failures with the next retry slot", async () => {
    const retryAt = new Date("2026-07-02T09:15:00.000Z");
    const { deps, operations } = createReportDeps(
      {
        id: "job-2",
        attempt_count: 2,
        status: "sending",
        trigger_type: "payment_confirmed",
        channel: "whatsapp",
        provider: "openwa",
      },
      {
        computeRetryAt: () => retryAt,
      },
    );

    const result = await reportOpenwaNotification(
      {
        jobId: "job-2",
        status: "failed",
        retryable: true,
        error: "openwa_network_error",
        workerId: "ameer-macbook",
        now: new Date("2026-07-02T09:00:00.000Z"),
      },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      outcome: "requeued",
      nextAttemptAt: retryAt.toISOString(),
    });
    expect(operations).toEqual([
      {
        type: "requeue",
        rowId: "job-2",
        error: "openwa_network_error",
        nextAttemptAt: retryAt,
      },
    ]);
  });

  test("marks retryable failures as failed when retries are exhausted", async () => {
    const { deps, operations } = createReportDeps(
      {
        id: "job-3",
        attempt_count: 4,
        status: "sending",
        trigger_type: "class_time_changed",
        channel: "whatsapp",
        provider: "openwa",
      },
      {
        computeRetryAt: () => null,
      },
    );

    const result = await reportOpenwaNotification(
      {
        jobId: "job-3",
        status: "failed",
        retryable: true,
        error: "openwa_temporarily_unavailable",
        workerId: "ameer-macbook",
      },
      deps,
    );

    expect(result).toEqual({ ok: true, outcome: "failed" });
    expect(operations).toEqual([
      {
        type: "failed",
        rowId: "job-3",
        error: "openwa_temporarily_unavailable",
      },
    ]);
  });

  test("rejects report calls for missing or non-sending jobs", async () => {
    const missing = await reportOpenwaNotification(
      {
        jobId: "job-missing",
        status: "sent",
        providerMessageId: "provider-1",
      },
      createReportDeps(null).deps,
    );

    const notSending = await reportOpenwaNotification(
      {
        jobId: "job-4",
        status: "failed",
        retryable: false,
        error: "blocked",
      },
      createReportDeps({
        id: "job-4",
        attempt_count: 1,
        status: "queued",
        trigger_type: "payment_confirmed",
        channel: "whatsapp",
        provider: "openwa",
      }).deps,
    );

    expect(missing).toEqual({ ok: false, reason: "not_found" });
    expect(notSending).toEqual({ ok: false, reason: "not_sending" });
  });
});
