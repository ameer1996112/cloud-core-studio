import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendApnsAlert } from "@/lib/apns.server";
import { sendApnsDelivery } from "@/lib/messagingApnsAdapter.server";
import type {
  DeliveryFailureClass,
  DeliveryStatus,
  MessageChannel,
  MessageEventType,
  MessageLanguage,
} from "@/lib/messaging.types";
import { logMessagingEvent } from "@/lib/messagingLogging.server";
import {
  computeDeliveryRetry,
  isEssentialMessageEvent,
  resolveMessagingRuntime,
  runtimeAllowsRecipient,
  shouldCancelReminderForDomainState,
} from "@/lib/messagingPolicy";
import {
  sendResendEmail,
  sendWhatsappFreeform,
  sendWhatsappTemplate,
} from "@/lib/messagingProviders.server";
import { materializeMessagePlan } from "@/lib/unifiedMessagingMaterialization";
import { getIsraelNowParts, getPreviousIsraelEvening } from "@/lib/notificationDelivery";

type OutboxRow = {
  id: string;
  event_type: MessageEventType;
  aggregate_type: string;
  aggregate_id: string | null;
  member_id: string | null;
  payload: Record<string, unknown>;
  deduplication_key: string;
  expires_at: string | null;
  attempt_count: number;
};

type DeliveryRow = {
  id: string;
  snapshot_id: string | null;
  message_id: string;
  channel: MessageChannel;
  provider: string | null;
  recipient_address: string | null;
  status: DeliveryStatus;
  idempotency_key: string;
  provider_payload: Record<string, unknown>;
  expires_at: string | null;
  attempt_count: number;
};

