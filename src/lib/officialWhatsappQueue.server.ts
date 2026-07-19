import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { computeRetrySchedule } from "@/lib/notificationDelivery";
import {
  buildOfficialWhatsappTemplatePayload,
  isOfficialWhatsappTemplateEventType,
  OFFICIAL_WHATSAPP_CHANNEL,
  OFFICIAL_WHATSAPP_PROVIDER,
  OFFICIAL_WHATSAPP_TEMPLATE_EVENT_TYPES,
  sendOfficialWhatsappTemplateMessage,
  type OfficialWhatsappSendResult,
} from "@/lib/officialWhatsapp.server";

type NotificationLogRow = Database["public"]["Tables"]["notification_logs"]["Row"];

const LEGACY_OPENWA_PROVIDER = "openwa";
const OFFICIAL_STALE_SENDING_MS = 10 * 60_000;

type OfficialWhatsappNotificationRow = Pick<
  NotificationLogRow,
  | "id"
  | "attempt_count"
  | "created_at"
  | "language"
  | "last_attempt_at"
  | "next_attempt_at"
  | "payload"
  | "provider"
  | "scheduled_for"
  | "status"
  | "trigger_type"
> & {
  member: { phone: string | null } | null;
};

type OfficialWhatsappQueueDeps = {
  listRows(input: {
    now: Date;
    limit: number;
    claimOpenwaBacklog: boolean;
  }): Promise<OfficialWhatsappNotificationRow[]>;
  claimRow(input: {
    row: OfficialWhatsappNotificationRow;
    now: Date;
    claimOpenwaBacklog: boolean;
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
  computeRetryAt(input: {
    attemptCount: number;
    failedAt: Date;
    triggerType?: string | null;
  }): Date | null;
  send(input: { row: OfficialWhatsappNotificationRow }): Promise<OfficialWhatsappSendResult>;
};

export type OfficialWhatsappRunResult = {
  processed: number;
  sent: number;
  requeued: number;
  failed: number;
  invalid: number;
  skipped: number;
};

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

function isQueuedRowEligible(row: OfficialWhatsappNotificationRow, now: Date) {
  return (
    row.status === "queued" && isDueAt(row.scheduled_for, now) && isDueAt(row.next_attempt_at, now)
  );
}

function isStaleSendingRowEligible(row: OfficialWhatsappNotificationRow, now: Date) {
  const staleBefore = new Date(now.getTime() - OFFICIAL_STALE_SENDING_MS);
  return (
    row.status === "sending" &&
    isDueAt(row.scheduled_for, now) &&
    isStaleSendingAt(row.last_attempt_at, staleBefore)
  );
}

function isProviderEligible(row: OfficialWhatsappNotificationRow, claimOpenwaBacklog: boolean) {
  return (
    row.provider === OFFICIAL_WHATSAPP_PROVIDER ||
    (claimOpenwaBacklog && row.provider === LEGACY_OPENWA_PROVIDER)
  );
}

function isEligibleRow(
  row: OfficialWhatsappNotificationRow,
  now: Date,
  claimOpenwaBacklog: boolean,
) {
  return (
    isProviderEligible(row, claimOpenwaBacklog) &&
    isOfficialWhatsappTemplateEventType(row.trigger_type) &&
    (isQueuedRowEligible(row, now) || isStaleSendingRowEligible(row, now))
  );
}

function buildClaimableRowFilter(input: { nowIso: string; staleBeforeIso: string }) {
  const { nowIso, staleBeforeIso } = input;

  return [
    `and(status.eq.queued,or(scheduled_for.is.null,scheduled_for.lte.${nowIso}),or(next_attempt_at.is.null,next_attempt_at.lte.${nowIso}))`,
    `and(status.eq.sending,last_attempt_at.lte.${staleBeforeIso},or(scheduled_for.is.null,scheduled_for.lte.${nowIso}))`,
  ].join(",");
}

export function normalizeOfficialWhatsappRunLimit(limit: number | undefined) {
  if (limit == null) return 5;
  return Math.max(1, Math.min(10, Math.trunc(limit)));
}

function providersForRun(claimOpenwaBacklog: boolean) {
  return claimOpenwaBacklog
    ? [OFFICIAL_WHATSAPP_PROVIDER, LEGACY_OPENWA_PROVIDER]
    : [OFFICIAL_WHATSAPP_PROVIDER];
}

function buildQueueDeps(): OfficialWhatsappQueueDeps {
  return {
    async listRows({ now, limit, claimOpenwaBacklog }) {
      const nowIso = now.toISOString();
      const staleBeforeIso = new Date(now.getTime() - OFFICIAL_STALE_SENDING_MS).toISOString();
      const candidateLimit = Math.max(limit * 5, limit, 50);

      let query = supabaseAdmin
        .from("notification_logs")
        .select(
          "id,attempt_count,created_at,language,last_attempt_at,next_attempt_at,payload,provider,scheduled_for,status,trigger_type,member:members(phone)",
        )
        .eq("channel", OFFICIAL_WHATSAPP_CHANNEL)
        .in("provider", providersForRun(claimOpenwaBacklog))
        .in("trigger_type", [...OFFICIAL_WHATSAPP_TEMPLATE_EVENT_TYPES])
        .order("created_at", { ascending: true })
        .limit(candidateLimit);

      query = query.or(buildClaimableRowFilter({ nowIso, staleBeforeIso }));

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as OfficialWhatsappNotificationRow[])
        .filter((row) => isEligibleRow(row, now, claimOpenwaBacklog))
        .slice(0, limit);
    },

    async claimRow({ row, now, claimOpenwaBacklog }) {
      const nowIso = now.toISOString();
      const staleBeforeIso = new Date(now.getTime() - OFFICIAL_STALE_SENDING_MS).toISOString();

      let query = supabaseAdmin
        .from("notification_logs")
        .update({
          status: "sending",
          provider: OFFICIAL_WHATSAPP_PROVIDER,
          last_attempt_at: nowIso,
          next_attempt_at: null,
          attempt_count: row.attempt_count + 1,
          error_message: null,
        })
        .eq("id", row.id)
        .eq("channel", OFFICIAL_WHATSAPP_CHANNEL)
        .in("provider", providersForRun(claimOpenwaBacklog))
        .in("trigger_type", [...OFFICIAL_WHATSAPP_TEMPLATE_EVENT_TYPES]);

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
          provider: OFFICIAL_WHATSAPP_PROVIDER,
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
          provider: OFFICIAL_WHATSAPP_PROVIDER,
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
          provider: OFFICIAL_WHATSAPP_PROVIDER,
          error_message: error,
          next_attempt_at: null,
          provider_message_id: providerMessageId ?? null,
          sent_at: null,
        })
        .eq("id", rowId)
        .eq("status", "sending");

      if (updateError) throw updateError;
    },

    computeRetryAt({ attemptCount, failedAt, triggerType }) {
      return computeRetrySchedule({ attemptCount, failedAt, eventType: triggerType });
    },

    async send({ row }) {
      const template = buildOfficialWhatsappTemplatePayload(row);
      const to = row.member?.phone?.trim() || "";
      if (!template) return { ok: false, retryable: false, error: "missing_whatsapp_template" };
      if (!to) return { ok: false, retryable: false, error: "missing_whatsapp_phone" };
      return sendOfficialWhatsappTemplateMessage({ to, template });
    },
  };
}

