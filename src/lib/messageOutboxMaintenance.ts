export type ExpiredOutboxRepository = {
  listExpired(nowIso: string, limit: number): Promise<Array<{ id: string }>>;
  markExpired(ids: string[], nowIso: string): Promise<number>;
};

export type OutboxHealth = {
  status: "healthy" | "delayed" | "critical";
  totalPending: number;
  due: number;
  scheduled: number;
  expired: number;
  oldestDueAt: string | null;
  oldestDueAgeMinutes: number;
};

export type StaleOutboxRepository = {
  listStale(cutoffIso: string, nowIso: string, limit: number): Promise<StaleOutboxRow[]>;
  transactionStillCurrent(row: StaleOutboxRow, nowIso: string): Promise<boolean>;
  markStale(decisions: StaleOutboxDecision[], nowIso: string): Promise<number>;
};

export type StaleOutboxRow = {
  id: string;
  event_type: string;
  aggregate_id: string | null;
  member_id: string | null;
};

export type StaleOutboxDecision = {
  id: string;
  reason:
    | "outbox_stale_promotion_suppressed"
    | "outbox_stale_transaction_reconciled_current"
    | "outbox_stale_transaction_reconciled_obsolete";
};

export type StaleDeliveryRepository = {
  listStale(cutoffIso: string, nowIso: string, limit: number): Promise<Array<{ id: string }>>;
  markStale(ids: string[], nowIso: string): Promise<number>;
};

// A recovered worker must never release an outage backlog as live customer traffic.
// Events older than this boundary are audited and terminalized according to event policy.
export const OUTBOX_RECOVERY_FRESHNESS_MS = 24 * 60 * 60_000;

async function closeOutboxBatches<T>(input: {
  list: (limit: number) => Promise<T[]>;
  mark: (rows: T[]) => Promise<number>;
  batchSize: number;
  noProgressError: string;
}) {
  const normalizedBatchSize = Math.max(1, Math.min(1_000, Math.trunc(input.batchSize)));
  let closed = 0;
  let batches = 0;
  for (;;) {
    const rows = await input.list(normalizedBatchSize);
    if (rows.length === 0) return { closed, batches };
    const updated = await input.mark(rows);
    if (updated <= 0) throw new Error(input.noProgressError);
    closed += updated;
    batches += 1;
  }
}

export async function closeExpiredOutboxRows(
  repository: ExpiredOutboxRepository,
  now: Date,
  batchSize = 1_000,
) {
  if (Number.isNaN(now.getTime())) throw new RangeError("invalid_outbox_cleanup_clock");
  const nowIso = now.toISOString();
  return closeOutboxBatches({
    list: (limit) => repository.listExpired(nowIso, limit),
    mark: (rows) =>
      repository.markExpired([...new Set(rows.map((row) => row.id).filter(Boolean))], nowIso),
    batchSize,
    noProgressError: "expired_outbox_cleanup_made_no_progress",
  });
}

export async function closeStaleOutboxRows(
  repository: StaleOutboxRepository,
  now: Date,
  isPromotional: (eventType: string) => boolean,
  batchSize = 1_000,
) {
  if (Number.isNaN(now.getTime())) throw new RangeError("invalid_outbox_cleanup_clock");
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - OUTBOX_RECOVERY_FRESHNESS_MS).toISOString();
  return closeOutboxBatches({
    list: (limit) => repository.listStale(cutoffIso, nowIso, limit),
    mark: async (rows) => {
      const decisions: StaleOutboxDecision[] = [];
      for (const row of rows) {
        if (isPromotional(row.event_type)) {
          decisions.push({ id: row.id, reason: "outbox_stale_promotion_suppressed" });
          continue;
        }
        const current = await repository.transactionStillCurrent(row, nowIso);
        decisions.push({
          id: row.id,
          reason: current
            ? "outbox_stale_transaction_reconciled_current"
            : "outbox_stale_transaction_reconciled_obsolete",
        });
      }
      return repository.markStale(decisions, nowIso);
    },
    batchSize,
    noProgressError: "stale_outbox_cleanup_made_no_progress",
  });
}

export async function closeStaleDeliveryRows(
  repository: StaleDeliveryRepository,
  now: Date,
  batchSize = 1_000,
) {
  if (Number.isNaN(now.getTime())) throw new RangeError("invalid_delivery_cleanup_clock");
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - OUTBOX_RECOVERY_FRESHNESS_MS).toISOString();
  return closeOutboxBatches({
    list: (limit) => repository.listStale(cutoffIso, nowIso, limit),
    mark: (rows) =>
      repository.markStale([...new Set(rows.map((row) => row.id).filter(Boolean))], nowIso),
    batchSize,
    noProgressError: "stale_delivery_cleanup_made_no_progress",
  });
}

export function summarizeOutboxHealth(
  rows: Array<{ created_at: string; available_at: string; expires_at: string | null }>,
  now = new Date(),
): OutboxHealth {
  if (Number.isNaN(now.getTime())) throw new RangeError("invalid_outbox_health_clock");
  const nowMs = now.getTime();
  const expired = rows.filter(
    (row) => row.expires_at && new Date(row.expires_at).getTime() <= nowMs,
  );
  const active = rows.filter(
    (row) => !row.expires_at || new Date(row.expires_at).getTime() > nowMs,
  );
  const due = active.filter((row) => new Date(row.available_at).getTime() <= nowMs);
  const scheduled = active.length - due.length;
  const oldestDueAt =
    due
      .map((row) => row.available_at)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;
  const oldestDueAgeMinutes = oldestDueAt
    ? Math.max(0, Math.floor((nowMs - new Date(oldestDueAt).getTime()) / 60_000))
    : 0;
  const status =
    expired.length > 0 || oldestDueAgeMinutes >= 15
      ? ("critical" as const)
      : oldestDueAgeMinutes >= 5
        ? ("delayed" as const)
        : ("healthy" as const);
  return {
    status,
    totalPending: rows.length,
    due: due.length,
    scheduled,
    expired: expired.length,
    oldestDueAt,
    oldestDueAgeMinutes,
  };
}
