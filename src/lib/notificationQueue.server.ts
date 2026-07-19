import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { computeRetrySchedule } from "@/lib/notificationDelivery";

type NotificationLogRow = Database["public"]["Tables"]["notification_logs"]["Row"];

export const OPENWA_APPROVED_AUTOMATION_EVENT_TYPES = [
  "payment_confirmed",
  "booking_confirmed",
  "class_reminder_24h",
  "waitlist_spot_available",
  "class_cancelled_by_admin",
  "class_time_changed",
  "registered_no_action",
  "package_approved_no_booking",
  "first_lesson_followup",
  "low_credits",
  "package_expiring_soon",
  "no_upcoming_booking_14d",
  "payment_pending_reminder",
  "payment_failed",
] as const;

export const OPENWA_LIFECYCLE_EVENT_TYPES = [
  "registered_no_action",
  "package_approved_no_booking",
  "first_lesson_followup",
  "low_credits",
  "package_expiring_soon",
  "no_upcoming_booking_14d",
] as const;

export const OPENWA_LOCAL_STALE_SENDING_MS = 10 * 60_000;
export const OPENWA_STALE_SENDING_RECOVERY_ERROR = "stale_sending_recovery_manual_review";
export const OPENWA_LIFECYCLE_PAUSED_ERROR = "openwa_lifecycle_paused";
export const OPENWA_LIFECYCLE_CONFLICT_PAUSED_ERROR = "openwa_lifecycle_conflict_paused";

const OPENWA_PROVIDER = "openwa";
const OPENWA_CHANNEL = "whatsapp";

type ApprovedOpenwaEventType = (typeof OPENWA_APPROVED_AUTOMATION_EVENT_TYPES)[number];
type LifecycleOpenwaEventType = (typeof OPENWA_LIFECYCLE_EVENT_TYPES)[number];

type OpenwaNotificationRow = Pick<
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
  | "created_at"
> & {
  member: { phone: string | null } | null;
};

type OpenwaReportRow = Pick<
  NotificationLogRow,
  "id" | "attempt_count" | "status" | "trigger_type" | "channel" | "provider"
>;

export type OpenwaClaimJob = {
  id: string;
  to: string;
  text: string;
  attemptCount: number;
  triggerType: ApprovedOpenwaEventType;
};

export type OpenwaClaimResult = {
  jobs: OpenwaClaimJob[];
  dryRun: boolean;
  claimed: number;
  recovered: number;
  invalid: number;
};

export type OpenwaReportInput =
  | {
      jobId: string;
      status: "sent";
      providerMessageId?: string | null;
      workerId?: string | null;
      now?: Date;
    }
  | {
      jobId: string;
      status: "failed";
      retryable: boolean;
      error: string;
      providerMessageId?: string | null;
      workerId?: string | null;
      now?: Date;
    };

export type OpenwaReportResult =
  | { ok: true; outcome: "sent" | "requeued" | "failed"; nextAttemptAt?: string | null }
  | { ok: false; reason: "not_found" | "not_sending" };

type OpenwaQueueDeps = {
  listRows(input: {
    now: Date;
    limit: number;
    testPhone?: string | null;
    claimNotBefore?: Date | null;
  }): Promise<OpenwaNotificationRow[]>;
  claimRow(input: {
    row: OpenwaNotificationRow;
    now: Date;
  }): Promise<{ id: string; attemptCount: number } | null>;
  markSent(input: { rowId: string; now: Date; providerMessageId: string | null }): Promise<void>;
  requeue(input: {
    rowId: string;
    error: string;
    nextAttemptAt: Date;
    providerMessageId?: string | null;
  }): Promise<void>;
  markFailed(input: {
    rowId: string;
    error: string;
    providerMessageId?: string | null;
  }): Promise<void>;
  getReportRow(input: { rowId: string }): Promise<OpenwaReportRow | null>;
  computeRetryAt(input: {
    attemptCount: number;
    failedAt: Date;
    triggerType?: string | null;
  }): Date | null;
};

