import { describe, expect, test } from "bun:test";
import {
  closeExpiredOutboxRows,
  closeStaleDeliveryRows,
  closeStaleOutboxRows,
  summarizeOutboxHealth,
} from "../../src/lib/messageOutboxMaintenance.ts";

describe("message outbox maintenance", () => {
  test("terminalizes every expired pending event in bounded batches", async () => {
    const pending = ["expired-1", "expired-2", "expired-3"];
    const closed = [];
    const repository = {
      async listExpired(_now, limit) {
        return pending.slice(0, limit).map((id) => ({ id }));
      },
      async markExpired(ids, now) {
        for (const id of ids) {
          pending.splice(pending.indexOf(id), 1);
          closed.push({ id, now });
        }
        return ids.length;
      },
    };

    const result = await closeExpiredOutboxRows(
      repository,
      new Date("2026-08-08T12:00:00.000Z"),
      2,
    );

    expect(result).toEqual({ closed: 3, batches: 2 });
    expect(closed).toEqual([
      { id: "expired-1", now: "2026-08-08T12:00:00.000Z" },
      { id: "expired-2", now: "2026-08-08T12:00:00.000Z" },
      { id: "expired-3", now: "2026-08-08T12:00:00.000Z" },
    ]);
    expect(pending).toEqual([]);
  });

  test("stops safely when a storage update makes no progress", async () => {
    let lists = 0;
    const repository = {
      async listExpired() {
        lists += 1;
        return [{ id: "stuck" }];
      },
      async markExpired() {
        return 0;
      },
    };

    await expect(
      closeExpiredOutboxRows(repository, new Date("2026-08-08T12:00:00.000Z"), 100),
    ).rejects.toThrow("expired_outbox_cleanup_made_no_progress");
    expect(lists).toBe(1);
  });

  test("suppresses stale promotions and reconciles stale transactions before terminalizing", async () => {
    const pending = [
      { id: "promotion", event_type: "class_published", aggregate_id: "class-1", member_id: "m1" },
      {
        id: "transaction-current",
        event_type: "booking_confirmed",
        aggregate_id: "booking-1",
        member_id: "m1",
      },
      {
        id: "transaction-obsolete",
        event_type: "credits_low",
        aggregate_id: "m2",
        member_id: "m2",
      },
    ];
    const cutoffs = [];
    const reconciled = [];
    const decisions = [];
    const repository = {
      async listStale(cutoff, now, limit) {
        cutoffs.push({ cutoff, now });
        return pending.slice(0, limit);
      },
      async transactionStillCurrent(row) {
        reconciled.push(row.id);
        return row.id === "transaction-current";
      },
      async markStale(batch) {
        decisions.push(...batch);
        for (const decision of batch) {
          const index = pending.findIndex((row) => row.id === decision.id);
          if (index >= 0) pending.splice(index, 1);
        }
        return batch.length;
      },
    };

    const result = await closeStaleOutboxRows(
      repository,
      new Date("2026-08-08T12:00:00.000Z"),
      (eventType) => eventType === "class_published",
      2,
    );

    expect(result).toEqual({ closed: 3, batches: 2 });
    expect(cutoffs[0]).toEqual({
      cutoff: "2026-08-07T12:00:00.000Z",
      now: "2026-08-08T12:00:00.000Z",
    });
    expect(reconciled).toEqual(["transaction-current", "transaction-obsolete"]);
    expect(decisions).toEqual([
      { id: "promotion", reason: "outbox_stale_promotion_suppressed" },
      {
        id: "transaction-current",
        reason: "outbox_stale_transaction_reconciled_current",
      },
      {
        id: "transaction-obsolete",
        reason: "outbox_stale_transaction_reconciled_obsolete",
      },
    ]);
  });

  test("cancels only claimable deliveries that predate the recovery freshness window", async () => {
    const pending = ["stale-v2", "stale-snapshot"];
    const cutoffs = [];
    const cancelled = [];
    const repository = {
      async listStale(cutoff, now, limit) {
        cutoffs.push({ cutoff, now });
        return pending.slice(0, limit).map((id) => ({ id }));
      },
      async markStale(ids, now) {
        for (const id of ids) {
          pending.splice(pending.indexOf(id), 1);
          cancelled.push({ id, now });
        }
        return ids.length;
      },
    };

    const result = await closeStaleDeliveryRows(
      repository,
      new Date("2026-08-08T12:00:00.000Z"),
      1,
    );

    expect(result).toEqual({ closed: 2, batches: 2 });
    expect(cutoffs[0]).toEqual({
      cutoff: "2026-08-07T12:00:00.000Z",
      now: "2026-08-08T12:00:00.000Z",
    });
    expect(cancelled).toEqual([
      { id: "stale-v2", now: "2026-08-08T12:00:00.000Z" },
      { id: "stale-snapshot", now: "2026-08-08T12:00:00.000Z" },
    ]);
  });

  test("reports due, scheduled and expired pending events with oldest queue age", () => {
    const health = summarizeOutboxHealth(
      [
        {
          created_at: "2026-08-08T11:30:00.000Z",
          available_at: "2026-08-08T11:30:00.000Z",
          expires_at: null,
        },
        {
          created_at: "2026-08-08T11:50:00.000Z",
          available_at: "2026-08-08T13:00:00.000Z",
          expires_at: null,
        },
        {
          created_at: "2026-08-08T10:00:00.000Z",
          available_at: "2026-08-08T10:00:00.000Z",
          expires_at: "2026-08-08T11:00:00.000Z",
        },
      ],
      new Date("2026-08-08T12:00:00.000Z"),
    );

    expect(health).toEqual({
      status: "critical",
      totalPending: 3,
      due: 1,
      scheduled: 1,
      expired: 1,
      oldestDueAt: "2026-08-08T11:30:00.000Z",
      oldestDueAgeMinutes: 30,
    });
  });
});
