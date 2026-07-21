import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { configuredApnsEnvironment, sendApnsAlert } from "@/lib/apns.server";
import { ApnsPersistenceUncertainError, sendApnsDelivery } from "@/lib/messagingApnsAdapter.server";
import {
  OPEN_CLASS_ALERT_MAX_LEAD_HOURS,
  OPEN_CLASS_ALERT_MIN_LEAD_HOURS,
  planOpenClassAlerts,
  shouldCancelOpenClassAlert,
} from "@/lib/openClassAlerts";
import type {
  DeliveryFailureClass,
  DeliveryStatus,
  ExternalChannelAvailability,
  ExternalMessageChannel,
  MessageChannel,
  MessageEventType,
  MessageLanguage,
} from "@/lib/messaging.types";
import { logMessagingEvent } from "@/lib/messagingLogging.server";
import {
  computeDeliveryRetry,
  isEssentialMessageEvent,
  resolveMessagingRuntime,
  runtimeAllowsRolloutRecipient,
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
import { notificationCategory, notificationDefinition } from "@/lib/premiumNotificationCatalog";
import {
  mapMemberNotificationPreferences,
  readMemberNotificationPreferences,
} from "@/lib/memberNotificationPreferences";

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

function notificationDeepLink(outbox: OutboxRow) {
  const payload = outbox.payload ?? {};
  if (typeof payload.receipt_id === "string") return `/receipts/${payload.receipt_id}`;
  if (typeof payload.class_id === "string") return `/member/schedule?class=${payload.class_id}`;
  if (outbox.event_type.startsWith("booking_")) return "/member/bookings";
  if (
    outbox.event_type.startsWith("payment_") ||
    outbox.event_type.startsWith("membership_") ||
    outbox.event_type.startsWith("subscription_") ||
    outbox.event_type.startsWith("credits_")
  ) {
    return "/member/packages";
  }
  if (outbox.event_type.startsWith("waitlist_")) return "/member/schedule";
  return "/member";
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
    .select("id,name,phone,email,preferred_language,status,remaining_credits")
    .eq("id", outbox.member_id)
    .single();
  if (memberResult.error) throw memberResult.error;
  const member = memberResult.data;
  const locale = language(member.preferred_language);
  if (!locale) throw new Error(`unsupported_member_language:${member.preferred_language}`);
  const preferencesResult = await readMemberNotificationPreferences(db, outbox.member_id);
  if (preferencesResult.error) throw preferencesResult.error;
  const mappedPreferences = mapMemberNotificationPreferences(preferencesResult.data);

  const payload = outbox.payload ?? {};
  const classId = typeof payload.class_id === "string" ? payload.class_id : null;
  const paymentId = typeof payload.payment_id === "string" ? payload.payment_id : null;
  const receiptId = typeof payload.receipt_id === "string" ? payload.receipt_id : null;
  const packageRequestId =
    typeof payload.package_request_id === "string" ? payload.package_request_id : null;
  const subscriptionId =
    typeof payload.subscription_id === "string" ? payload.subscription_id : null;
  const variables: Record<string, unknown> = { member_name: member.name };
  if (member.remaining_credits != null) {
    variables.credits_remaining = Math.max(0, Number(member.remaining_credits));
  }

  for (const key of ["location_name", "package_name"] as const) {
    if (typeof payload[key] === "string" && payload[key].trim()) variables[key] = payload[key];
  }
  if (payload.waitlist_position != null && Number.isFinite(Number(payload.waitlist_position))) {
    variables.waitlist_position = Math.max(1, Math.trunc(Number(payload.waitlist_position)));
  }
  for (const key of ["expiry_date", "renewal_date"] as const) {
    if (typeof payload[key] !== "string") continue;
    const parsed = new Date(payload[key]);
    if (!Number.isNaN(parsed.getTime()))
      variables[key] = localizedDate(parsed.toISOString(), locale);
  }

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
  if (outbox.event_type === "class_open_spots") {
    const spotsAvailable = Number(payload.spots_available);
    if (!Number.isFinite(spotsAvailable) || spotsAvailable < 1) {
      throw new Error("invalid_open_class_spots_available");
    }
    variables.spots_available = Math.trunc(spotsAvailable);
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
      whatsappEnabled: mappedPreferences.whatsappEnabled,
      emailEnabled: mappedPreferences.emailEnabled,
      scheduleUpdates: mappedPreferences.scheduleUpdates,
      classOperations: mappedPreferences.classOperationsEnabled,
      classReminders: mappedPreferences.classRemindersEnabled,
      scheduleOpenings: mappedPreferences.scheduleOpeningsEnabled,
      waitlist: mappedPreferences.waitlistEnabled,
      payments: mappedPreferences.paymentsEnabled,
      membership: mappedPreferences.membershipEnabled,
      staffReplies: mappedPreferences.staffRepliesEnabled,
      recommendations: mappedPreferences.recommendationsEnabled,
      marketing: mappedPreferences.marketing,
      sound: mappedPreferences.sound,
      timeSensitive: mappedPreferences.timeSensitiveEnabled,
    },
    variables,
    approvedWhatsappVariants,
  };
}