function isLifecyclePaused() {
  return process.env.OPENWA_WORKER_LIFECYCLE_PAUSED === "1";
}

function normalizeOpenwaTriggerType(
  value: string | null | undefined,
): ApprovedOpenwaEventType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (
    OPENWA_APPROVED_AUTOMATION_EVENT_TYPES.find((eventType) => eventType === normalized) ?? null
  );
}

export function isOpenwaLifecycleEventType(
  value: string | null | undefined,
): value is LifecycleOpenwaEventType {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return OPENWA_LIFECYCLE_EVENT_TYPES.some((eventType) => eventType === normalized);
}

function normalizePhoneForComparison(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/[^\d+]/g, "");
}

function isDueAt(value: string | null, now: Date) {
  if (!value) return true;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= now.getTime();
}

function isAtOrAfter(value: string | null, cutoff: Date | null | undefined) {
  if (!cutoff) return true;
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= cutoff.getTime();
}

function isStaleSendingAt(value: string | null, staleBefore: Date) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= staleBefore.getTime();
}

function isQueuedRowEligible(row: OpenwaNotificationRow, now: Date) {
  return (
    row.status === "queued" && isDueAt(row.scheduled_for, now) && isDueAt(row.next_attempt_at, now)
  );
}

function isStaleSendingRowEligible(row: OpenwaNotificationRow, now: Date, staleBefore: Date) {
  return (
    row.status === "sending" &&
    isDueAt(row.scheduled_for, now) &&
    isStaleSendingAt(row.last_attempt_at, staleBefore)
  );
}

function isEligibleRow(row: OpenwaNotificationRow, now: Date) {
  const staleBefore = new Date(now.getTime() - OPENWA_LOCAL_STALE_SENDING_MS);

  return (
    row.provider === OPENWA_PROVIDER &&
    row.channel === OPENWA_CHANNEL &&
    normalizeOpenwaTriggerType(row.trigger_type) != null &&
    (isQueuedRowEligible(row, now) || isStaleSendingRowEligible(row, now, staleBefore))
  );
}

function isStaleSendingRow(row: OpenwaNotificationRow, now: Date) {
  const staleBefore = new Date(now.getTime() - OPENWA_LOCAL_STALE_SENDING_MS);
  return isStaleSendingRowEligible(row, now, staleBefore);
}

export function normalizeOpenwaClaimLimit(limit: number | undefined) {
  if (limit == null) return 5;
  return Math.max(1, Math.min(10, Math.trunc(limit)));
}

function buildClaimableRowFilter(input: { nowIso: string; staleBeforeIso: string }) {
  const { nowIso, staleBeforeIso } = input;

  return [
    `and(status.eq.queued,or(scheduled_for.is.null,scheduled_for.lte.${nowIso}),or(next_attempt_at.is.null,next_attempt_at.lte.${nowIso}))`,
    `and(status.eq.sending,last_attempt_at.lte.${staleBeforeIso},or(scheduled_for.is.null,scheduled_for.lte.${nowIso}))`,
  ].join(",");
}

