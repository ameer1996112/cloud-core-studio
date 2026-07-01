import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { computeRetrySchedule } from "@/lib/notificationDelivery";
import { createOpenwaClient, getOpenwaRuntimeConfig } from "@/lib/openwa.server";

type NotificationLogRow = Database["public"]["Tables"]["notification_logs"]["Row"];

type PaymentConfirmedOpenwaRow = Pick<
  NotificationLogRow,
  | "id"
  | "attempt_count"
  | "generated_text"
  | "last_attempt_at"
  | "scheduled_for"
  | "next_attempt_at"
  | "status"
  | "trigger_type"
  | "channel"
  | "provider"
> & {
  member: { phone: string | null } | null;
};

type QueueStats = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
};

type QueueWorkerDeps = {
  listRows(input: { now: Date; limit: number }): Promise<PaymentConfirmedOpenwaRow[]>;
  claimRow(input: {
    row: PaymentConfirmedOpenwaRow;
    now: Date;
  }): Promise<{ id: string; attemptCount: number } | null>;
  sendText(input: {
    to: string | null | undefined;
    text: string;
  }): Promise<
    | { ok: true; providerMessageId: string | null }
    | { ok: false; retryable: boolean; error: string }
  >;
  markSent(input: { rowId: string; now: Date; providerMessageId: string | null }): Promise<void>;
  requeue(input: { rowId: string; error: string; nextAttemptAt: Date }): Promise<void>;
  markFailed(input: { rowId: string; error: string }): Promise<void>;
  computeRetryAt(input: { attemptCount: number; failedAt: Date }): Date | null;
};

export const PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS = 10 * 60_000;
const STALE_SENDING_RECOVERY_ERROR = "stale_sending_recovery_manual_review";
const SENT_FINALIZATION_ERROR = "openwa_send_finalize_failed_manual_review";

function isDueAt(value: string | null, now: Date) {
  if (!value) return true;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= now.getTime();
}

function isStaleSendingAt(value: string | null, staleBefore: Date) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= staleBefore.getTime();
}

function isQueuedRowEligible(row: PaymentConfirmedOpenwaRow, now: Date) {
  return (
    row.status === "queued" && isDueAt(row.scheduled_for, now) && isDueAt(row.next_attempt_at, now)
  );
}

function isStaleSendingRowEligible(row: PaymentConfirmedOpenwaRow, now: Date, staleBefore: Date) {
  return (
    row.status === "sending" &&
    isDueAt(row.scheduled_for, now) &&
    isStaleSendingAt(row.last_attempt_at, staleBefore)
  );
}

function isEligibleRow(row: PaymentConfirmedOpenwaRow, now: Date) {
  const staleBefore = new Date(now.getTime() - PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS);

  return (
    row.provider === "openwa" &&
    row.channel === "whatsapp" &&
    row.trigger_type === "payment_confirmed" &&
    (isQueuedRowEligible(row, now) || isStaleSendingRowEligible(row, now, staleBefore))
  );
}

function normalizeLimit(limit: number | undefined) {
  if (limit == null) return 25;
  return Math.max(1, Math.trunc(limit));
}

function isStaleSendingRow(row: PaymentConfirmedOpenwaRow, now: Date) {
  const staleBefore = new Date(now.getTime() - PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS);
  return isStaleSendingRowEligible(row, now, staleBefore);
}

function buildClaimableRowFilter(input: { nowIso: string; staleBeforeIso: string }) {
  const { nowIso, staleBeforeIso } = input;

  return [
    `and(status.eq.queued,or(scheduled_for.is.null,scheduled_for.lte.${nowIso}),or(next_attempt_at.is.null,next_attempt_at.lte.${nowIso}))`,
    `and(status.eq.sending,last_attempt_at.lte.${staleBeforeIso},or(scheduled_for.is.null,scheduled_for.lte.${nowIso}))`,
  ].join(",");
}

function toUnexpectedWorkerError(error: unknown) {
  if (error instanceof Error && error.message) {
    return `unexpected_worker_error:${error.message}`;
  }

  return "unexpected_worker_error";
}