async function materializeOutbox(
  outbox: OutboxRow,
  now: Date,
  externalChannels: ExternalChannelAvailability,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  const db = supabaseAdmin as any;
  try {
    const definition = notificationDefinition(outbox.event_type);
    let enabledChannels: ReadonlySet<MessageChannel> | undefined;
    const rollout = await db
      .from("notification_event_rollouts")
      .select("enabled,copy_reviewed,allowlist_only,enabled_channels")
      .eq("event_type", outbox.event_type)
      .maybeSingle();
    if (rollout.error) throw rollout.error;
    let rolloutRecipientAllowed = true;
    if (runtime.mode === "allowlist" || rollout.data?.allowlist_only) {
      const member = await db
        .from("members")
        .select("phone,email")
        .eq("id", outbox.member_id)
        .maybeSingle();
      if (member.error) throw member.error;
      rolloutRecipientAllowed = runtimeAllowsRolloutRecipient(runtime, [
        outbox.member_id,
        member.data?.phone,
        member.data?.email,
      ]);
    }
    const allowed = rollout.data
      ? rollout.data.enabled === true &&
        rollout.data.copy_reviewed === true &&
        (!rollout.data.allowlist_only ||
          (runtime.mode === "allowlist" && rolloutRecipientAllowed)) &&
        (runtime.mode !== "allowlist" || rolloutRecipientAllowed)
      : definition.defaultEnabled && (runtime.mode !== "allowlist" || rolloutRecipientAllowed);
    if (!allowed) {
      const suppressed = await db
        .from("message_outbox")
        .update({
          processed_at: now.toISOString(),
          claimed_at: null,
          claimed_by: null,
          last_error: "premium_event_rollout_disabled",
          updated_at: now.toISOString(),
        })
        .eq("id", outbox.id);
      if (suppressed.error) throw suppressed.error;
      return { ok: true as const, suppressed: "premium_event_rollout_disabled" as const };
    }
    if (rollout.data) {
      const configuredChannels = Array.isArray(rollout.data.enabled_channels)
        ? rollout.data.enabled_channels
        : [];
      enabledChannels = new Set<MessageChannel>(
        configuredChannels.filter((channel: string): channel is MessageChannel =>
          ["in_app", "push", "email", "whatsapp"].includes(channel),
        ),
      );
    }
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
      externalChannels,
      approvedWhatsappVariants: context.approvedWhatsappVariants,
      enabledChannels,
      now,
      expiresAt: outbox.expires_at ? new Date(outbox.expires_at) : null,
    });
    if (
      definition.frequencyPolicy === "promotional" &&
      plan.deliveries.some((delivery) => delivery.status === "queued")
    ) {
      const reservation = await db.rpc("reserve_promotional_notification", {
        p_outbox_id: outbox.id,
        p_member_id: outbox.member_id,
        p_event_type: outbox.event_type,
        p_now: now.toISOString(),
      });
      if (reservation.error) throw reservation.error;
      if (reservation.data !== true) {
        const capped = await db
          .from("message_outbox")
          .update({
            processed_at: now.toISOString(),
            claimed_at: null,
            claimed_by: null,
            last_error: "promotional_frequency_cap",
            updated_at: now.toISOString(),
          })
          .eq("id", outbox.id);
        if (capped.error) throw capped.error;
        return { ok: true as const, suppressed: "promotional_frequency_cap" as const };
      }
    }
    const deepLink = notificationDeepLink(outbox);
    const threadKey = `${plan.message.notificationFamily}:${outbox.aggregate_id ?? outbox.member_id}`;
    const collapseKey = `${outbox.event_type}:${outbox.aggregate_id ?? outbox.member_id}`;
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
            action_url: deepLink,
          },
          notification_family: plan.message.notificationFamily,
          notification_tier: plan.message.notificationTier,
          preference_key: plan.message.preferenceKey,
          deep_link: deepLink,
          action_schema: plan.message.actions,
          thread_key: threadKey,
          collapse_key: collapseKey,
          interruption_level: plan.message.interruptionLevel,
          sound_key: plan.message.soundKey,
          badge_eligible: true,
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