function buildQueueDeps(): OpenwaQueueDeps {
  return {
    async listRows({ now, limit, testPhone, claimNotBefore }) {
      const nowIso = now.toISOString();
      const staleBeforeIso = new Date(now.getTime() - OPENWA_LOCAL_STALE_SENDING_MS).toISOString();
      const candidateLimit = Math.max(limit * 5, limit, 50);

      let query = supabaseAdmin
        .from("notification_logs")
        .select(
          "id,attempt_count,generated_text,last_attempt_at,scheduled_for,next_attempt_at,status,trigger_type,channel,provider,created_at,member:members(phone)",
        )
        .eq("provider", OPENWA_PROVIDER)
        .eq("channel", OPENWA_CHANNEL)
        .in("trigger_type", [...OPENWA_APPROVED_AUTOMATION_EVENT_TYPES])
        .order("created_at", { ascending: true })
        .limit(candidateLimit);

      if (claimNotBefore) {
        query = query.gte("created_at", claimNotBefore.toISOString());
      }

      query = query.or(buildClaimableRowFilter({ nowIso, staleBeforeIso }));

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as OpenwaNotificationRow[];
      const normalizedTestPhone = normalizePhoneForComparison(testPhone);

      return rows
        .filter((row) => isEligibleRow(row, now))
        .filter((row) => isAtOrAfter(row.created_at, claimNotBefore))
        .filter((row) => {
          if (!normalizedTestPhone) return true;
          return normalizePhoneForComparison(row.member?.phone) === normalizedTestPhone;
        })
        .slice(0, limit);
    },

    async claimRow({ row, now }) {
      const nowIso = now.toISOString();
      const staleBeforeIso = new Date(now.getTime() - OPENWA_LOCAL_STALE_SENDING_MS).toISOString();

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
        .eq("provider", OPENWA_PROVIDER)
        .eq("channel", OPENWA_CHANNEL)
        .in("trigger_type", [...OPENWA_APPROVED_AUTOMATION_EVENT_TYPES]);

      query = query.or(buildClaimableRowFilter({ nowIso, staleBeforeIso }));

      const { data, error } = await query.select("id,attempt_count").maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return { id: data.id, attemptCount: data.attempt_count };
    },

    async markSent({ rowId, now, providerMessageId }) {
      const { error } = await supabaseAdmin
        .from("notification_logs")
        .update({
          status: "sent",
          provider: OPENWA_PROVIDER,
          sent_at: now.toISOString(),
          provider_message_id: providerMessageId,
          error_message: null,
          next_attempt_at: null,
        })
        .eq("id", rowId)
        .eq("status", "sending");

      if (error) throw error;
    },

    async requeue({ rowId, error, nextAttemptAt, providerMessageId }) {
      const { error: updateError } = await supabaseAdmin
        .from("notification_logs")
        .update({
          status: "queued",
          provider: OPENWA_PROVIDER,
          error_message: error,
          next_attempt_at: nextAttemptAt.toISOString(),
          provider_message_id: providerMessageId ?? null,
          sent_at: null,
        })
        .eq("id", rowId)
        .eq("status", "sending");

      if (updateError) throw updateError;
    },

    async markFailed({ rowId, error, providerMessageId }) {
      const { error: updateError } = await supabaseAdmin
        .from("notification_logs")
        .update({
          status: "failed",
          provider: OPENWA_PROVIDER,
          error_message: error,
          next_attempt_at: null,
          provider_message_id: providerMessageId ?? null,
          sent_at: null,
        })
        .eq("id", rowId)
        .eq("status", "sending");

      if (updateError) throw updateError;
    },

    async getReportRow({ rowId }) {
      const { data, error } = await supabaseAdmin
        .from("notification_logs")
        .select("id,attempt_count,status,trigger_type,channel,provider")
        .eq("id", rowId)
        .eq("channel", OPENWA_CHANNEL)
        .in("trigger_type", [...OPENWA_APPROVED_AUTOMATION_EVENT_TYPES])
        .maybeSingle();

      if (error) throw error;
      return (data as OpenwaReportRow | null) ?? null;
    },

    computeRetryAt({ attemptCount, failedAt, triggerType }) {
      return computeRetrySchedule({ attemptCount, failedAt, eventType: triggerType });
    },
  };
}

function toClaimJob(row: OpenwaNotificationRow, attemptCount: number): OpenwaClaimJob | null {
  const triggerType = normalizeOpenwaTriggerType(row.trigger_type);
  const text = row.generated_text?.trim() ?? "";
  const to = row.member?.phone?.trim() ?? "";

  if (!triggerType || !text || !to) return null;

  return {
    id: row.id,
    to,
    text,
    attemptCount,
    triggerType,
  };
}