function buildQueueWorkerDeps(): QueueWorkerDeps {
  const config = getOpenwaRuntimeConfig();
  const openwa = createOpenwaClient(config);

  return {
    async listRows({ now, limit }) {
      const nowIso = now.toISOString();
      const staleBeforeIso = new Date(
        now.getTime() - PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS,
      ).toISOString();
      const candidateLimit = Math.max(limit * 5, limit, 50);

      let query = supabaseAdmin
        .from("notification_logs")
        .select(
          "id,attempt_count,generated_text,last_attempt_at,scheduled_for,next_attempt_at,status,trigger_type,channel,provider,member:members(phone)",
        )
        .eq("provider", "openwa")
        .eq("channel", "whatsapp")
        .eq("trigger_type", "payment_confirmed")
        .order("created_at", { ascending: true })
        .limit(candidateLimit);

      query = query.or(buildClaimableRowFilter({ nowIso, staleBeforeIso }));

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as PaymentConfirmedOpenwaRow[];
      return rows.filter((row) => isEligibleRow(row, now)).slice(0, limit);
    },

    async claimRow({ row, now }) {
      const nowIso = now.toISOString();
      const staleBeforeIso = new Date(
        now.getTime() - PAYMENT_CONFIRMED_OPENWA_STALE_SENDING_MS,
      ).toISOString();

      let query = supabaseAdmin
        .from("notification_logs")
        .update({
          status: "sending",
          last_attempt_at: nowIso,
          next_attempt_at: null,
          attempt_count: row.attempt_count + 1,
          error_message: null,
        })
        .eq("id", row.id)
        .eq("provider", "openwa")
        .eq("channel", "whatsapp")
        .eq("trigger_type", "payment_confirmed");

      // Re-check due-ness in the same UPDATE so rows postponed after list-time
      // cannot be claimed and sent early, and stale `sending` rows can recover.
      query = query.or(buildClaimableRowFilter({ nowIso, staleBeforeIso }));

      const { data, error } = await query.select("id,attempt_count").maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return { id: data.id, attemptCount: data.attempt_count };
    },

    async sendText({ to, text }) {
      return openwa.sendText({ to, text });
    },

    async markSent({ rowId, now, providerMessageId }) {
      const { error } = await supabaseAdmin
        .from("notification_logs")
        .update({
          status: "sent",
          sent_at: now.toISOString(),
          provider_message_id: providerMessageId,
          error_message: null,
          next_attempt_at: null,
        })
        .eq("id", rowId);

      if (error) throw error;
    },

    async requeue({ rowId, error, nextAttemptAt }) {
      const { error: updateError } = await supabaseAdmin
        .from("notification_logs")
        .update({
          status: "queued",
          error_message: error,
          next_attempt_at: nextAttemptAt.toISOString(),
          provider_message_id: null,
          sent_at: null,
        })
        .eq("id", rowId);

      if (updateError) throw updateError;
    },

    async markFailed({ rowId, error }) {
      const { error: updateError } = await supabaseAdmin
        .from("notification_logs")
        .update({
          status: "failed",
          error_message: error,
          next_attempt_at: null,
          provider_message_id: null,
        })
        .eq("id", rowId);

      if (updateError) throw updateError;
    },

    computeRetryAt({ attemptCount, failedAt }) {
      return computeRetrySchedule({ attemptCount, failedAt });
    },
  };
}

export async function runPaymentConfirmedOpenwaPass(
  input: { now?: Date; limit?: number } = {},
  deps: QueueWorkerDeps = buildQueueWorkerDeps(),
): Promise<QueueStats> {
  const now = input.now ?? new Date();
  const limit = normalizeLimit(input.limit);
  const stats: QueueStats = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

  const rows = await deps.listRows({ now, limit });

  for (const row of rows) {
    if (!isEligibleRow(row, now)) continue;

    const claim = await deps.claimRow({ row, now });
    if (!claim) continue;

    stats.claimed += 1;

    if (isStaleSendingRow(row, now)) {
      await deps.markFailed({ rowId: row.id, error: STALE_SENDING_RECOVERY_ERROR });
      stats.failed += 1;
      continue;
    }

    let providerSendCommitted = false;

    try {
      const text = row.generated_text?.trim() ?? "";
      const phone = row.member?.phone ?? null;

      if (!text) {
        await deps.markFailed({ rowId: row.id, error: "missing_generated_text" });
        stats.failed += 1;
        continue;
      }

      if (!phone) {
        await deps.markFailed({ rowId: row.id, error: "missing_whatsapp_phone" });
        stats.failed += 1;
        continue;
      }

      const result = await deps.sendText({ to: phone, text });

      if (result.ok) {
        providerSendCommitted = true;
        await deps.markSent({
          rowId: row.id,
          now,
          providerMessageId: result.providerMessageId,
        });
        stats.sent += 1;
        continue;
      }

      if (result.retryable) {
        const retryAt = deps.computeRetryAt({
          attemptCount: claim.attemptCount,
          failedAt: now,
        });

        if (retryAt) {
          await deps.requeue({
            rowId: row.id,
            error: result.error,
            nextAttemptAt: retryAt,
          });
          stats.skipped += 1;
          continue;
        }
      }

      await deps.markFailed({ rowId: row.id, error: result.error });
      stats.failed += 1;
    } catch (error) {
      const retryAt = deps.computeRetryAt({
        attemptCount: claim.attemptCount,
        failedAt: now,
      });
      const unexpectedWorkerError = toUnexpectedWorkerError(error);
      let terminalError = unexpectedWorkerError;

      if (providerSendCommitted) {
        await deps.markFailed({
          rowId: row.id,
          error: `${SENT_FINALIZATION_ERROR}:${unexpectedWorkerError}`,
        });
        stats.failed += 1;
        continue;
      }

      if (retryAt) {
        try {
          await deps.requeue({
            rowId: row.id,
            error: unexpectedWorkerError,
            nextAttemptAt: retryAt,
          });
          stats.skipped += 1;
          continue;
        } catch (requeueError) {
          terminalError = toUnexpectedWorkerError(requeueError);
        }
      }

      await deps.markFailed({
        rowId: row.id,
        error: retryAt == null ? unexpectedWorkerError : terminalError,
      });
      stats.failed += 1;
    }
  }

  return stats;
}