async function cancelInvalidOpenClassDelivery(delivery: DeliveryRow, message: any, now: Date) {
  if (message.event_type !== "class_open_spots") return false;
  if (!message.related_class_id || !message.member_id) {
    throw new Error("open_class_alert_context_missing");
  }

  const db = supabaseAdmin as any;
  const [
    classResult,
    bookingResult,
    waitlistResult,
    memberResult,
    preferencesResult,
    tokensResult,
  ] = await Promise.all([
    db
      .from("classes")
      .select("status,capacity,booked_count")
      .eq("id", message.related_class_id)
      .maybeSingle(),
    db
      .from("bookings")
      .select("id")
      .eq("member_id", message.member_id)
      .eq("class_id", message.related_class_id)
      .in("status", ["booked", "checked_in"])
      .limit(1),
    db
      .from("waitlist_entries")
      .select("id")
      .eq("member_id", message.member_id)
      .eq("class_id", message.related_class_id)
      .in("status", ["waiting", "ready", "offered", "promoted"])
      .limit(1),
    db.from("members").select("status,remaining_credits").eq("id", message.member_id).maybeSingle(),
    db
      .from("member_notification_preferences")
      .select("schedule_updates,marketing,package_reminders")
      .eq("member_id", message.member_id)
      .maybeSingle(),
    db
      .from("member_push_tokens")
      .select("id")
      .eq("member_id", message.member_id)
      .eq("active", true)
      .eq("permission_status", "granted")
      .eq("apns_environment", configuredApnsEnvironment())
      .is("logged_out_at", null)
      .gt("stale_after", now.toISOString())
      .limit(1),
  ]);
  for (const result of [
    classResult,
    bookingResult,
    waitlistResult,
    memberResult,
    preferencesResult,
    tokensResult,
  ]) {
    if (result.error) throw result.error;
  }
  if (
    !shouldCancelOpenClassAlert({
      classStatus: classResult.data?.status,
      capacity: classResult.data?.capacity,
      bookedCount: classResult.data?.booked_count,
      memberBooked: Boolean(bookingResult.data?.length),
      memberWaitlisted: Boolean(waitlistResult.data?.length),
      memberStatus: memberResult.data?.status,
      remainingCredits: memberResult.data?.remaining_credits,
      scheduleUpdates: preferencesResult.data?.schedule_updates === true,
      zeroCreditUpsellConsent:
        preferencesResult.data?.marketing === true ||
        preferencesResult.data?.package_reminders === true,
      hasActivePushToken: Boolean(tokensResult.data?.length),
    })
  ) {
    return false;
  }

  const cancelled = await db
    .from("message_deliveries")
    .update({
      status: "cancelled",
      error_code: "open_class_alert_no_longer_eligible",
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

async function sendPush(
  delivery: DeliveryRow,
  message: any,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  const db = supabaseAdmin as any;
  const isAdminGroup = delivery.recipient_address === "admin_group";
  const nowIso = new Date().toISOString();
  const environment = configuredApnsEnvironment();
  const verifiedJoin = "notification_staff_test_devices!inner(id,revoked_at)";
  let tokens;
  if (isAdminGroup) {
    let query = db
      .from("admin_push_tokens")
      .select(
        runtime.mode === "allowlist"
          ? `id,token,user_id,profiles!inner(role),${verifiedJoin}`
          : "id,token,user_id,profiles!inner(role)",
      )
      .eq("active", true)
      .eq("platform", "ios")
      .eq("apns_environment", environment)
      .eq("profiles.role", "admin")
      .gt("last_seen_at", new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString());
    if (runtime.mode === "allowlist") {
      query = query.is("notification_staff_test_devices.revoked_at", null);
    }
    tokens = await query;
  } else if (delivery.recipient_address) {
    let query = db
      .from("member_push_tokens")
      .select(
        runtime.mode === "allowlist"
          ? `id,token,member_id,installation_id,${verifiedJoin}`
          : "id,token,member_id,installation_id",
      )
      .eq("member_id", delivery.recipient_address)
      .eq("active", true)
      .eq("permission_status", "granted")
      .eq("apns_environment", environment)
      .is("logged_out_at", null)
      .gt("stale_after", nowIso);
    if (runtime.mode === "allowlist") {
      query = query.is("notification_staff_test_devices.revoked_at", null);
    }
    tokens = await query;
  } else {
    tokens = { data: [], error: null };
  }
  if (tokens.error) throw tokens.error;
  const activeTokens = (tokens.data ?? []).map((token: any) => ({
    id: token.id as string,
    token: token.token as string,
    ownerId: (isAdminGroup ? token.user_id : token.member_id) as string,
  }));
  if (!activeTokens.length) {
    return sendApnsDelivery(
      [],
      { title: "", body: "" },
      {
        send: sendApnsAlert,
        deactivate: async () => {},
      },
    );
  }

  const tokenColumn = isAdminGroup ? "admin_push_token_id" : "push_token_id";
  const ownerColumn = isAdminGroup ? "admin_user_id" : "member_id";
  const seededTargets = await db.from("message_delivery_targets").upsert(
    activeTokens.map((token: any) => ({
      delivery_id: delivery.id,
      [tokenColumn]: token.id,
      [ownerColumn]: token.ownerId,
      status: "queued",
    })),
    { onConflict: `delivery_id,${tokenColumn}`, ignoreDuplicates: true },
  );
  if (seededTargets.error) throw seededTargets.error;
  const targets = await db
    .from("message_delivery_targets")
    .select(`${tokenColumn},status,provider_message_id`)
    .eq("delivery_id", delivery.id);
  if (targets.error) throw targets.error;
  const targetByToken = new Map<string, { status: string; provider_message_id: string | null }>(
    (targets.data ?? []).map((target: any) => [target[tokenColumn], target]),
  );
  const pendingTokens = activeTokens.filter(
    (token: any) =>
      !["sent", "device_received", "delivery_unknown"].includes(
        targetByToken.get(token.id)?.status ?? "queued",
      ),
  );
  if (!pendingTokens.length) {
    const providerMessageId = [...targetByToken.values()].find(
      (target) => target.provider_message_id,
    )?.provider_message_id;
    return {
      ok: true as const,
      providerMessageId: providerMessageId ?? null,
      status: "sent" as const,
    };
  }

  const sending = await db
    .from("message_delivery_targets")
    .update({
      status: "sending",
      attempt_count: delivery.attempt_count,
      last_attempt_at: nowIso,
      updated_at: nowIso,
    })
    .eq("delivery_id", delivery.id)
    .in(
      tokenColumn,
      pendingTokens.map((token: any) => token.id),
    );
  if (sending.error) throw sending.error;

  let badge: number | undefined;
  if (!isAdminGroup && delivery.recipient_address) {
    const unread = await db
      .from("message_deliveries")
      .select("id,messages!inner(member_id)", { count: "exact", head: true })
      .eq("channel", "in_app")
      .eq("messages.member_id", delivery.recipient_address)
      .is("read_at", null)
      .neq("status", "suppressed");
    if (!unread.error && typeof unread.count === "number") badge = Math.max(0, unread.count);
  }

  const category = notificationCategory(
    message.event_type as MessageEventType,
    Array.isArray(message.action_schema) ? message.action_schema : undefined,
  );
  try {
    return await sendApnsDelivery(
      pendingTokens,
      {
        title: message.subject ?? "Cloud & Core",
        body: message.body ?? "",
        notificationId: message.id,
        url: message.deep_link ?? message.content?.action_url,
        ...(badge == null ? {} : { badge }),
        sound:
          message.sound_key === "none"
            ? false
            : message.sound_key === "brand_important"
              ? "cloud_core_important.caf"
              : true,
        category,
        threadId: message.thread_key ?? undefined,
        interruptionLevel: message.interruption_level ?? "active",
        relevanceScore: message.notification_tier === "critical" ? 1 : 0.5,
        actions: Array.isArray(message.action_schema) ? message.action_schema : [],
        collapseId: message.collapse_key ?? undefined,
        expiresAt: delivery.expires_at ? new Date(delivery.expires_at) : undefined,
        ...(typeof message.content?.image_url === "string"
          ? { imageUrl: message.content.image_url, mutableContent: true }
          : {}),
      },
      {
        send: sendApnsAlert,
        deactivate: async (tokenId) => {
          const deactivated = await db
            .from(isAdminGroup ? "admin_push_tokens" : "member_push_tokens")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("id", tokenId);
          if (deactivated.error) throw deactivated.error;
        },
        report: async (outcome) => {
          const reportedAt = new Date().toISOString();
          const targetStatus =
            outcome.failureClass === "permanent" ? "dead_letter" : outcome.status;
          const updated = await db
            .from("message_delivery_targets")
            .update({
              status: targetStatus,
              provider_message_id: outcome.providerMessageId,
              failure_class: outcome.failureClass,
              error_code: outcome.errorCode,
              error_message: null,
              accepted_at: outcome.status === "sent" ? reportedAt : null,
              failed_at: outcome.status === "failed" ? reportedAt : null,
              updated_at: reportedAt,
            })
            .eq("delivery_id", delivery.id)
            .eq(tokenColumn, outcome.tokenId);
          if (updated.error) throw updated.error;
        },
      },
    );
  } catch (error) {
    if (!(error instanceof ApnsPersistenceUncertainError)) throw error;
    const uncertain = await db
      .from("message_delivery_targets")
      .update({
        status: "delivery_unknown",
        provider_message_id: error.providerMessageId,
        failure_class: "ambiguous",
        error_code: "provider_result_persistence_uncertain",
        next_attempt_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("delivery_id", delivery.id)
      .eq(tokenColumn, error.tokenId);
    if (uncertain.error) {
      console.warn("apns_target_persistence_uncertain", {
        deliveryId: delivery.id,
        errorCode: "target_status_update_failed",
      });
    }
    return {
      ok: false as const,
      failureClass: "ambiguous" as const,
      error: "apns_provider_result_persistence_uncertain",
    };
  }
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
    const ambiguousProvider = delivery.channel === "whatsapp" ? "WhatsApp" : "push provider";
    await createAdminAlert({
      idempotencyKey: `admin:delivery:${delivery.id}:${status}`,
      subject:
        status === "delivery_unknown"
          ? `${ambiguousProvider} outcome requires reconciliation`
          : "Message delivery failed",
      body:
        status === "delivery_unknown"
          ? `A ${ambiguousProvider} request may have been transmitted. Do not retry until staff reconciles the provider result.`
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
  if (await cancelInvalidOpenClassDelivery(delivery, message, startedAt)) return "cancelled";
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
    result = await sendPush(delivery, message, runtime);
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

async function enqueueOpenClassAlerts(
  now: Date,
  limit: number,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  if (runtime.mode === "disabled" || !runtime.channels.push) {
    return { scannedClasses: 0, eligibleMembers: 0, prepared: 0 };
  }

  const db = supabaseAdmin as any;
  const windowStart = new Date(
    now.getTime() + OPEN_CLASS_ALERT_MIN_LEAD_HOURS * 60 * 60_000,
  ).toISOString();
  const windowEnd = new Date(
    now.getTime() + OPEN_CLASS_ALERT_MAX_LEAD_HOURS * 60 * 60_000,
  ).toISOString();
  const classesResult = await db
    .from("classes")
    .select("id,starts_at,status,member_visible,capacity,booked_count")
    .eq("status", "scheduled")
    .eq("member_visible", true)
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .order("starts_at", { ascending: true })
    .limit(Math.max(25, limit * 4));
  if (classesResult.error) throw classesResult.error;
  if (!classesResult.data?.length) {
    return { scannedClasses: 0, eligibleMembers: 0, prepared: 0 };
  }

  let membersQuery = db
    .from("members")
    .select("id,status,remaining_credits")
    .eq("status", "active");
  if (runtime.mode === "allowlist") {
    const allowlistedMemberIds = [...runtime.recipientAllowlist].filter((value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
    );
    if (!allowlistedMemberIds.length) {
      return {
        scannedClasses: classesResult.data.length,
        eligibleMembers: 0,
        prepared: 0,
      };
    }
    membersQuery = membersQuery.in("id", allowlistedMemberIds);
  } else {
    membersQuery = membersQuery.limit(1_000);
  }
  const membersResult = await membersQuery;
  if (membersResult.error) throw membersResult.error;
  const allowedMembers = (membersResult.data ?? []).filter((member: { id: string }) =>
    runtimeAllowsRecipient(runtime, "push", member.id),
  );
  if (!allowedMembers.length) {
    return {
      scannedClasses: classesResult.data.length,
      eligibleMembers: 0,
      prepared: 0,
    };
  }

  const memberIds = allowedMembers.map((member: { id: string }) => member.id);
  const classIds = classesResult.data.map((studioClass: { id: string }) => studioClass.id);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [preferencesResult, tokensResult, bookingsResult, waitlistResult, alertsResult] =
    await Promise.all([
      db
        .from("member_notification_preferences")
        .select("member_id,schedule_updates,marketing,package_reminders")
        .in("member_id", memberIds),
      db
        .from("member_push_tokens")
        .select("member_id")
        .in("member_id", memberIds)
        .eq("active", true)
        .eq("permission_status", "granted"),
      db
        .from("bookings")
        .select("member_id,class_id")
        .in("member_id", memberIds)
        .in("class_id", classIds)
        .in("status", ["booked", "checked_in"]),
      db
        .from("waitlist_entries")
        .select("member_id,class_id")
        .in("member_id", memberIds)
        .in("class_id", classIds)
        .in("status", ["waiting", "ready", "offered", "promoted"]),
      db
        .from("message_outbox")
        .select("member_id,aggregate_id,created_at")
        .in("member_id", memberIds)
        .eq("event_type", "class_open_spots")
        .gte("created_at", sevenDaysAgo),
    ]);
  for (const result of [
    preferencesResult,
    tokensResult,
    bookingsResult,
    waitlistResult,
    alertsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const preferences = new Map<
    string,
    { scheduleUpdates: boolean; zeroCreditUpsellConsent: boolean }
  >(
    (preferencesResult.data ?? []).map(
      (row: {
        member_id: string;
        schedule_updates: boolean;
        marketing: boolean;
        package_reminders: boolean;
      }) => [
        row.member_id,
        {
          scheduleUpdates: row.schedule_updates === true,
          zeroCreditUpsellConsent: row.marketing === true || row.package_reminders === true,
        },
      ],
    ),
  );
  const pushMembers = new Set<string>(
    (tokensResult.data ?? []).map((row: { member_id: string }) => row.member_id),
  );
  const bookedByMember = new Map<string, Set<string>>();
  const waitlistedByMember = new Map<string, Set<string>>();
  const alertedByMember = new Map<string, Set<string>>();
  const alertsLast24Hours = new Map<string, number>();
  const alertsLast7Days = new Map<string, number>();
  const addClass = (target: Map<string, Set<string>>, memberId: string, classId: string) => {
    const values = target.get(memberId) ?? new Set<string>();
    values.add(classId);
    target.set(memberId, values);
  };
  for (const row of bookingsResult.data ?? []) {
    addClass(bookedByMember, row.member_id, row.class_id);
  }
  for (const row of waitlistResult.data ?? []) {
    addClass(waitlistedByMember, row.member_id, row.class_id);
  }
  const oneDayAgo = now.getTime() - 86_400_000;
  for (const row of alertsResult.data ?? []) {
    if (row.aggregate_id) addClass(alertedByMember, row.member_id, row.aggregate_id);
    alertsLast7Days.set(row.member_id, (alertsLast7Days.get(row.member_id) ?? 0) + 1);
    if (new Date(row.created_at).getTime() >= oneDayAgo) {
      alertsLast24Hours.set(row.member_id, (alertsLast24Hours.get(row.member_id) ?? 0) + 1);
    }
  }

  const plans = planOpenClassAlerts({
    now,
    limit,
    classes: classesResult.data.map(
      (studioClass: {
        id: string;
        starts_at: string;
        status: string;
        member_visible: boolean;
        capacity: number;
        booked_count: number;
      }) => ({
        id: studioClass.id,
        startsAt: studioClass.starts_at,
        status: studioClass.status,
        memberVisible: studioClass.member_visible,
        capacity: studioClass.capacity,
        bookedCount: studioClass.booked_count,
      }),
    ),
    members: allowedMembers.map(
      (member: { id: string; status: string; remaining_credits: number }) => ({
        id: member.id,
        status: member.status,
        remainingCredits: Number(member.remaining_credits ?? 0),
        scheduleUpdates: preferences.get(member.id)?.scheduleUpdates === true,
        zeroCreditUpsellConsent:
          Number(member.remaining_credits ?? 0) <= 0 &&
          preferences.get(member.id)?.zeroCreditUpsellConsent === true,
        hasActivePushToken: pushMembers.has(member.id),
        bookedClassIds: bookedByMember.get(member.id) ?? new Set<string>(),
        waitlistedClassIds: waitlistedByMember.get(member.id) ?? new Set<string>(),
        alertedClassIds: alertedByMember.get(member.id) ?? new Set<string>(),
        alertsLast24Hours: alertsLast24Hours.get(member.id) ?? 0,
        alertsLast7Days: alertsLast7Days.get(member.id) ?? 0,
      }),
    ),
  });

  let prepared = 0;
  for (const plan of plans) {
    const result = await db.rpc("enqueue_open_class_alert", {
      p_class_id: plan.classId,
      p_member_id: plan.memberId,
      p_spots_available: plan.spotsAvailable,
      p_starts_at: plan.startsAt,
    });
    if (result.error) throw result.error;
    if (result.data) prepared += 1;
  }

  return {
    scannedClasses: classesResult.data.length,
    eligibleMembers: allowedMembers.length,
    prepared,
  };
}

async function enqueueClassRecommendations(
  now: Date,
  limit: number,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  const db = supabaseAdmin as any;
  const classes = await db
    .from("classes")
    .select("id,starts_at")
    .eq("status", "scheduled")
    .eq("member_visible", true)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + 7 * 86_400_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(100);
  if (classes.error) throw classes.error;
  if (!classes.data?.length) return { eligibleMembers: 0, prepared: 0 };

  const preferences = await db
    .from("member_notification_preferences")
    .select("member_id")
    .eq("recommendations_enabled", true)
    .limit(5_000);
  if (preferences.error) throw preferences.error;
  const memberIds = (preferences.data ?? []).map((row: { member_id: string }) => row.member_id);
  if (!memberIds.length) return { eligibleMembers: 0, prepared: 0 };
  const members = await db
    .from("members")
    .select("id,phone,email")
    .in("id", memberIds)
    .eq("status", "active")
    .gt("remaining_credits", 0);
  if (members.error) throw members.error;
  const allowedMembers = (members.data ?? []).filter((member: any) =>
    runtime.mode === "allowlist"
      ? runtimeAllowsRolloutRecipient(runtime, [member.id, member.phone, member.email])
      : true,
  );
  if (!allowedMembers.length) return { eligibleMembers: 0, prepared: 0 };

  const allowedIds = allowedMembers.map((member: { id: string }) => member.id);
  const classIds = classes.data.map((studioClass: { id: string }) => studioClass.id);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [bookings, waitlist, recent] = await Promise.all([
    db
      .from("bookings")
      .select("member_id,class_id")
      .in("member_id", allowedIds)
      .in("class_id", classIds)
      .in("status", ["booked", "checked_in"]),
    db
      .from("waitlist_entries")
      .select("member_id,class_id")
      .in("member_id", allowedIds)
      .in("class_id", classIds)
      .in("status", ["waiting", "promoted"]),
    db
      .from("message_outbox")
      .select("member_id,aggregate_id,created_at,event_type")
      .in("member_id", allowedIds)
      .in("event_type", [
        "booking_no_show_followup",
        "class_published",
        "class_open_spots",
        "class_recommendation",
        "trial_followup",
        "retention_reminder",
      ])
      .gte("created_at", sevenDaysAgo),
  ]);
  for (const result of [bookings, waitlist, recent]) if (result.error) throw result.error;
  const blocked = new Set<string>(
    [...(bookings.data ?? []), ...(waitlist.data ?? [])].map(
      (row: { member_id: string; class_id: string }) => `${row.member_id}:${row.class_id}`,
    ),
  );
  const oneDayAgo = now.getTime() - 86_400_000;
  let prepared = 0;
  for (const member of allowedMembers) {
    const memberRecent = (recent.data ?? []).filter((row: any) => row.member_id === member.id);
    if (
      memberRecent.length >= 3 ||
      memberRecent.some((row: any) => new Date(row.created_at).getTime() >= oneDayAgo)
    ) {
      continue;
    }
    const studioClass = classes.data.find(
      (candidate: { id: string }) =>
        !blocked.has(`${member.id}:${candidate.id}`) &&
        !memberRecent.some(
          (row: any) =>
            row.event_type === "class_recommendation" && row.aggregate_id === candidate.id,
        ),
    );
    if (!studioClass) continue;
    const result = await db.from("message_outbox").upsert(
      {
        event_type: "class_recommendation",
        aggregate_type: "class",
        aggregate_id: studioClass.id,
        member_id: member.id,
        payload: { class_id: studioClass.id },
        deduplication_key: `class:${studioClass.id}:recommendation:member:${member.id}`,
        available_at: now.toISOString(),
        expires_at: studioClass.starts_at,
      },
      { onConflict: "deduplication_key", ignoreDuplicates: true },
    );
    if (result.error) throw result.error;
    prepared += 1;
    if (prepared >= limit) break;
  }
  return { eligibleMembers: allowedMembers.length, prepared };
}

async function enqueueDueCanonicalEvents(
  now: Date,
  limit: number,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
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
  const failedBefore = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const failedPayments = await db
    .from("payments")
    .select("id,member_id,subscription_id")
    .eq("status", "failed")
    .lte("updated_at", failedBefore)
    .limit(limit);
  if (failedPayments.error) throw failedPayments.error;
  for (const payment of failedPayments.data ?? []) {
    const result = await db.from("message_outbox").upsert(
      {
        event_type: "payment_failed",
        aggregate_type: "payment",
        aggregate_id: payment.id,
        member_id: payment.member_id,
        payload: { payment_id: payment.id, subscription_id: payment.subscription_id },
        deduplication_key: `payment:${payment.id}:payment_failed:followup_24h`,
        available_at: now.toISOString(),
      },
      { onConflict: "deduplication_key", ignoreDuplicates: true },
    );
    if (result.error) throw result.error;
  }
  const subscriptionFailureRollout = await db
    .from("notification_event_rollouts")
    .select("enabled,copy_reviewed")
    .eq("event_type", "subscription_renewal_failed")
    .maybeSingle();
  if (subscriptionFailureRollout.error) throw subscriptionFailureRollout.error;
  if (
    subscriptionFailureRollout.data?.enabled === true &&
    subscriptionFailureRollout.data?.copy_reviewed === true
  ) {
    const unresolvedSubscriptions = await db
      .from("member_subscriptions")
      .select("id,member_id,last_payment_id")
      .in("status", ["past_due", "incomplete"])
      .lte("updated_at", failedBefore)
      .limit(limit);
    if (unresolvedSubscriptions.error) throw unresolvedSubscriptions.error;
    for (const subscription of unresolvedSubscriptions.data ?? []) {
      const result = await db.from("message_outbox").upsert(
        {
          event_type: "subscription_renewal_failed",
          aggregate_type: "subscription",
          aggregate_id: subscription.id,
          member_id: subscription.member_id,
          payload: {
            subscription_id: subscription.id,
            payment_id: subscription.last_payment_id,
          },
          deduplication_key: `subscription:${subscription.id}:subscription_renewal_failed:followup_24h`,
          available_at: now.toISOString(),
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
    }
  }
  const dueRollouts = await db
    .from("notification_event_rollouts")
    .select("event_type")
    .eq("enabled", true)
    .eq("copy_reviewed", true)
    .in("event_type", [
      "membership_expiring",
      "subscription_renewal_upcoming",
      "trial_followup",
      "retention_reminder",
      "class_recommendation",
    ]);
  if (dueRollouts.error) throw dueRollouts.error;
  const enabledDueEvents = new Set(
    (dueRollouts.data ?? []).map((row: { event_type: MessageEventType }) => row.event_type),
  );

  let membershipReminders = 0;
  if (enabledDueEvents.has("membership_expiring")) {
    const expiringPlans = await db
      .from("member_plans")
      .select("id,member_id,plan_id,expires_at,plan:plans(name)")
      .eq("status", "active")
      .gt("expires_at", now.toISOString())
      .lte("expires_at", new Date(now.getTime() + 7 * 86_400_000).toISOString())
      .limit(limit);
    if (expiringPlans.error) throw expiringPlans.error;
    for (const memberPlan of expiringPlans.data ?? []) {
      const days = (new Date(memberPlan.expires_at).getTime() - now.getTime()) / 86_400_000;
      const milestone = days <= 2 ? "2d" : "7d";
      const result = await db.from("message_outbox").upsert(
        {
          event_type: "membership_expiring",
          aggregate_type: "member_plan",
          aggregate_id: memberPlan.id,
          member_id: memberPlan.member_id,
          payload: {
            member_plan_id: memberPlan.id,
            plan_id: memberPlan.plan_id,
            package_name: relation(memberPlan.plan)?.name ?? "Cloud & Core",
            expiry_date: memberPlan.expires_at,
          },
          deduplication_key: `member_plan:${memberPlan.id}:membership_expiring:${milestone}`,
          available_at: now.toISOString(),
          expires_at: memberPlan.expires_at,
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
      membershipReminders += 1;
    }
  }

  let renewalReminders = 0;
  if (enabledDueEvents.has("subscription_renewal_upcoming")) {
    const subscriptions = await db
      .from("member_subscriptions")
      .select("id,member_id,next_charge_at")
      .eq("status", "active")
      .gt("next_charge_at", now.toISOString())
      .lte("next_charge_at", new Date(now.getTime() + 7 * 86_400_000).toISOString())
      .limit(limit);
    if (subscriptions.error) throw subscriptions.error;
    for (const subscription of subscriptions.data ?? []) {
      const days = (new Date(subscription.next_charge_at).getTime() - now.getTime()) / 86_400_000;
      const milestone = days <= 1 ? "1d" : "7d";
      const result = await db.from("message_outbox").upsert(
        {
          event_type: "subscription_renewal_upcoming",
          aggregate_type: "member_subscription",
          aggregate_id: subscription.id,
          member_id: subscription.member_id,
          payload: { subscription_id: subscription.id, renewal_date: subscription.next_charge_at },
          deduplication_key: `subscription:${subscription.id}:renewal_upcoming:${milestone}`,
          available_at: now.toISOString(),
          expires_at: subscription.next_charge_at,
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
      renewalReminders += 1;
    }
  }

  let engagementReminders = 0;
  if (enabledDueEvents.has("trial_followup")) {
    const trialMembers = await db
      .from("members")
      .select("id,last_visit_at")
      .eq("status", "active")
      .eq("attendance_count", 1)
      .gte("last_visit_at", new Date(now.getTime() - 7 * 86_400_000).toISOString())
      .lte("last_visit_at", new Date(now.getTime() - 24 * 60 * 60_000).toISOString())
      .limit(limit);
    if (trialMembers.error) throw trialMembers.error;
    for (const member of trialMembers.data ?? []) {
      const result = await db.from("message_outbox").upsert(
        {
          event_type: "trial_followup",
          aggregate_type: "member",
          aggregate_id: member.id,
          member_id: member.id,
          payload: {},
          deduplication_key: `member:${member.id}:trial_followup:first_visit`,
          available_at: now.toISOString(),
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
      engagementReminders += 1;
    }
  }
  if (enabledDueEvents.has("retention_reminder")) {
    const inactiveMembers = await db
      .from("members")
      .select("id,last_visit_at")
      .eq("status", "active")
      .lt("last_visit_at", new Date(now.getTime() - 21 * 86_400_000).toISOString())
      .limit(limit);
    if (inactiveMembers.error) throw inactiveMembers.error;
    const cycle = now.toISOString().slice(0, 7);
    for (const member of inactiveMembers.data ?? []) {
      const result = await db.from("message_outbox").upsert(
        {
          event_type: "retention_reminder",
          aggregate_type: "member",
          aggregate_id: member.id,
          member_id: member.id,
          payload: {},
          deduplication_key: `member:${member.id}:retention_reminder:${cycle}`,
          available_at: now.toISOString(),
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
      engagementReminders += 1;
    }
  }
  const classRecommendations = enabledDueEvents.has("class_recommendation")
    ? await enqueueClassRecommendations(now, limit, runtime)
    : { eligibleMembers: 0, prepared: 0 };
  const openClassAlerts = await enqueueOpenClassAlerts(now, limit, runtime);
  return {
    reminders,
    paymentReminders: pendingPayments.data?.length ?? 0,
    paymentFailureFollowups: failedPayments.data?.length ?? 0,
    membershipReminders,
    renewalReminders,
    engagementReminders,
    classRecommendations,
    openClassAlerts,
  };
}

export function normalizeUnifiedMessagingSweepLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(200, Math.trunc(parsed))) : 50;
}

async function suppressDisabledExternalDeliveryBacklog(
  externalChannels: ExternalChannelAvailability,
) {
  const db = supabaseAdmin as any;
  let suppressed = 0;

  for (const channel of Object.keys(externalChannels) as ExternalMessageChannel[]) {
    if (externalChannels[channel]) continue;

    const candidates = await db
      .from("message_deliveries")
      .select("id,message_id")
      .eq("channel", channel)
      .in("status", ["queued", "failed"])
      .limit(1_000);
    if (candidates.error) throw candidates.error;
    if (!candidates.data?.length) continue;

    const messageIds = [
      ...new Set(candidates.data.map((row: { message_id: string }) => row.message_id)),
    ];
    const messages = await db
      .from("messages")
      .select("id")
      .in("id", messageIds)
      .eq("template_version", "v2");
    if (messages.error) throw messages.error;

    const v2MessageIds = new Set(
      (messages.data ?? []).map((message: { id: string }) => message.id),
    );
    const deliveryIds = candidates.data
      .filter((row: { message_id: string }) => v2MessageIds.has(row.message_id))
      .map((row: { id: string }) => row.id);
    if (!deliveryIds.length) continue;

    const updated = await db
      .from("message_deliveries")
      .update({
        status: "suppressed",
        provider_status: "suppressed",
        failure_class: "configuration",
        error_code: `${channel}_channel_disabled`,
        error_message: null,
        next_attempt_at: null,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", deliveryIds)
      .in("status", ["queued", "failed"])
      .select("id");
    if (updated.error) throw updated.error;
    suppressed += updated.data?.length ?? 0;
  }

  return suppressed;
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
  const externalChannels =
    runtime.mode === "disabled" ? { whatsapp: false, email: false, push: false } : runtime.channels;
  const disabledBacklogSuppressed = await suppressDisabledExternalDeliveryBacklog(externalChannels);
  const scheduled = await enqueueDueCanonicalEvents(now, limit, runtime);
  const outboxClaim = await db.rpc("claim_message_outbox", {
    p_worker: workerId,
    p_limit: limit,
    p_lease_seconds: 120,
  });
  if (outboxClaim.error) throw outboxClaim.error;
  const materialized = { succeeded: 0, failed: 0 };
  for (const outbox of (outboxClaim.data ?? []) as OutboxRow[]) {
    const result = await materializeOutbox(outbox, now, externalChannels, runtime);
    if (result.ok) materialized.succeeded += 1;
    else materialized.failed += 1;
  }
  const { reconcilePendingProviderWebhookLedger } = await import("@/lib/messageStatus.server");
  const webhookReconciliation = await reconcilePendingProviderWebhookLedger(limit);

  const enabledExternalChannels = (
    Object.keys(externalChannels) as ExternalMessageChannel[]
  ).filter((channel) => externalChannels[channel]);
  const channels: MessageChannel[] = ["in_app", ...enabledExternalChannels];
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
    disabledBacklogSuppressed,
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