export async function claimOpenwaNotifications(
  input: {
    now?: Date;
    limit?: number;
    dryRun?: boolean;
    workerId?: string | null;
    testPhone?: string | null;
    claimNotBefore?: Date | null;
  } = {},
  deps: OpenwaQueueDeps = buildQueueDeps(),
): Promise<OpenwaClaimResult> {
  const now = input.now ?? new Date();
  const limit = normalizeOpenwaClaimLimit(input.limit);
  const dryRun = input.dryRun === true;
  const rows = await deps.listRows({
    now,
    limit,
    testPhone: input.testPhone ?? null,
    claimNotBefore: input.claimNotBefore ?? null,
  });

  const result: OpenwaClaimResult = {
    jobs: [],
    dryRun,
    claimed: 0,
    recovered: 0,
    invalid: 0,
  };

  for (const row of rows) {
    if (!isEligibleRow(row, now)) continue;
    if (!isAtOrAfter(row.created_at, input.claimNotBefore)) continue;

    if (isLifecyclePaused() && isOpenwaLifecycleEventType(row.trigger_type)) {
      if (!dryRun && !isStaleSendingRow(row, now)) {
        await deps.markFailed({ rowId: row.id, error: OPENWA_LIFECYCLE_PAUSED_ERROR });
        result.invalid += 1;
      }
      continue;
    }

    if (dryRun) {
      const job = toClaimJob(row, row.attempt_count + 1);
      if (job) {
        result.jobs.push(job);
      } else if (!isStaleSendingRow(row, now)) {
        result.invalid += 1;
      }
      continue;
    }

    const claim = await deps.claimRow({ row, now });
    if (!claim) continue;

    result.claimed += 1;

    if (isStaleSendingRow(row, now)) {
      await deps.markFailed({ rowId: row.id, error: OPENWA_STALE_SENDING_RECOVERY_ERROR });
      result.recovered += 1;
      continue;
    }

    const job = toClaimJob(row, claim.attemptCount);
    if (job) {
      result.jobs.push(job);
      continue;
    }

    const error = row.generated_text?.trim() ? "missing_whatsapp_phone" : "missing_generated_text";
    await deps.markFailed({ rowId: row.id, error });
    result.invalid += 1;
  }

  return result;
}

export async function reportOpenwaNotification(
  input: OpenwaReportInput,
  deps: OpenwaQueueDeps = buildQueueDeps(),
): Promise<OpenwaReportResult> {
  const row = await deps.getReportRow({ rowId: input.jobId });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "sending") return { ok: false, reason: "not_sending" };

  const now = input.now ?? new Date();

  if (input.status === "sent") {
    await deps.markSent({
      rowId: row.id,
      now,
      providerMessageId: input.providerMessageId?.trim() || null,
    });
    return { ok: true, outcome: "sent" };
  }

  const retryAt = input.retryable
    ? deps.computeRetryAt({
        attemptCount: row.attempt_count,
        failedAt: now,
        triggerType: row.trigger_type,
      })
    : null;

  if (
    input.status === "failed" &&
    input.retryable &&
    input.error === "conflict" &&
    isOpenwaLifecycleEventType(row.trigger_type)
  ) {
    await deps.markFailed({ rowId: row.id, error: OPENWA_LIFECYCLE_CONFLICT_PAUSED_ERROR });
    return { ok: true, outcome: "failed" };
  }

  if (retryAt) {
    await deps.requeue({
      rowId: row.id,
      error: input.error,
      nextAttemptAt: retryAt,
      providerMessageId: input.providerMessageId?.trim() || null,
    });
    return { ok: true, outcome: "requeued", nextAttemptAt: retryAt.toISOString() };
  }

  await deps.markFailed({
    rowId: row.id,
    error: input.error,
    providerMessageId: input.providerMessageId?.trim() || null,
  });
  return { ok: true, outcome: "failed" };
}