async function enforceConciergeSendGate(delivery: DeliveryRow, now: Date) {
  if (!delivery.snapshot_id) return false;
  const db = supabaseAdmin as any;
  const allowlist = (process.env.CONCIERGE_TEST_RECIPIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const gate = await db.rpc("concierge_delivery_send_allowed", {
    p_delivery_id: delivery.id,
    p_live_runtime_enabled: process.env.CONCIERGE_LIVE_DELIVERY_ENABLED === "true",
    p_test_recipient_ids: allowlist,
  });
  if (gate.error) throw gate.error;
  const result = Array.isArray(gate.data) ? gate.data[0] : gate.data;
  if (result?.allowed === true) return false;
  const suppressed = await db
    .from("message_deliveries")
    .update({
      status: "suppressed",
      failure_class: "configuration",
      error_code: result?.reason ?? "concierge_send_gate_denied",
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", delivery.id)
    .eq("status", "sending");
  if (suppressed.error) throw suppressed.error;
  return true;
}

function language(value: string | null | undefined): MessageLanguage | null {
  return value === "he" || value === "ar" || value === "en" ? value : null;
}

function localizedDate(value: string, locale: MessageLanguage) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function localizedTime(value: string, locale: MessageLanguage) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function localizedAmount(amount: unknown, currency: unknown, locale: MessageLanguage) {
  const numeric = Number(amount ?? 0);
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar" : "en-IL", {
    style: "currency",
    currency: typeof currency === "string" ? currency : "ILS",
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function authenticatedReceiptUrl(receiptId: string) {
  const configured =
    process.env.MESSAGING_PUBLIC_BASE_URL?.trim() || process.env.HYP_PUBLIC_BASE_URL?.trim();
  if (!configured) throw new Error("missing_messaging_public_base_url");
  const base = new URL(configured);
  if (base.protocol !== "https:") throw new Error("messaging_public_base_url_must_use_https");
  return new URL(`/receipts/${encodeURIComponent(receiptId)}`, base).toString();
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function createAdminAlert(input: {
  idempotencyKey: string;
  subject: string;
  body: string;
  content: Record<string, unknown>;
}) {
  const db = supabaseAdmin as any;
  const message = await db
    .from("messages")
    .upsert(
      {
        direction: "outbound",
        audience: "admin",
        event_type: "delivery_failure",
        language: "en",
        template_key: "admin_delivery_alert_v2",
        template_version: "v2",
        subject: input.subject,
        body: input.body,
        content: input.content,
        member_visible: false,
        idempotency_key: input.idempotencyKey,
      },
      { onConflict: "idempotency_key" },
    )
    .select("id")
    .single();
  if (message.error) throw message.error;
  const delivery = await db.from("message_deliveries").upsert(
    {
      message_id: message.data.id,
      channel: "in_app",
      provider: "internal",
      recipient_address: "admin_group",
      status: "delivered",
      delivered_at: new Date().toISOString(),
      idempotency_key: `${input.idempotencyKey}:in_app`,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (delivery.error) throw delivery.error;
}

async function loadOutboxContext(outbox: OutboxRow) {
  if (!outbox.member_id) throw new Error("outbox_member_required");
  const db = supabaseAdmin as any;
  const memberResult = await db
    .from("members")
    .select("id,name,phone,email,preferred_language,status")
    .eq("id", outbox.member_id)
    .single();
  if (memberResult.error) throw memberResult.error;
  const member = memberResult.data;
  const locale = language(member.preferred_language);
  if (!locale) throw new Error(`unsupported_member_language:${member.preferred_language}`);
  const preferencesResult = await db
    .from("member_notification_preferences")
    .select("whatsapp_enabled,email_enabled")
    .eq("member_id", outbox.member_id)
    .maybeSingle();
  if (preferencesResult.error) throw preferencesResult.error;

  const payload = outbox.payload ?? {};
  const classId = typeof payload.class_id === "string" ? payload.class_id : null;
  const paymentId = typeof payload.payment_id === "string" ? payload.payment_id : null;
  const receiptId = typeof payload.receipt_id === "string" ? payload.receipt_id : null;
  const packageRequestId =
    typeof payload.package_request_id === "string" ? payload.package_request_id : null;
  const subscriptionId =
    typeof payload.subscription_id === "string" ? payload.subscription_id : null;
  const variables: Record<string, unknown> = { member_name: member.name };

  if (classId) {
    const classResult = await db
      .from("classes")
      .select("id,title,starts_at,instructor:instructors(name)")
      .eq("id", classId)
      .single();
    if (classResult.error) throw classResult.error;
    const studioClass = classResult.data;
    variables.class_name = studioClass.title;
    variables.class_date = localizedDate(studioClass.starts_at, locale);
    variables.class_time = localizedTime(studioClass.starts_at, locale);
    variables.instructor_name = relation(studioClass.instructor)?.name ?? "Cloud & Core";
  }

  if (payload.offer_expires_at) {
    variables.offer_expires_at = localizedTime(String(payload.offer_expires_at), locale);
  }

  if (paymentId) {
    const paymentResult = await db
      .from("payments")
      .select("id,amount,currency,plan:plans(name)")
      .eq("id", paymentId)
      .single();
    if (paymentResult.error) throw paymentResult.error;
    variables.package_name = relation(paymentResult.data.plan)?.name ?? "Cloud & Core";
    variables.amount = localizedAmount(
      paymentResult.data.amount,
      paymentResult.data.currency,
      locale,
    );
  } else if (packageRequestId) {
    const packageResult = await db
      .from("package_requests")
      .select("id,plan:plans(name)")
      .eq("id", packageRequestId)
      .single();
    if (packageResult.error) throw packageResult.error;
    variables.package_name = relation(packageResult.data.plan)?.name ?? "Cloud & Core";
  } else if (subscriptionId) {
    const subscriptionResult = await db
      .from("member_subscriptions")
      .select("id,amount,currency,plan:plans(name)")
      .eq("id", subscriptionId)
      .single();
    if (subscriptionResult.error) throw subscriptionResult.error;
    variables.package_name = relation(subscriptionResult.data.plan)?.name ?? "Cloud & Core";
    variables.amount = localizedAmount(
      subscriptionResult.data.amount,
      subscriptionResult.data.currency,
      locale,
    );
  }

  if (receiptId) {
    const receiptResult = await db
      .from("receipts")
      .select("id,receipt_number,amount,currency")
      .eq("id", receiptId)
      .single();
    if (receiptResult.error) throw receiptResult.error;
    variables.receipt_number = receiptResult.data.receipt_number;
    variables.amount = localizedAmount(
      receiptResult.data.amount,
      receiptResult.data.currency,
      locale,
    );
    variables.receipt_url = authenticatedReceiptUrl(receiptResult.data.id);
  }

  if (outbox.event_type === "payment_pending_reminder" && !variables.package_name) {
    variables.package_name = "Cloud & Core";
  }

  const deployments = await db
    .from("whatsapp_template_deployments")
    .select("template_name,language,approval_status")
    .eq("waba_id", process.env.META_WABA_ID?.trim() ?? "")
    .eq("approval_status", "APPROVED");
  if (deployments.error) throw deployments.error;
  const approvedWhatsappVariants = new Set<string>(
    (deployments.data ?? []).map(
      (deployment: { template_name: string; language: string }) =>
        `${deployment.template_name}:${deployment.language}`,
    ),
  );
  return {
    locale,
    member,
    preferences: {
      whatsappEnabled: preferencesResult.data?.whatsapp_enabled === true,
      emailEnabled: preferencesResult.data?.email_enabled === true,
    },
    variables,
    approvedWhatsappVariants,
  };
}

async function materializeOutbox(outbox: OutboxRow, now: Date) {
  const db = supabaseAdmin as any;
  try {
    const context = await loadOutboxContext(outbox);
    const plan = materializeMessagePlan({
      outboxId: outbox.id,
      deduplicationKey: outbox.deduplication_key,
      eventType: outbox.event_type,
      memberId: outbox.member_id!,
      language: context.locale,
      variables: context.variables,
      recipients: { whatsapp: context.member.phone, email: context.member.email },
      preferences: context.preferences,
      approvedWhatsappVariants: context.approvedWhatsappVariants,
      now,
      expiresAt: outbox.expires_at ? new Date(outbox.expires_at) : null,
    });
    const message = await db
      .from("messages")
      .upsert(
        {
          outbox_id: plan.message.outboxId,
          member_id: plan.message.memberId,
          direction: "outbound",
          audience: plan.message.audience,
          event_type: plan.message.eventType,
          language: plan.message.language,
          template_key: plan.message.templateKey,
          template_version: plan.message.templateVersion,
          subject: plan.message.subject,
          body: plan.message.body,
          content: {
            variables: context.variables,
            ...(typeof outbox.payload.receipt_id === "string"
              ? { action_url: `/receipts/${outbox.payload.receipt_id}` }
              : {}),
          },
          member_visible: plan.message.memberVisible,
          related_booking_id:
            typeof outbox.payload.booking_id === "string" ? outbox.payload.booking_id : null,
          related_class_id:
            typeof outbox.payload.class_id === "string" ? outbox.payload.class_id : null,
          related_payment_id:
            typeof outbox.payload.payment_id === "string" ? outbox.payload.payment_id : null,
          related_receipt_id:
            typeof outbox.payload.receipt_id === "string" ? outbox.payload.receipt_id : null,
          related_package_request_id:
            typeof outbox.payload.package_request_id === "string"
              ? outbox.payload.package_request_id
              : null,
          idempotency_key: plan.message.idempotencyKey,
          updated_at: now.toISOString(),
        },
        { onConflict: "idempotency_key" },
      )
      .select("id")
      .single();
    if (message.error) throw message.error;

    const deliveryRows = plan.deliveries.map((delivery) => ({
      message_id: message.data.id,
      channel: delivery.channel,
      provider: delivery.provider,
      recipient_address: delivery.recipientAddress,
      status: delivery.status,
      idempotency_key: delivery.idempotencyKey,
      scheduled_for: delivery.scheduledFor,
      expires_at: delivery.expiresAt,
      failure_class: delivery.failureClass,
      error_code: delivery.errorCode,
      provider_payload: {
        template_name: delivery.templateName,
        template_language: delivery.templateLanguage,
        parameters: delivery.templateParameters,
      },
    }));
    const deliveries = await db
      .from("message_deliveries")
      .upsert(deliveryRows, { onConflict: "idempotency_key", ignoreDuplicates: true });
    if (deliveries.error) throw deliveries.error;

    for (const delivery of plan.deliveries) {
      if (delivery.failureClass === "configuration") {
        await createAdminAlert({
          idempotencyKey: `admin:message-config:${delivery.idempotencyKey}`,
          subject: "Messaging configuration needs attention",
          body: `A ${delivery.channel} delivery was suppressed because required configuration is unavailable.`,
          content: {
            outbox_id: outbox.id,
            channel: delivery.channel,
            error_code: delivery.errorCode,
          },
        });
      }
    }

    const processed = await db
      .from("message_outbox")
      .update({
        processed_at: now.toISOString(),
        claimed_at: null,
        claimed_by: null,
        last_error: null,
        updated_at: now.toISOString(),
      })
      .eq("id", outbox.id);
    if (processed.error) throw processed.error;
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "outbox_materialization_failed";
    const terminal = outbox.attempt_count >= 5;
    const update = await db
      .from("message_outbox")
      .update({
        claimed_at: null,
        claimed_by: null,
        last_error: message.slice(0, 500),
        processed_at: terminal ? now.toISOString() : null,
        available_at: terminal ? now.toISOString() : new Date(now.getTime() + 60_000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", outbox.id);
    if (update.error) throw update.error;
    if (terminal) {
      await createAdminAlert({
        idempotencyKey: `admin:outbox-dead:${outbox.id}`,
        subject: "Message event could not be materialized",
        body: "A transactional message event needs staff reconciliation.",
        content: { outbox_id: outbox.id, event_type: outbox.event_type },
      });
    }
    return { ok: false as const, error: message };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

async function activeHandoff(recipient: string | null) {
  if (!recipient) return false;
  const normalized = recipient.replace(/\D/g, "");
  const result = await (supabaseAdmin as any)
    .from("message_conversations")
    .select("id")
    .eq("provider", "whatsapp")
    .eq("external_contact_id", normalized)
    .neq("status", "resolved")
    .limit(1);
  if (result.error) throw result.error;
  return Boolean(result.data?.length);
}

async function cancelInvalidReminderDelivery(delivery: DeliveryRow, message: any, now: Date) {
  if (!["class_reminder_planning", "class_reminder_final"].includes(message.event_type)) {
    return false;
  }
  const db = supabaseAdmin as any;
  if (!message.related_booking_id) {
    throw new Error("reminder_booking_context_missing");
  }
  const booking = await db
    .from("bookings")
    .select("status,class:classes(status)")
    .eq("id", message.related_booking_id)
    .maybeSingle();
  if (booking.error) throw booking.error;
  const studioClass = relation(booking.data?.class);
  if (
    !shouldCancelReminderForDomainState(
      message.event_type,
      booking.data?.status,
      studioClass?.status,
    )
  ) {
    return false;
  }
  const cancelled = await db
    .from("message_deliveries")
    .update({
      status: "cancelled",
      error_code: "booking_or_class_cancelled",
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", delivery.id)
    .eq("status", "sending");
  if (cancelled.error) throw cancelled.error;
  return true;
}

class WhatsappPersistenceUncertainError extends Error {
  constructor(
    readonly deliveryId: string,
    options: { cause?: unknown } = {},
  ) {
    super("whatsapp_provider_result_persistence_uncertain", options);
  }
}

async function markWhatsappDeliveryUnknown(delivery: DeliveryRow, reason: string) {
  const now = new Date().toISOString();
  const db = supabaseAdmin as any;
  const update = await db
    .from("message_deliveries")
    .update({
      status: "delivery_unknown",
      failure_class: "ambiguous",
      error_code: "provider_result_persistence_uncertain",
      error_message: reason.slice(0, 500),
      next_attempt_at: null,
      failed_at: now,
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now,
    })
    .eq("id", delivery.id);
  if (update.error) throw update.error;
  await createAdminAlert({
    idempotencyKey: `admin:delivery:${delivery.id}:delivery_unknown`,
    subject: "WhatsApp outcome requires reconciliation",
    body: "A WhatsApp request may have reached Meta, but its result could not be stored safely.",
    content: { delivery_id: delivery.id, channel: "whatsapp", status: "delivery_unknown" },
  });
}

async function alertRecoveredStaleWhatsappDeliveries() {
  const db = supabaseAdmin as any;
  const stale = await db
    .from("message_deliveries")
    .select("id")
    .eq("channel", "whatsapp")
    .eq("status", "delivery_unknown")
    .eq("error_code", "stale_worker_recovered")
    .limit(200);
  if (stale.error) throw stale.error;
  for (const delivery of stale.data ?? []) {
    await createAdminAlert({
      idempotencyKey: `admin:delivery:${delivery.id}:delivery_unknown`,
      subject: "WhatsApp outcome requires reconciliation",
      body: "A WhatsApp worker lease expired after a possible transmission. Do not retry blindly.",
      content: { delivery_id: delivery.id, channel: "whatsapp", status: "delivery_unknown" },
    });
  }
}

async function sendPush(delivery: DeliveryRow, message: any) {
  const db = supabaseAdmin as any;
  let memberIds: string[] = [];
  if (delivery.recipient_address === "admin_group") {
    const admins = await db.from("profiles").select("id").eq("role", "admin");
    if (admins.error) throw admins.error;
    memberIds = (admins.data ?? []).map((admin: { id: string }) => admin.id);
  } else if (delivery.recipient_address) {
    memberIds = [delivery.recipient_address];
  }
  const tokens = memberIds.length
    ? await db
        .from("member_push_tokens")
        .select("id,token")
        .in("member_id", memberIds)
        .eq("active", true)
    : { data: [], error: null };
  if (tokens.error) throw tokens.error;
  return sendApnsDelivery(
    (tokens.data ?? []) as Array<{ id: string; token: string }>,
    {
      title: message.subject ?? "Cloud & Core",
      body: message.body ?? "",
      notificationId: message.id,
      url: message.content?.action_url,
    },
    {
      send: sendApnsAlert,
      deactivate: async (tokenId) => {
        const deactivated = await db
          .from("member_push_tokens")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", tokenId);
        if (deactivated.error) throw deactivated.error;
      },
    },
  );
}

async function recordDeliveryResult(
  delivery: DeliveryRow,
  result:
    | { ok: true; providerMessageId: string | null; status: "accepted" | "sent" }
    | {
        ok: false;
        failureClass: DeliveryFailureClass;
        error: string;
        httpStatus?: number;
        retryAfterSeconds?: number | null;
      },
  startedAt: Date,
) {
  const db = supabaseAdmin as any;
  const now = new Date();
  let status: DeliveryStatus;
  let nextAttemptAt: Date | null = null;
  if (result.ok) {
    status = result.status;
  } else if (result.failureClass === "ambiguous") {
    status = "delivery_unknown";
  } else if (result.failureClass === "transient") {
    nextAttemptAt = computeDeliveryRetry(
      delivery.channel,
      delivery.attempt_count,
      now,
      result.retryAfterSeconds,
    );
    if (delivery.expires_at && nextAttemptAt && nextAttemptAt >= new Date(delivery.expires_at)) {
      nextAttemptAt = null;
      status = "expired";
    } else {
      status = nextAttemptAt ? "failed" : "dead_letter";
    }
  } else if (result.failureClass === "configuration" && result.error === "no_active_push_token") {
    status = "suppressed";
  } else {
    status = "dead_letter";
  }
  const attempt = await db.from("message_delivery_attempts").upsert(
    {
      delivery_id: delivery.id,
      attempt_number: delivery.attempt_count,
      provider: delivery.provider,
      started_at: startedAt.toISOString(),
      finished_at: now.toISOString(),
      outcome: result.ok ? result.status : status,
      provider_http_status: result.ok ? null : (result.httpStatus ?? null),
      failure_class: result.ok ? null : result.failureClass,
      retry_after_seconds: result.ok ? null : (result.retryAfterSeconds ?? null),
      next_attempt_at: nextAttemptAt?.toISOString() ?? null,
      request_metadata: { channel: delivery.channel },
      response_metadata: {},
    },
    { onConflict: "delivery_id,attempt_number" },
  );
  if (attempt.error) throw attempt.error;
  const update: Record<string, unknown> = {
    status,
    provider_status: status,
    provider_message_id: result.ok ? result.providerMessageId : null,
    next_attempt_at: nextAttemptAt?.toISOString() ?? null,
    lease_owner: null,
    lease_expires_at: null,
    failure_class: result.ok ? null : result.failureClass,
    error_message: result.ok ? null : result.error.slice(0, 500),
    accepted_at: result.ok && result.status === "accepted" ? now.toISOString() : null,
    sent_at: result.ok && result.status === "sent" ? now.toISOString() : null,
    failed_at: result.ok ? null : now.toISOString(),
    updated_at: now.toISOString(),
  };
  const updated = await db.from("message_deliveries").update(update).eq("id", delivery.id);
  if (updated.error) throw updated.error;
  if (status === "dead_letter" || status === "delivery_unknown") {
    await createAdminAlert({
      idempotencyKey: `admin:delivery:${delivery.id}:${status}`,
      subject:
        status === "delivery_unknown"
          ? "WhatsApp outcome requires reconciliation"
          : "Message delivery failed",
      body:
        status === "delivery_unknown"
          ? "A WhatsApp request may have been transmitted. Do not retry until staff checks Meta."
          : "A transactional delivery exhausted its safe retry policy.",
      content: { delivery_id: delivery.id, channel: delivery.channel, status },
    });
  }
  logMessagingEvent("delivery_attempt", {
    correlationId: delivery.message_id,
    messageId: delivery.message_id,
    deliveryId: delivery.id,
    provider: delivery.provider,
    channel: delivery.channel,
    outcome: status,
    durationMs: now.getTime() - startedAt.getTime(),
    retryClassification: result.ok ? null : result.failureClass,
    attemptNumber: delivery.attempt_count,
  });
  return status;
}

async function processDelivery(
  delivery: DeliveryRow,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  const db = supabaseAdmin as any;
  const messageResult = await db
    .from("messages")
    .select("*")
    .eq("id", delivery.message_id)
    .single();
  if (messageResult.error) throw messageResult.error;
  const message = messageResult.data;
  const startedAt = new Date();
  if (await enforceConciergeSendGate(delivery, startedAt)) return "suppressed";
  if (delivery.expires_at && new Date(delivery.expires_at) <= startedAt) {
    const expired = await db
      .from("message_deliveries")
      .update({
        status: "expired",
        lease_owner: null,
        lease_expires_at: null,
        updated_at: startedAt.toISOString(),
      })
      .eq("id", delivery.id);
    if (expired.error) throw expired.error;
    return "expired";
  }
  if (await cancelInvalidReminderDelivery(delivery, message, startedAt)) return "cancelled";
  if (delivery.channel === "in_app") {
    const delivered = await db
      .from("message_deliveries")
      .update({
        status: "delivered",
        delivered_at: startedAt.toISOString(),
        lease_owner: null,
        lease_expires_at: null,
        updated_at: startedAt.toISOString(),
      })
      .eq("id", delivery.id);
    if (delivered.error) throw delivered.error;
    return "delivered";
  }
  if (!runtimeAllowsRecipient(runtime, delivery.channel, delivery.recipient_address)) {
    const suppressed = await db
      .from("message_deliveries")
      .update({
        status: "suppressed",
        failure_class: "configuration",
        error_code: "recipient_not_allowlisted",
        lease_owner: null,
        lease_expires_at: null,
        updated_at: startedAt.toISOString(),
      })
      .eq("id", delivery.id);
    if (suppressed.error) throw suppressed.error;
    return "suppressed";
  }
  if (
    delivery.channel === "whatsapp" &&
    !isEssentialMessageEvent(message.event_type as MessageEventType) &&
    message.event_type !== "human_handoff" &&
    (await activeHandoff(delivery.recipient_address))
  ) {
    const paused = await db
      .from("message_deliveries")
      .update({
        status: "suppressed",
        error_code: "active_handoff",
        lease_owner: null,
        lease_expires_at: null,
        updated_at: startedAt.toISOString(),
      })
      .eq("id", delivery.id);
    if (paused.error) throw paused.error;
    return "suppressed";
  }

  let result;
  if (delivery.channel === "whatsapp") {
    result =
      delivery.provider_payload.kind === "freeform"
        ? await sendWhatsappFreeform({
            to: delivery.recipient_address ?? "",
            text: String(delivery.provider_payload.text ?? ""),
          })
        : await sendWhatsappTemplate({
            to: delivery.recipient_address ?? "",
            templateName: String(delivery.provider_payload.template_name ?? ""),
            languageCode: delivery.provider_payload.template_language as "he" | "ar" | "en_US",
            parameters: Array.isArray(delivery.provider_payload.parameters)
              ? delivery.provider_payload.parameters.map(String)
              : [],
          });
  } else if (delivery.channel === "email") {
    result = await sendResendEmail({
      to: delivery.recipient_address ?? "",
      subject: message.subject ?? "Cloud & Core",
      html: `<div dir="auto">${escapeHtml(message.body ?? "")}</div>`,
      idempotencyKey: delivery.idempotency_key,
    });
  } else {
    result = await sendPush(delivery, message);
  }
  let recordedStatus: DeliveryStatus;
  try {
    recordedStatus = await recordDeliveryResult(delivery, result, startedAt);
  } catch (error) {
    if (
      delivery.channel === "whatsapp" &&
      (result.ok || (!result.ok && result.failureClass === "ambiguous"))
    ) {
      throw new WhatsappPersistenceUncertainError(delivery.id, { cause: error });
    }
    throw error;
  }
  if (result.ok && result.providerMessageId) {
    try {
      const { reconcilePendingProviderWebhookEvents } = await import("@/lib/messageStatus.server");
      await reconcilePendingProviderWebhookEvents(
        delivery.provider ?? "",
        result.providerMessageId,
      );
    } catch {
      // The verified webhook ledger remains pending and can be reconciled by a later sweep.
    }
  }
  return recordedStatus;
}

function finalReminderAt(startsAt: Date) {
  const { hour, minute } = getIsraelNowParts(startsAt);
  return hour * 60 + minute < 10 * 60 + 30
    ? getPreviousIsraelEvening(startsAt)
    : new Date(startsAt.getTime() - 2 * 60 * 60_000);
}

async function enqueueDueCanonicalEvents(now: Date, limit: number) {
  const db = supabaseAdmin as any;
  const horizon = new Date(now.getTime() + 72 * 60 * 60_000).toISOString();
  const bookings = await db
    .from("bookings")
    .select(
      "id,member_id,class_id,class:classes!inner(id,starts_at,cancellation_window_hours,status)",
    )
    .eq("status", "booked")
    .gte("class.starts_at", now.toISOString())
    .lte("class.starts_at", horizon)
    .limit(Math.max(limit * 20, 500));
  if (bookings.error) throw bookings.error;
  let reminders = 0;
  for (const booking of bookings.data ?? []) {
    const studioClass = relation(booking.class);
    if (!studioClass || studioClass.status !== "scheduled") continue;
    const startsAt = new Date(studioClass.starts_at);
    const cancellationDeadline = new Date(
      startsAt.getTime() - Number(studioClass.cancellation_window_hours ?? 0) * 60 * 60_000,
    );
    const planningAt = new Date(cancellationDeadline.getTime() - 2 * 60 * 60_000);
    const events: Array<[MessageEventType, boolean]> = [
      [
        "class_reminder_planning",
        Number(studioClass.cancellation_window_hours ?? 0) > 0 &&
          planningAt <= now &&
          now < cancellationDeadline,
      ],
      ["class_reminder_final", finalReminderAt(startsAt) <= now],
    ];
    for (const [eventType, due] of events) {
      if (!due) continue;
      const result = await db.from("message_outbox").upsert(
        {
          event_type: eventType,
          aggregate_type: "booking",
          aggregate_id: booking.id,
          member_id: booking.member_id,
          payload: { booking_id: booking.id, class_id: booking.class_id },
          deduplication_key: `booking:${booking.id}:${eventType}`,
          available_at: now.toISOString(),
          expires_at: startsAt.toISOString(),
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
      reminders += 1;
    }
  }

  const pendingBefore = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const pendingPayments = await db
    .from("payments")
    .select("id,member_id")
    .eq("status", "pending")
    .lte("created_at", pendingBefore)
    .limit(limit);
  if (pendingPayments.error) throw pendingPayments.error;
  for (const payment of pendingPayments.data ?? []) {
    const result = await db.from("message_outbox").upsert(
      {
        event_type: "payment_pending_reminder",
        aggregate_type: "payment",
        aggregate_id: payment.id,
        member_id: payment.member_id,
        payload: { payment_id: payment.id },
        deduplication_key: `payment:${payment.id}:payment_pending_reminder`,
        available_at: now.toISOString(),
      },
      { onConflict: "deduplication_key", ignoreDuplicates: true },
    );
    if (result.error) throw result.error;
  }
  return { reminders, paymentReminders: pendingPayments.data?.length ?? 0 };
}

export function normalizeUnifiedMessagingSweepLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(200, Math.trunc(parsed))) : 50;
}

export async function runUnifiedMessagingSweep(input?: {
  limit?: number;
  now?: Date;
  workerId?: string;
}) {
  const db = supabaseAdmin as any;
  const now = input?.now ?? new Date();
  const limit = normalizeUnifiedMessagingSweepLimit(input?.limit);
  const workerId = input?.workerId ?? `messaging:${randomUUID()}`;
  const runtime = resolveMessagingRuntime(process.env);
  const scheduled = await enqueueDueCanonicalEvents(now, limit);
  const outboxClaim = await db.rpc("claim_message_outbox", {
    p_worker: workerId,
    p_limit: limit,
    p_lease_seconds: 120,
  });
  if (outboxClaim.error) throw outboxClaim.error;
  const materialized = { succeeded: 0, failed: 0 };
  for (const outbox of (outboxClaim.data ?? []) as OutboxRow[]) {
    const result = await materializeOutbox(outbox, now);
    if (result.ok) materialized.succeeded += 1;
    else materialized.failed += 1;
  }
  const { reconcilePendingProviderWebhookLedger } = await import("@/lib/messageStatus.server");
  const webhookReconciliation = await reconcilePendingProviderWebhookLedger(limit);

  const channels: MessageChannel[] = ["in_app"];
  if (runtime.mode !== "disabled") {
    if (runtime.channels.push) channels.push("push");
    if (runtime.channels.email) channels.push("email");
    if (runtime.channels.whatsapp) channels.push("whatsapp");
  }
  const deliveryClaim = await db.rpc("claim_message_deliveries", {
    p_worker: workerId,
    p_limit: limit,
    p_lease_seconds: 120,
    p_channels: channels,
  });
  if (deliveryClaim.error) throw deliveryClaim.error;
  await alertRecoveredStaleWhatsappDeliveries();
  const delivered: Record<string, number> = {};
  for (const delivery of (deliveryClaim.data ?? []) as DeliveryRow[]) {
    try {
      const status = await processDelivery(delivery, runtime);
      delivered[status] = (delivered[status] ?? 0) + 1;
    } catch (error) {
      if (error instanceof WhatsappPersistenceUncertainError) {
        try {
          await markWhatsappDeliveryUnknown(delivery, error.message);
        } catch {
          // Keep the row in sending. Lease recovery will turn WhatsApp into
          // delivery_unknown without risking another transmission.
        }
        delivered.delivery_unknown = (delivered.delivery_unknown ?? 0) + 1;
        continue;
      }
      const message = error instanceof Error ? error.message : "delivery_worker_error";
      await recordDeliveryResult(
        delivery,
        { ok: false, failureClass: "transient", error: message },
        now,
      );
      delivered.failed = (delivered.failed ?? 0) + 1;
    }
  }
  return {
    workerId,
    mode: runtime.mode,
    scheduled,
    outboxClaimed: outboxClaim.data?.length ?? 0,
    materialized,
    webhookReconciliation,
    deliveriesClaimed: deliveryClaim.data?.length ?? 0,
    deliveryOutcomes: delivered,
  };
}

export async function retryCanonicalDelivery(deliveryId: string, now = new Date()) {
  const db = supabaseAdmin as any;
  const delivery = await db
    .from("message_deliveries")
    .select("id,status,expires_at")
    .eq("id", deliveryId)
    .single();
  if (delivery.error) throw delivery.error;
  if (delivery.data.status === "delivery_unknown")
    throw new Error("ambiguous_delivery_requires_reconciliation");
  if (delivery.data.expires_at && new Date(delivery.data.expires_at) <= now) {
    throw new Error("delivery_expired");
  }
  if (!["failed", "dead_letter", "suppressed"].includes(delivery.data.status)) {
    throw new Error("delivery_not_retryable");
  }
  const result = await db
    .from("message_deliveries")
    .update({
      status: "queued",
      failure_class: null,
      error_code: null,
      error_message: null,
      next_attempt_at: now.toISOString(),
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", deliveryId);
  if (result.error) throw result.error;
  return { ok: true };
}