export async function runOfficialWhatsappQueue(
  input: {
    now?: Date;
    limit?: number;
    dryRun?: boolean;
    claimOpenwaBacklog?: boolean;
  } = {},
  deps: OfficialWhatsappQueueDeps = buildQueueDeps(),
): Promise<OfficialWhatsappRunResult> {
  const now = input.now ?? new Date();
  const limit = normalizeOfficialWhatsappRunLimit(input.limit);
  const dryRun = input.dryRun === true;
  const claimOpenwaBacklog =
    input.claimOpenwaBacklog ?? process.env.WHATSAPP_OFFICIAL_CLAIM_OPENWA_BACKLOG === "1";
  const rows = await deps.listRows({ now, limit, claimOpenwaBacklog });
  const result: OfficialWhatsappRunResult = {
    processed: 0,
    sent: 0,
    requeued: 0,
    failed: 0,
    invalid: 0,
    skipped: 0,
  };

  for (const row of rows) {
    if (!isEligibleRow(row, now, claimOpenwaBacklog)) {
      result.skipped += 1;
      continue;
    }

    if (dryRun) {
      result.processed += 1;
      continue;
    }

    const claim = await deps.claimRow({ row, now, claimOpenwaBacklog });
    if (!claim) {
      result.skipped += 1;
      continue;
    }

    result.processed += 1;

    if (isStaleSendingRowEligible(row, now)) {
      await deps.markFailed({ rowId: row.id, error: "official_whatsapp_stale_sending_recovery" });
      result.invalid += 1;
      continue;
    }

    const sendResult = await deps.send({ row });
    if (sendResult.ok) {
      await deps.markSent({
        rowId: row.id,
        now,
        providerMessageId: sendResult.providerMessageId,
      });
      result.sent += 1;
      continue;
    }

    const retryAt = sendResult.retryable
      ? deps.computeRetryAt({
          attemptCount: claim.attemptCount,
          failedAt: now,
          triggerType: row.trigger_type,
        })
      : null;

    if (retryAt) {
      await deps.requeue({
        rowId: row.id,
        error: sendResult.error,
        nextAttemptAt: retryAt,
        providerMessageId: sendResult.providerMessageId,
      });
      result.requeued += 1;
      continue;
    }

    await deps.markFailed({
      rowId: row.id,
      error: sendResult.error,
      providerMessageId: sendResult.providerMessageId,
    });
    result.failed += 1;
  }

  return result;
}
