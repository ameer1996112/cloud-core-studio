import { randomUUID } from "node:crypto";
import { dispatchDuePromotions } from "@/lib/promotionBroadcast.server";
import { notificationDatabase } from "@/server/notifications/database-scope.server";
import {
  ADMIN_BOOKING_ALERT_EVENT,
  resolveAdminBookingAlertPolicy,
} from "@/lib/adminBookingAlerts";
import { configuredApnsEnvironment, sendApnsAlert } from "@/lib/apns.server";
import { ApnsPersistenceUncertainError, sendApnsDelivery } from "@/lib/messagingApnsAdapter.server";
import {
  OPEN_CLASS_ALERT_MAX_LEAD_HOURS,
  OPEN_CLASS_ALERT_MIN_LEAD_HOURS,
  planOpenClassAlerts,
  rankClassRecommendations,
  scoreOpenClassAffinity,
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
import { applyStaffTestVariables, isStaffTestMessageContent } from "@/lib/messagingStaffTest";
import {
  classifyOpenwaFailure,
  computeDeliveryRetry,
  deliveryAllowedByConsent,
  isEssentialMessageEvent,
  isUnopenedSuccessfulPushMessage,
  requiresPromotionalFrequencyReservation,
  resolveMessagingRuntime,
  runtimeAllowsRolloutRecipient,
  runtimeAllowsRecipient,
  shouldCancelPaymentReminderForDomainState,
  shouldCancelReminderForDomainState,
} from "@/lib/messagingPolicy";
import {
  closeExpiredOutboxRows,
  closeStaleDeliveryRows,
  closeStaleOutboxRows,
  type StaleOutboxDecision,
  type StaleOutboxRow,
} from "@/lib/messageOutboxMaintenance";
import {
  parseWhatsappTemplateComponents,
  sendResendEmail,
  sendWhatsappFreeform,
  sendWhatsappTemplate,
} from "@/lib/messagingProviders.server";
import {
  materializeMessagePlan,
  scheduledJourneyVariables,
} from "@/lib/unifiedMessagingMaterialization";
import { renderSelectedConciergeEmail } from "@/lib/conciergeEmail";
import { buildConciergeRecommendationSummary } from "@/lib/conciergeRecommendation";
import { conciergeJourneyForTemplate } from "@/lib/conciergeTemplateAdmin";
import { renderTransactionalEmail } from "@/lib/transactionalEmail";
import { getIsraelNowParts, getPreviousIsraelEvening } from "@/lib/notificationDelivery";
import { notificationCategory, notificationDefinition } from "@/lib/premiumNotificationCatalog";
import { buildPremiumPushPayload } from "@/lib/premiumPush";
import {
  dailyBriefingEligible,
  jerusalemDayKey,
  jerusalemWeekKey,
  nextDayKey,
} from "@/lib/conciergeScheduledJourneys";
import { studioDateTimeInputToIso } from "@/lib/studio-time";
import {
  mapMemberNotificationPreferences,
  readMemberNotificationPreferences,
} from "@/lib/memberNotificationPreferences";
import {
  isSupersededPendingPaymentReminder,
  selectDuePendingPaymentReminders,
} from "@/lib/paymentReminderCandidates";

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
  template_key: string;
  template_version: number;
  locale: MessageLanguage;
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
  lease_token?: string | null;
  created_at?: string;
  last_attempt_at?: string | null;
};

function currentDeliveryLease<T extends { eq(column: string, value: string): T }>(
  query: T,
  delivery: DeliveryRow,
) {
  return delivery.lease_token ? query.eq("lease_token", delivery.lease_token) : query;
}

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const pageSize = 500;
  const maxRows = 2_000;
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const result = await page(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const next = result.data ?? [];
    rows.push(...next);
    if (next.length < pageSize) return rows;
  }
  return rows;
}

async function enforceConciergeSendGate(delivery: DeliveryRow, now: Date) {
  if (!delivery.snapshot_id) return false;
  const db = notificationDatabase as any;
  const allowlist = (process.env.CONCIERGE_TEST_RECIPIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const gate = await db.rpc("concierge_delivery_send_allowed", {
    p_delivery_id: delivery.id,
    p_live_runtime_enabled: process.env.CONCIERGE_LIVE_DELIVERY_ENABLED === "true",
    p_test_recipient_ids: allowlist,
    p_runtime_whatsapp_waba_id: process.env.META_WABA_ID?.trim() || null,
  });
  if (gate.error) throw gate.error;
  const result = Array.isArray(gate.data) ? gate.data[0] : gate.data;
  if (result?.allowed === true) return false;
  const suppressed = await currentDeliveryLease(
    db
      .from("message_deliveries")
      .update({
        status: "suppressed",
        failure_class: "configuration",
        error_code: result?.reason ?? "concierge_send_gate_denied",
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "sending"),
    delivery,
  );
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

function notificationDeepLink(
  outbox: OutboxRow,
  primaryAction?: string,
  variables: Record<string, unknown> = {},
) {
  const payload = outbox.payload ?? {};
  if (outbox.event_type === "member_welcome") {
    if (primaryAction === "choose_package") return "/member/packages";
    if (primaryAction === "view_class" && typeof variables.upcoming_class_id === "string") {
      return `/member/schedule?class=${variables.upcoming_class_id}`;
    }
    return "/member/schedule";
  }
  if (typeof payload.receipt_id === "string") return `/receipts/${payload.receipt_id}`;
  if (typeof payload.class_id === "string") return `/member/schedule?class=${payload.class_id}`;
  if (outbox.event_type.startsWith("booking_")) return "/member/bookings";
  if (outbox.event_type.startsWith("class_")) return "/member/schedule";
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
  const db = notificationDatabase as any;
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
  const db = notificationDatabase as any;
  const memberResult = await db
    .from("members")
    .select("id,name,phone,email,preferred_language,status,remaining_credits")
    .eq("id", outbox.member_id)
    .single();
  if (memberResult.error) throw memberResult.error;
  const member = memberResult.data;
  const locale = language(outbox.locale);
  if (!locale) throw new Error("unsupported_outbox_locale");
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
  let adminBookingAlertPolicy: ReturnType<typeof resolveAdminBookingAlertPolicy> | null = null;
  if (member.remaining_credits != null) {
    variables.credits_remaining = Math.max(0, Number(member.remaining_credits));
  }
  Object.assign(variables, scheduledJourneyVariables(payload));
  for (const key of [
    "payment_was_failing",
    "whatsapp_growth_escalation",
    "has_upcoming_booking",
    "has_active_membership",
  ] as const) {
    if (typeof payload[key] === "boolean") variables[key] = payload[key];
  }
  if (typeof payload.retention_stage === "string") {
    variables.retention_stage = payload.retention_stage;
  }

  if (outbox.event_type === ADMIN_BOOKING_ALERT_EVENT) {
    if (!classId) throw new Error("admin_booking_alert_class_required");
    const settings = await db
      .from("studio_settings")
      .select("contact_email")
      .eq("id", 1)
      .maybeSingle();
    if (settings.error) throw settings.error;
    adminBookingAlertPolicy = resolveAdminBookingAlertPolicy({
      contactEmail: settings.data?.contact_email,
      classId,
    });
    variables.member_phone =
      typeof payload.member_phone === "string" && payload.member_phone.trim()
        ? payload.member_phone.trim()
        : member.phone?.trim() || "לא זמין";
    variables.first_booking_label = payload.first_booking === true ? "הרשמה ראשונה" : "לקוחה חוזרת";
    variables.has_active_push_device = true;
  } else {
    const pushDevice = await db
      .from("member_push_tokens")
      .select("id")
      .eq("member_id", outbox.member_id)
      .eq("active", true)
      .eq("permission_status", "granted")
      .is("logged_out_at", null)
      .gt("stale_after", new Date().toISOString())
      .limit(1);
    if (pushDevice.error) throw pushDevice.error;
    variables.has_active_push_device = Boolean(pushDevice.data?.length);
  }

  if (outbox.event_type === "member_welcome") {
    const nowIso = new Date().toISOString();
    const [upcomingBooking, activePlan, activeSubscription] = await Promise.all([
      db
        .from("bookings")
        .select("id,class_id,class:classes!inner(starts_at,status)")
        .eq("member_id", outbox.member_id)
        .eq("status", "booked")
        .eq("class.status", "scheduled")
        .gte("class.starts_at", nowIso)
        .limit(1),
      db
        .from("member_plans")
        .select("id")
        .eq("member_id", outbox.member_id)
        .eq("status", "active")
        .limit(1),
      db
        .from("member_subscriptions")
        .select("id")
        .eq("member_id", outbox.member_id)
        .eq("status", "active")
        .limit(1),
    ]);
    for (const result of [upcomingBooking, activePlan, activeSubscription]) {
      if (result.error) throw result.error;
    }
    const upcoming = upcomingBooking.data?.[0];
    variables.has_upcoming_booking = Boolean(upcoming);
    if (upcoming?.class_id) variables.upcoming_class_id = upcoming.class_id;
    variables.has_active_membership =
      Number(member.remaining_credits ?? 0) > 0 ||
      Boolean(activePlan.data?.length) ||
      Boolean(activeSubscription.data?.length);
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

    if (outbox.event_type === "class_recommendation") {
      const recommendationClasses = [studioClass];
      if (typeof payload.secondary_class_id === "string" && payload.secondary_class_id) {
        const secondaryResult = await db
          .from("classes")
          .select("id,title,starts_at")
          .eq("id", payload.secondary_class_id)
          .maybeSingle();
        if (secondaryResult.error) throw secondaryResult.error;
        if (secondaryResult.data) recommendationClasses.push(secondaryResult.data);
      }
      const localizedItems = recommendationClasses.map((candidate) => {
        const date = localizedDate(candidate.starts_at, locale);
        const time = localizedTime(candidate.starts_at, locale);
        if (locale === "he") return `${candidate.title} ב-${date} בשעה ${time}`;
        if (locale === "ar") return `${candidate.title} بتاريخ ${date} الساعة ${time}`;
        return `${candidate.title} on ${date} at ${time}`;
      });
      variables.recommendation_summary = localizedItems.join(
        locale === "he" ? " או " : locale === "ar" ? " أو " : " or ",
      );
    }
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

  Object.assign(variables, applyStaffTestVariables(variables, payload));

  if (outbox.event_type === "payment_pending_reminder" && !variables.package_name) {
    variables.package_name = "Cloud & Core";
  }
  if (outbox.event_type === "class_open_spots") {
    const spotsAvailable = Number(variables.spots_available ?? payload.spots_available);
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
      pushEnabled: mappedPreferences.pushEnabled,
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
    adminBookingAlertPolicy,
  };
}

async function materializeOutbox(
  outbox: OutboxRow,
  now: Date,
  externalChannels: ExternalChannelAvailability,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  const db = notificationDatabase as any;
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
    if (outbox.payload.staff_test === true && Array.isArray(outbox.payload.test_channels)) {
      const supported = new Set<MessageChannel>(definition.channels);
      enabledChannels = new Set<MessageChannel>(
        outbox.payload.test_channels.filter(
          (channel: unknown): channel is MessageChannel =>
            typeof channel === "string" &&
            ["in_app", "push", "email", "whatsapp"].includes(channel) &&
            supported.has(channel as MessageChannel),
        ),
      );
      if (!enabledChannels.size) throw new Error("staff_test_channel_required");
    }
    const context = await loadOutboxContext(outbox);
    const plan = materializeMessagePlan({
      outboxId: outbox.id,
      deduplicationKey: outbox.deduplication_key,
      eventType: outbox.event_type,
      templateKey: outbox.template_key,
      templateVersion: outbox.template_version,
      memberId: outbox.member_id!,
      language: context.adminBookingAlertPolicy?.language ?? context.locale,
      variables: context.variables,
      recipients: {
        whatsapp: context.member.phone,
        email: context.adminBookingAlertPolicy?.email ?? context.member.email,
      },
      preferences: context.preferences,
      externalChannels,
      approvedWhatsappVariants: context.approvedWhatsappVariants,
      enabledChannels,
      now,
      expiresAt: outbox.expires_at ? new Date(outbox.expires_at) : null,
    });
    if (outbox.payload.staff_test === true && outbox.payload.staff_test_force_now === true) {
      for (const delivery of plan.deliveries) delivery.scheduledFor = now.toISOString();
    }
    if (
      requiresPromotionalFrequencyReservation(
        outbox.event_type,
        outbox.payload.staff_test === true,
      ) &&
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
    const deepLink =
      context.adminBookingAlertPolicy?.deepLink ??
      notificationDeepLink(outbox, plan.message.actions[0], context.variables);
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
            staff_test: outbox.payload.staff_test === true,
            source_class_starts_at:
              typeof outbox.payload.class_starts_at === "string"
                ? outbox.payload.class_starts_at
                : null,
            class_schedule_version:
              typeof outbox.payload.class_schedule_version === "string"
                ? outbox.payload.class_schedule_version
                : null,
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
        components: delivery.templateComponents,
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

async function activeHandoff(recipient: string | null) {
  if (!recipient) return false;
  const normalized = recipient.replace(/\D/g, "");
  const result = await (notificationDatabase as any)
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
  const db = notificationDatabase as any;
  if (!message.related_booking_id) {
    throw new Error("reminder_booking_context_missing");
  }
  const booking = await db
    .from("bookings")
    .select("status,class:classes(status,starts_at,notification_schedule_version)")
    .eq("id", message.related_booking_id)
    .maybeSingle();
  if (booking.error) throw booking.error;
  const studioClass = relation(booking.data?.class);
  if (
    !shouldCancelReminderForDomainState(
      message.event_type,
      booking.data?.status,
      studioClass?.status,
      typeof message.content?.source_class_starts_at === "string"
        ? message.content.source_class_starts_at
        : null,
      studioClass?.starts_at,
      typeof message.content?.class_schedule_version === "string"
        ? message.content.class_schedule_version
        : null,
      studioClass?.notification_schedule_version == null
        ? null
        : String(studioClass.notification_schedule_version),
    )
  ) {
    return false;
  }
  const cancelled = await currentDeliveryLease(
    db
      .from("message_deliveries")
      .update({
        status: "cancelled",
        error_code: "booking_or_class_cancelled",
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "sending"),
    delivery,
  );
  if (cancelled.error) throw cancelled.error;
  return true;
}

async function cancelInvalidPaymentReminderDelivery(
  delivery: DeliveryRow,
  message: any,
  now: Date,
) {
  if (message.event_type !== "payment_pending_reminder") return false;
  if (!message.related_payment_id) throw new Error("payment_reminder_context_missing");
  const db = notificationDatabase as any;
  const payment = await db
    .from("payments")
    .select("status,member_id")
    .eq("id", message.related_payment_id)
    .maybeSingle();
  if (payment.error) throw payment.error;
  let errorCode: string | null = null;
  if (shouldCancelPaymentReminderForDomainState(message.event_type, payment.data?.status)) {
    errorCode = "payment_no_longer_pending";
  } else if (payment.data?.member_id) {
    const latestPendingPayment = await db
      .from("payments")
      .select("id")
      .eq("member_id", payment.data.member_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestPendingPayment.error) throw latestPendingPayment.error;
    if (
      isSupersededPendingPaymentReminder(
        message.related_payment_id,
        latestPendingPayment.data?.id ?? null,
      )
    ) {
      errorCode = "payment_superseded_by_newer_attempt";
    }
  }
  if (!errorCode) {
    return false;
  }
  const cancelled = await currentDeliveryLease(
    db
      .from("message_deliveries")
      .update({
        status: "cancelled",
        error_code: errorCode,
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "sending"),
    delivery,
  );
  if (cancelled.error) throw cancelled.error;
  return true;
}

async function cancelInvalidOpenClassDelivery(delivery: DeliveryRow, message: any, now: Date) {
  if (message.event_type !== "class_open_spots") return false;
  if (!message.related_class_id || !message.member_id) {
    throw new Error("open_class_alert_context_missing");
  }

  const db = notificationDatabase as any;
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

  const cancelled = await currentDeliveryLease(
    db
      .from("message_deliveries")
      .update({
        status: "cancelled",
        error_code: "open_class_alert_no_longer_eligible",
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", delivery.id)
      .eq("status", "sending"),
    delivery,
  );
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
  const db = notificationDatabase as any;
  const update = await currentDeliveryLease(
    db
      .from("message_deliveries")
      .update({
        status: "delivery_unknown",
        failure_class: "ambiguous",
        error_code: "provider_result_persistence_uncertain",
        error_message: reason.slice(0, 500),
        next_attempt_at: null,
        failed_at: now,
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        updated_at: now,
      })
      .eq("id", delivery.id),
    delivery,
  );
  if (update.error) throw update.error;
  await createAdminAlert({
    idempotencyKey: `admin:delivery:${delivery.id}:delivery_unknown`,
    subject: "WhatsApp outcome requires reconciliation",
    body: "A WhatsApp request may have reached Meta, but its result could not be stored safely.",
    content: { delivery_id: delivery.id, channel: "whatsapp", status: "delivery_unknown" },
  });
}

async function alertRecoveredStaleWhatsappDeliveries() {
  const db = notificationDatabase as any;
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
  const db = notificationDatabase as any;
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
      buildPremiumPushPayload({
        eventType: message.event_type as MessageEventType,
        language: language(message.language) ?? "he",
        variables:
          message.content?.variables && typeof message.content.variables === "object"
            ? message.content.variables
            : {},
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
      }),
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
        providerMessageId?: string | null;
      },
  startedAt: Date,
) {
  const db = notificationDatabase as any;
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
      provider_error_code: result.ok ? null : result.error.slice(0, 100),
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
    provider_message_id: result.providerMessageId ?? null,
    next_attempt_at: nextAttemptAt?.toISOString() ?? null,
    lease_owner: null,
    lease_token: null,
    lease_expires_at: null,
    failure_class: result.ok ? null : result.failureClass,
    error_message: result.ok ? null : result.error.slice(0, 500),
    accepted_at: result.ok && result.status === "accepted" ? now.toISOString() : null,
    sent_at: result.ok && result.status === "sent" ? now.toISOString() : null,
    failed_at: result.ok ? null : now.toISOString(),
    updated_at: now.toISOString(),
  };
  const updated = await currentDeliveryLease(
    db.from("message_deliveries").update(update).eq("id", delivery.id),
    delivery,
  );
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

async function startDeliveryAttempt(delivery: DeliveryRow, startedAt: Date) {
  const result = await (notificationDatabase as any).from("message_delivery_attempts").upsert(
    {
      delivery_id: delivery.id,
      attempt_number: delivery.attempt_count,
      provider: delivery.provider,
      started_at: startedAt.toISOString(),
      finished_at: null,
      outcome: "processing",
      request_metadata: { channel: delivery.channel },
      response_metadata: {},
    },
    { onConflict: "delivery_id,attempt_number" },
  );
  if (result.error) throw result.error;
}

async function finishDeliveryAttemptWithoutProvider(
  delivery: DeliveryRow,
  startedAt: Date,
  outcome: DeliveryStatus,
  errorCode?: string,
) {
  const finishedAt = new Date();
  const result = await (notificationDatabase as any)
    .from("message_delivery_attempts")
    .update({
      finished_at: finishedAt.toISOString(),
      outcome,
      provider_error_code: errorCode ?? null,
      failure_class: null,
    })
    .eq("delivery_id", delivery.id)
    .eq("attempt_number", delivery.attempt_count);
  if (result.error) throw result.error;
  logMessagingEvent("delivery_attempt", {
    correlationId: delivery.message_id,
    messageId: delivery.message_id,
    deliveryId: delivery.id,
    provider: delivery.provider,
    channel: delivery.channel,
    outcome,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    retryClassification: null,
    attemptNumber: delivery.attempt_count,
  });
}

async function suppressExternalDeliveryIfBlocked(
  delivery: DeliveryRow,
  message: { event_type: MessageEventType; member_id?: string | null; audience?: string },
  runtime: ReturnType<typeof resolveMessagingRuntime>,
  startedAt: Date,
) {
  let errorCode: string | null = null;
  if (!runtimeAllowsRecipient(runtime, delivery.channel, delivery.recipient_address)) {
    errorCode = "recipient_not_allowlisted";
  }
  if (!errorCode && message.audience !== "admin") {
    const db = notificationDatabase as any;
    const member = await db
      .from("members")
      .select("id,status,email,phone")
      .eq("id", message.member_id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (member.error) throw member.error;
    if (!member.data || member.data.status !== "active") {
      errorCode = "recipient_no_longer_active";
    } else {
      const preferences = await readMemberNotificationPreferences(db, member.data.id);
      if (preferences.error) throw preferences.error;
      const mapped = mapMemberNotificationPreferences(preferences.data);
      if (
        !deliveryAllowedByConsent(message.event_type, delivery.channel, {
          pushEnabled: mapped.pushEnabled,
          whatsappEnabled: mapped.whatsappEnabled,
          emailEnabled: mapped.emailEnabled,
          scheduleUpdates: mapped.scheduleUpdates,
          classOperations: mapped.classOperationsEnabled,
          classReminders: mapped.classRemindersEnabled,
          scheduleOpenings: mapped.scheduleOpeningsEnabled,
          waitlist: mapped.waitlistEnabled,
          payments: mapped.paymentsEnabled,
          membership: mapped.membershipEnabled,
          staffReplies: mapped.staffRepliesEnabled,
          recommendations: mapped.recommendationsEnabled,
          marketing: mapped.marketing,
        })
      ) {
        errorCode = "recipient_preferences_changed";
      }
      const normalizePhone = (value: string | null) =>
        (value ?? "").replace(/\D/g, "").replace(/^0/, "972");
      if (
        (delivery.channel === "email" &&
          (member.data.email ?? "").trim().toLowerCase() !==
            (delivery.recipient_address ?? "").trim().toLowerCase()) ||
        (delivery.channel === "whatsapp" &&
          normalizePhone(member.data.phone) !== normalizePhone(delivery.recipient_address))
      ) {
        errorCode = "recipient_destination_changed";
      }
      if (delivery.channel === "whatsapp") {
        const consent = await db.rpc("notification_whatsapp_consent_current", {
          p_member_id: member.data.id,
        });
        if (consent.error) throw consent.error;
        if (consent.data !== true) errorCode = "whatsapp_consent_withdrawn";
      }
    }
  }
  if (
    !errorCode &&
    delivery.channel === "whatsapp" &&
    !isEssentialMessageEvent(message.event_type) &&
    message.event_type !== "human_handoff" &&
    (await activeHandoff(delivery.recipient_address))
  ) {
    errorCode = "active_handoff";
  }
  if (!errorCode) return false;
  const suppressed = await currentDeliveryLease(
    (notificationDatabase as any)
      .from("message_deliveries")
      .update({
        status: "suppressed",
        failure_class: errorCode === "recipient_not_allowlisted" ? "configuration" : null,
        error_code: errorCode,
        lease_owner: null,
        lease_token: null,
        lease_expires_at: null,
        updated_at: startedAt.toISOString(),
      })
      .eq("id", delivery.id),
    delivery,
  );
  if (suppressed.error) throw suppressed.error;
  await finishDeliveryAttemptWithoutProvider(delivery, startedAt, "suppressed", errorCode);
  return true;
}

async function processDelivery(
  delivery: DeliveryRow,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
  startedAt = new Date(),
) {
  const db = notificationDatabase as any;
  await startDeliveryAttempt(delivery, startedAt);
  const messageResult = await db
    .from("messages")
    .select("*")
    .eq("id", delivery.message_id)
    .single();
  if (messageResult.error) throw messageResult.error;
  const message = messageResult.data;
  if (await enforceConciergeSendGate(delivery, startedAt)) {
    await finishDeliveryAttemptWithoutProvider(
      delivery,
      startedAt,
      "suppressed",
      "concierge_send_gate",
    );
    return "suppressed";
  }
  if (delivery.expires_at && new Date(delivery.expires_at) <= startedAt) {
    const expired = await currentDeliveryLease(
      db
        .from("message_deliveries")
        .update({
          status: "expired",
          lease_owner: null,
          lease_token: null,
          lease_expires_at: null,
          updated_at: startedAt.toISOString(),
        })
        .eq("id", delivery.id),
      delivery,
    );
    if (expired.error) throw expired.error;
    await finishDeliveryAttemptWithoutProvider(delivery, startedAt, "expired", "delivery_expired");
    return "expired";
  }
  if (!isStaffTestMessageContent(message.content)) {
    if (await cancelInvalidReminderDelivery(delivery, message, startedAt)) {
      await finishDeliveryAttemptWithoutProvider(
        delivery,
        startedAt,
        "cancelled",
        "reminder_business_state_changed",
      );
      return "cancelled";
    }
    if (await cancelInvalidPaymentReminderDelivery(delivery, message, startedAt)) {
      await finishDeliveryAttemptWithoutProvider(
        delivery,
        startedAt,
        "cancelled",
        "payment_business_state_changed",
      );
      return "cancelled";
    }
    if (await cancelInvalidOpenClassDelivery(delivery, message, startedAt)) {
      await finishDeliveryAttemptWithoutProvider(
        delivery,
        startedAt,
        "cancelled",
        "open_class_business_state_changed",
      );
      return "cancelled";
    }
  }
  if (delivery.channel === "in_app") {
    const delivered = await currentDeliveryLease(
      db
        .from("message_deliveries")
        .update({
          status: "delivered",
          delivered_at: startedAt.toISOString(),
          lease_owner: null,
          lease_token: null,
          lease_expires_at: null,
          updated_at: startedAt.toISOString(),
        })
        .eq("id", delivery.id),
      delivery,
    );
    if (delivered.error) throw delivered.error;
    await finishDeliveryAttemptWithoutProvider(delivery, startedAt, "delivered");
    return "delivered";
  }
  if (await suppressExternalDeliveryIfBlocked(delivery, message, runtime, startedAt)) {
    return "suppressed";
  }

  let result;
  if (delivery.channel === "whatsapp") {
    if (delivery.provider_payload.kind === "freeform") {
      result = await sendWhatsappFreeform({
        to: delivery.recipient_address ?? "",
        text: String(delivery.provider_payload.text ?? ""),
      });
    } else {
      const components = parseWhatsappTemplateComponents(delivery.provider_payload.components);
      result = components
        ? await sendWhatsappTemplate({
            to: delivery.recipient_address ?? "",
            templateName: String(delivery.provider_payload.template_name ?? ""),
            languageCode: delivery.provider_payload.template_language as "he" | "ar" | "en_US",
            components,
          })
        : ({
            ok: false,
            failureClass: "configuration",
            error: "whatsapp_template_components_missing_or_invalid",
          } as const);
    }
  } else if (delivery.channel === "email") {
    const publicBaseUrl =
      process.env.MESSAGING_PUBLIC_BASE_URL?.trim() || process.env.HYP_PUBLIC_BASE_URL?.trim();
    if (!publicBaseUrl) throw new Error("missing_messaging_public_base_url");
    const concierge = typeof message.content?.concierge_decision_id === "string";
    const journeyType =
      typeof message.content?.journey_type === "string"
        ? message.content.journey_type
        : conciergeJourneyForTemplate(message.template_key ?? message.event_type);
    const locale = language(message.language) ?? "he";
    const variables =
      message.content?.variables && typeof message.content.variables === "object"
        ? message.content.variables
        : {};
    const renderedEmail = concierge
      ? renderSelectedConciergeEmail({
          journeyType,
          templateKey: message.template_key ?? message.event_type,
          locale,
          subject: message.subject ?? "Cloud & Core",
          body: message.body ?? "",
          variables,
          publicBaseUrl,
          replyTo: process.env.MESSAGING_EMAIL_REPLY_TO,
          messageKey: delivery.idempotency_key,
          contentMode: "final",
          presentationKey:
            typeof message.content?.presentation_key === "string"
              ? message.content.presentation_key
              : (() => {
                  throw new Error("missing_concierge_presentation_evidence");
                })(),
          presentationHash:
            typeof message.content?.presentation_hash === "string"
              ? message.content.presentation_hash
              : (() => {
                  throw new Error("missing_concierge_presentation_hash");
                })(),
          presentationContract:
            message.content?.presentation_contract &&
            typeof message.content.presentation_contract === "object" &&
            !Array.isArray(message.content.presentation_contract)
              ? (message.content.presentation_contract as Record<string, unknown>)
              : (() => {
                  throw new Error("missing_concierge_presentation_contract");
                })(),
          renderedFacts: Array.isArray(message.content?.rendered_facts)
            ? (message.content.rendered_facts as Array<{
                key: string;
                label: string;
                value: string;
                ltr: boolean;
              }>)
            : (() => {
                throw new Error("missing_concierge_rendered_facts");
              })(),
          emailShellVersion:
            typeof message.content?.email_shell_version === "number"
              ? message.content.email_shell_version
              : (() => {
                  throw new Error("missing_concierge_email_shell_version");
                })(),
          emailShellHash:
            typeof message.content?.email_shell_hash === "string"
              ? message.content.email_shell_hash
              : (() => {
                  throw new Error("missing_concierge_email_shell_hash");
                })(),
          sourceContentHash:
            typeof message.content?.source_content_hash === "string"
              ? message.content.source_content_hash
              : (() => {
                  throw new Error("missing_concierge_source_content_hash");
                })(),
          actionUrl:
            typeof message.content?.action_url === "string" || message.content?.action_url === null
              ? message.content.action_url
              : undefined,
        })
      : renderTransactionalEmail({
          eventType: message.event_type as MessageEventType,
          language: locale,
          subject: message.subject ?? "Cloud & Core",
          body: message.body ?? "",
          variables,
          actionUrl: message.deep_link ?? message.content?.action_url ?? null,
          publicBaseUrl,
          replyTo: process.env.MESSAGING_EMAIL_REPLY_TO,
          messageKey: delivery.idempotency_key,
        });
    result = await sendResendEmail({
      to: delivery.recipient_address ?? "",
      subject: renderedEmail.subject,
      html: renderedEmail.html,
      text: renderedEmail.text,
      headers: renderedEmail.headers,
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

const TERMINAL_DELIVERY_STATUSES: ReadonlySet<DeliveryStatus> = new Set([
  "accepted",
  "sent",
  "delivered",
  "read",
  "dead_letter",
  "suppressed",
  "expired",
  "cancelled",
  "delivery_unknown",
]);

export async function processUnifiedMessagingDeliveryById(
  deliveryId: string,
  input?: { workerId?: string; leaseSeconds?: number },
): Promise<{
  outcome:
    | "sent"
    | "delivered"
    | "accepted"
    | "skipped"
    | "cancelled"
    | "failed_permanent"
    | "already_terminal"
    | "lease_busy"
    | "retryable_failure";
}> {
  const db = notificationDatabase as any;
  const current = await db
    .from("message_deliveries")
    .select("id,status,channel")
    .eq("id", deliveryId)
    .maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return { outcome: "failed_permanent" };
  if (TERMINAL_DELIVERY_STATUSES.has(current.data.status as DeliveryStatus)) {
    return { outcome: "already_terminal" };
  }
  // WhatsApp remains on the existing Mac-local atomic claim/report bridge.
  if (current.data.channel === "whatsapp") return { outcome: "skipped" };

  const leaseToken = randomUUID();
  const workerId = input?.workerId ?? `cloud-task:${randomUUID()}`;
  const claimed = await db.rpc("claim_message_delivery_by_id", {
    p_delivery_id: deliveryId,
    p_worker: workerId,
    p_lease_token: leaseToken,
    p_lease_seconds: Math.min(Math.max(input?.leaseSeconds ?? 300, 30), 900),
  });
  if (claimed.error) throw claimed.error;
  const delivery = (claimed.data?.[0] ?? null) as DeliveryRow | null;
  if (!delivery) {
    const refreshed = await db
      .from("message_deliveries")
      .select("status")
      .eq("id", deliveryId)
      .maybeSingle();
    if (refreshed.error) throw refreshed.error;
    if (TERMINAL_DELIVERY_STATUSES.has(refreshed.data?.status as DeliveryStatus)) {
      return { outcome: "already_terminal" };
    }
    return { outcome: "lease_busy" };
  }

  const runtime = resolveMessagingRuntime(process.env);
  const startedAt = new Date();
  try {
    const status = await processDelivery(delivery, runtime, startedAt);
    if (status === "failed") return { outcome: "retryable_failure" };
    if (status === "dead_letter" || status === "delivery_unknown") {
      return { outcome: "failed_permanent" };
    }
    if (status === "cancelled") return { outcome: "cancelled" };
    if (status === "suppressed" || status === "expired") return { outcome: "skipped" };
    if (status === "delivered" || status === "sent" || status === "accepted") {
      return { outcome: status };
    }
    return { outcome: "retryable_failure" };
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : "delivery_worker_error";
    await recordDeliveryResult(
      delivery,
      { ok: false, failureClass: "transient", error: errorCode },
      startedAt,
    );
    return { outcome: "retryable_failure" };
  }
}

export type CanonicalOpenwaJob = {
  id: string;
  to: string;
  text: string;
  attemptCount: number;
  triggerType: string;
  leaseToken: string;
  source: "canonical";
};

export async function claimCanonicalOpenwaDeliveries(input: {
  workerId: string;
  limit: number;
  dryRun?: boolean;
  claimNotBefore?: Date | null;
}): Promise<{
  jobs: CanonicalOpenwaJob[];
  claimed: number;
  invalid: number;
  recovered: number;
  dryRun: boolean;
}> {
  if (input.dryRun) return { jobs: [], claimed: 0, invalid: 0, recovered: 0, dryRun: true };
  const runtime = resolveMessagingRuntime(process.env);
  if (runtime.mode === "disabled" || !runtime.channels.whatsapp) {
    return { jobs: [], claimed: 0, invalid: 0, recovered: 0, dryRun: false };
  }
  const db = notificationDatabase as any;
  const claimed = await db.rpc("claim_message_deliveries", {
    p_worker: input.workerId,
    p_limit: Math.min(Math.max(Math.trunc(input.limit), 1), 10),
    p_lease_seconds: 300,
    p_channels: ["whatsapp"],
  });
  if (claimed.error) throw claimed.error;

  const jobs: CanonicalOpenwaJob[] = [];
  let invalid = 0;
  for (const delivery of (claimed.data ?? []) as DeliveryRow[]) {
    const startedAt = new Date();
    try {
      const provider = await currentDeliveryLease(
        db.from("message_deliveries").update({ provider: "openwa" }).eq("id", delivery.id),
        delivery,
      );
      if (provider.error) throw provider.error;
      delivery.provider = "openwa";
      await startDeliveryAttempt(delivery, startedAt);
      const messageResult = await db
        .from("messages")
        .select("*")
        .eq("id", delivery.message_id)
        .single();
      if (messageResult.error) throw messageResult.error;
      const message = messageResult.data;
      if (await enforceConciergeSendGate(delivery, startedAt)) {
        await finishDeliveryAttemptWithoutProvider(
          delivery,
          startedAt,
          "suppressed",
          "concierge_send_gate",
        );
        invalid += 1;
        continue;
      }
      if (await suppressExternalDeliveryIfBlocked(delivery, message, runtime, startedAt)) {
        invalid += 1;
        continue;
      }
      const outsideRolloutWindow =
        input.claimNotBefore &&
        delivery.created_at &&
        new Date(delivery.created_at).getTime() < input.claimNotBefore.getTime();
      if (outsideRolloutWindow) {
        await recordDeliveryResult(
          delivery,
          { ok: false, failureClass: "permanent", error: "openwa_claim_before_rollout_cutoff" },
          startedAt,
        );
        invalid += 1;
        continue;
      }
      if (
        (await cancelInvalidReminderDelivery(delivery, message, startedAt)) ||
        (await cancelInvalidPaymentReminderDelivery(delivery, message, startedAt)) ||
        (await cancelInvalidOpenClassDelivery(delivery, message, startedAt))
      ) {
        await finishDeliveryAttemptWithoutProvider(
          delivery,
          startedAt,
          "cancelled",
          "delivery_business_state_changed",
        );
        invalid += 1;
        continue;
      }
      const text = String(message.body ?? "").trim();
      const to = delivery.recipient_address?.trim() ?? "";
      const leaseToken = delivery.lease_token?.trim() ?? "";
      if (!text || !to || !leaseToken) {
        await recordDeliveryResult(
          delivery,
          {
            ok: false,
            failureClass: "configuration",
            error: !text
              ? "missing_generated_text"
              : !to
                ? "missing_whatsapp_phone"
                : "missing_lease_token",
          },
          startedAt,
        );
        invalid += 1;
        continue;
      }
      jobs.push({
        id: delivery.id,
        to,
        text,
        attemptCount: delivery.attempt_count,
        triggerType: String(message.event_type ?? "unknown"),
        leaseToken,
        source: "canonical",
      });
    } catch {
      // Nothing has been returned to the Mac yet, so this preflight is safe to retry.
      invalid += 1;
      try {
        await recordDeliveryResult(
          delivery,
          {
            ok: false,
            failureClass: "transient",
            error: "openwa_preflight_failed",
          },
          startedAt,
        );
      } catch {
        logMessagingEvent("openwa_preflight_persistence_failed", {
          deliveryId: delivery.id,
          errorCode: "database_write_failed",
        });
      }
    }
  }
  return { jobs, claimed: claimed.data?.length ?? 0, invalid, recovered: 0, dryRun: false };
}

export async function reportCanonicalOpenwaDelivery(input: {
  jobId: string;
  leaseToken: string;
  status: "sent" | "failed";
  retryable?: boolean;
  error?: string;
  providerMessageId?: string | null;
}): Promise<
  | { ok: true; outcome: "sent" | "requeued" | "failed"; nextAttemptAt?: string | null }
  | { ok: false; reason: "not_found" | "not_sending" }
> {
  const db = notificationDatabase as any;
  const deliveryResult = await db
    .from("message_deliveries")
    .select("*")
    .eq("id", input.jobId)
    .eq("channel", "whatsapp")
    .maybeSingle();
  if (deliveryResult.error) throw deliveryResult.error;
  const delivery = deliveryResult.data as DeliveryRow | null;
  if (!delivery) return { ok: false, reason: "not_found" };
  if (delivery.status !== "sending" || delivery.lease_token !== input.leaseToken) {
    return { ok: false, reason: "not_sending" };
  }
  const startedAt = delivery.last_attempt_at ? new Date(delivery.last_attempt_at) : new Date();
  const status = await recordDeliveryResult(
    delivery,
    input.status === "sent"
      ? { ok: true, status: "sent", providerMessageId: input.providerMessageId?.trim() || null }
      : {
          ok: false,
          failureClass: classifyOpenwaFailure(input),
          error: input.error?.trim() || "openwa_delivery_failed",
          providerMessageId: input.providerMessageId?.trim() || null,
        },
    startedAt,
  );
  if (status === "sent") return { ok: true, outcome: "sent" };
  if (status === "failed") {
    const refreshed = await db
      .from("message_deliveries")
      .select("next_attempt_at")
      .eq("id", delivery.id)
      .single();
    if (refreshed.error) throw refreshed.error;
    return { ok: true, outcome: "requeued", nextAttemptAt: refreshed.data.next_attempt_at };
  }
  return { ok: true, outcome: "failed" };
}

export function finalReminderAt(startsAt: Date) {
  const { hour, minute } = getIsraelNowParts(startsAt);
  return hour * 60 + minute < 10 * 60 + 30
    ? getPreviousIsraelEvening(startsAt)
    : new Date(startsAt.getTime() - 2 * 60 * 60_000);
}

export function reminderDeduplicationKey(input: {
  bookingId: string;
  eventType: "class_reminder_planning" | "class_reminder_final";
  startsAt: Date;
  scheduleVersion: string | number;
}) {
  return `booking:${input.bookingId}:${input.eventType}:${input.startsAt.toISOString()}:v${input.scheduleVersion}`;
}

async function enqueueOpenClassAlerts(
  now: Date,
  limit: number,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  if (runtime.mode === "disabled" || !runtime.channels.push) {
    return { scannedClasses: 0, eligibleMembers: 0, prepared: 0 };
  }

  const db = notificationDatabase as any;
  const windowStart = new Date(
    now.getTime() + OPEN_CLASS_ALERT_MIN_LEAD_HOURS * 60 * 60_000,
  ).toISOString();
  const windowEnd = new Date(
    now.getTime() + OPEN_CLASS_ALERT_MAX_LEAD_HOURS * 60 * 60_000,
  ).toISOString();
  const classesResult = await db
    .from("classes")
    .select("id,starts_at,status,member_visible,capacity,booked_count,instructor_id")
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
  const historyStart = new Date(now.getTime() - 120 * 86_400_000).toISOString();
  const [
    preferencesResult,
    tokensResult,
    bookingsResult,
    waitlistResult,
    alertsResult,
    attendanceResult,
  ] = await Promise.all([
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
    db
      .from("bookings")
      .select("member_id,class:classes!inner(starts_at,instructor_id)")
      .in("member_id", memberIds)
      .eq("status", "checked_in")
      .gte("class.starts_at", historyStart)
      .lt("class.starts_at", now.toISOString())
      .limit(20_000),
  ]);
  for (const result of [
    preferencesResult,
    tokensResult,
    bookingsResult,
    waitlistResult,
    alertsResult,
    attendanceResult,
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
  const attendanceByMember = new Map<
    string,
    Array<{ startsAt: string; instructorId: string | null }>
  >();
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
    const alertTime = new Date(row.created_at).getTime();
    alertsLast7Days.set(row.member_id, (alertsLast7Days.get(row.member_id) ?? 0) + 1);
    if (alertTime >= oneDayAgo) {
      alertsLast24Hours.set(row.member_id, (alertsLast24Hours.get(row.member_id) ?? 0) + 1);
    }
  }
  for (const row of attendanceResult.data ?? []) {
    const attendedClass = relation(row.class);
    if (!attendedClass?.starts_at) continue;
    const values = attendanceByMember.get(row.member_id) ?? [];
    values.push({
      startsAt: attendedClass.starts_at,
      instructorId: attendedClass.instructor_id ?? null,
    });
    attendanceByMember.set(row.member_id, values);
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
        instructor_id: string | null;
      }) => ({
        id: studioClass.id,
        startsAt: studioClass.starts_at,
        status: studioClass.status,
        memberVisible: studioClass.member_visible,
        capacity: studioClass.capacity,
        bookedCount: studioClass.booked_count,
        instructorId: studioClass.instructor_id,
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
        classMatchScores: new Map(
          classesResult.data.map((studioClass: any) => [
            studioClass.id,
            scoreOpenClassAffinity(
              {
                startsAt: studioClass.starts_at,
                instructorId: studioClass.instructor_id ?? null,
              },
              attendanceByMember.get(member.id) ?? [],
            ),
          ]),
        ),
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
  const db = notificationDatabase as any;
  const classes = await db
    .from("classes")
    .select("id,title,starts_at,instructor_id")
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
    .select("id,phone,email,remaining_credits")
    .in("id", memberIds)
    .eq("status", "active");
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
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const historyStart = new Date(now.getTime() - 120 * 86_400_000).toISOString();
  const [bookings, waitlist, recent, upcomingBookings, growthMessages, attendance] =
    await Promise.all([
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
        .select("member_id,aggregate_id,created_at,event_type,payload")
        .in("member_id", allowedIds)
        .in("event_type", [
          "booking_confirmed",
          "class_reminder_planning",
          "booking_no_show_followup",
          "class_published",
          "class_open_spots",
          "class_recommendation",
          "trial_followup",
          "retention_reminder",
        ])
        .gte("created_at", sevenDaysAgo),
      db
        .from("bookings")
        .select("member_id,class:classes!inner(starts_at,status)")
        .in("member_id", allowedIds)
        .in("status", ["booked", "checked_in"])
        .eq("class.status", "scheduled")
        .gte("class.starts_at", now.toISOString()),
      db
        .from("messages")
        .select(
          "id,member_id,event_type,created_at,message_deliveries(channel,status),message_engagement_events(event_type)",
        )
        .in("member_id", allowedIds)
        .in("event_type", ["class_open_spots", "class_recommendation", "retention_reminder"])
        .gte("created_at", fourteenDaysAgo),
      db
        .from("bookings")
        .select("member_id,class:classes!inner(starts_at,instructor_id)")
        .in("member_id", allowedIds)
        .eq("status", "checked_in")
        .gte("class.starts_at", historyStart)
        .lt("class.starts_at", now.toISOString())
        .limit(20_000),
    ]);
  for (const result of [bookings, waitlist, recent, upcomingBookings, growthMessages, attendance]) {
    if (result.error) throw result.error;
  }
  const blocked = new Set<string>(
    [...(bookings.data ?? []), ...(waitlist.data ?? [])].map(
      (row: { member_id: string; class_id: string }) => `${row.member_id}:${row.class_id}`,
    ),
  );
  const oneDayAgo = now.getTime() - 86_400_000;
  const membersWithFutureBooking = new Set<string>(
    (upcomingBookings.data ?? []).map((row: { member_id: string }) => row.member_id),
  );
  const attendanceByMember = new Map<
    string,
    Array<{ startsAt: string; instructorId: string | null }>
  >();
  for (const row of attendance.data ?? []) {
    const attendedClass = relation(row.class);
    if (!attendedClass?.starts_at) continue;
    const values = attendanceByMember.get(row.member_id) ?? [];
    values.push({
      startsAt: attendedClass.starts_at,
      instructorId: attendedClass.instructor_id ?? null,
    });
    attendanceByMember.set(row.member_id, values);
  }
  let prepared = 0;
  for (const member of allowedMembers) {
    const memberRecent = (recent.data ?? []).filter((row: any) => row.member_id === member.id);
    const promotionalRecent = memberRecent.filter((row: any) =>
      [
        "booking_no_show_followup",
        "class_published",
        "class_open_spots",
        "class_recommendation",
        "trial_followup",
        "retention_reminder",
      ].includes(row.event_type),
    );
    if (
      promotionalRecent.length >= 3 ||
      promotionalRecent.some((row: any) => new Date(row.created_at).getTime() >= oneDayAgo)
    ) {
      continue;
    }
    const recommendations = rankClassRecommendations(
      classes.data.filter(
        (candidate: { id: string }) =>
          !blocked.has(`${member.id}:${candidate.id}`) &&
          !memberRecent.some(
            (row: any) =>
              row.event_type === "class_recommendation" && row.aggregate_id === candidate.id,
          ),
      ),
      attendanceByMember.get(member.id) ?? [],
    );
    const studioClass = recommendations[0];
    if (!studioClass) continue;
    const memberGrowthMessages = (growthMessages.data ?? []).filter(
      (row: any) => row.member_id === member.id,
    );
    const unopenedGrowthMessages = memberGrowthMessages.filter(isUnopenedSuccessfulPushMessage);
    const recentlyPlanned = memberRecent.some((row: any) =>
      ["booking_confirmed", "class_reminder_planning"].includes(row.event_type),
    );
    const whatsappAlreadyUsed = memberRecent.some(
      (row: any) =>
        row.event_type === "class_recommendation" &&
        row.payload?.whatsapp_growth_escalation === true,
    );
    const whatsappGrowthEscalation =
      !membersWithFutureBooking.has(member.id) &&
      !recentlyPlanned &&
      !whatsappAlreadyUsed &&
      unopenedGrowthMessages.length >= 2;
    const result = await db.from("message_outbox").upsert(
      {
        event_type: "class_recommendation",
        aggregate_type: "class",
        aggregate_id: studioClass.id,
        member_id: member.id,
        payload: {
          class_id: studioClass.id,
          secondary_class_id: recommendations[1]?.id ?? null,
          whatsapp_growth_escalation: whatsappGrowthEscalation,
        },
        deduplication_key: `class:${studioClass.id}:recommendation:member:${member.id}`,
        available_at: now.toISOString(),
        expires_at: studioClass.starts_at,
      },
      { onConflict: "deduplication_key", ignoreDuplicates: true },
    );
    if (result.error) throw result.error;
    const conciergeEvent = await db.rpc("emit_concierge_recommendation_event", {
      p_member_id: member.id,
      p_class_id: studioClass.id,
      p_secondary_class_id: recommendations[1]?.id ?? null,
      p_recommendation_summary: buildConciergeRecommendationSummary(recommendations),
      p_now: now.toISOString(),
    });
    if (conciergeEvent.error) throw conciergeEvent.error;
    prepared += 1;
    if (prepared >= limit) break;
  }
  return { eligibleMembers: allowedMembers.length, prepared };
}

async function enqueueScheduledConciergeJourneys(
  now: Date,
  limit: number,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
  enabledEvents: ReadonlySet<MessageEventType>,
) {
  const db = notificationDatabase as any;
  let weeklySchedules = 0;
  let dailyBriefings = 0;

  if (enabledEvents.has("weekly_schedule")) {
    const weekKey = jerusalemWeekKey(now);
    const scheduleEnd = new Date(now.getTime() + 7 * 86_400_000).toISOString();
    const classes = await db
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .eq("member_visible", true)
      .gte("starts_at", now.toISOString())
      .lte("starts_at", scheduleEnd);
    if (classes.error) throw classes.error;
    const classCount = classes.count ?? 0;
    if (classCount > 0) {
      const [preferences, existing, activeMembers] = await Promise.all([
        fetchAllRows<{ member_id: string }>((from, to) =>
          db
            .from("member_notification_preferences")
            .select("member_id")
            .eq("schedule_openings_enabled", true)
            .order("member_id")
            .range(from, to),
        ),
        fetchAllRows<{ member_id: string }>((from, to) =>
          db
            .from("message_outbox")
            .select("member_id")
            .eq("event_type", "weekly_schedule")
            .eq("payload->>week_key", weekKey)
            .order("member_id")
            .range(from, to),
        ),
        fetchAllRows<{ id: string; phone: string | null; email: string | null }>((from, to) =>
          db
            .from("members")
            .select("id,phone,email")
            .eq("status", "active")
            .order("id")
            .range(from, to),
        ),
      ]);
      const alreadyPrepared = new Set(existing.map((row: { member_id: string }) => row.member_id));
      const optedIn = new Set(preferences.map((row: { member_id: string }) => row.member_id));
      if (optedIn.size) {
        for (const member of activeMembers) {
          if (!optedIn.has(member.id)) continue;
          if (alreadyPrepared.has(member.id)) continue;
          if (
            runtime.mode === "allowlist" &&
            !runtimeAllowsRolloutRecipient(runtime, [member.id, member.phone, member.email])
          ) {
            continue;
          }
          const result = await db.from("message_outbox").upsert(
            {
              event_type: "weekly_schedule",
              aggregate_type: "studio_week",
              aggregate_id: null,
              member_id: member.id,
              payload: { class_count: classCount, week_key: weekKey },
              deduplication_key: `member:${member.id}:weekly_schedule:${weekKey}`,
              available_at: now.toISOString(),
              expires_at: scheduleEnd,
            },
            { onConflict: "deduplication_key", ignoreDuplicates: true },
          );
          if (result.error) throw result.error;
          weeklySchedules += 1;
          if (weeklySchedules >= limit) break;
        }
      }
    }
  }

  if (enabledEvents.has("daily_briefing")) {
    const dayKey = jerusalemDayKey(now);
    const dayStart = studioDateTimeInputToIso(`${dayKey}T00:00`);
    const dayEnd = studioDateTimeInputToIso(`${nextDayKey(dayKey)}T00:00`);
    const [bookings, waitlist, existing, activeMembers] = await Promise.all([
      fetchAllRows<{ member_id: string; class_id: string }>((from, to) =>
        db
          .from("bookings")
          .select("member_id,class_id,class:classes!inner(starts_at,status)")
          .eq("status", "booked")
          .eq("class.status", "scheduled")
          .gte("class.starts_at", dayStart)
          .lt("class.starts_at", dayEnd)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows<{ member_id: string; class_id: string }>((from, to) =>
        db
          .from("waitlist_entries")
          .select("member_id,class_id,class:classes!inner(starts_at,status)")
          .in("status", ["waiting", "promoted"])
          .eq("class.status", "scheduled")
          .gte("class.starts_at", dayStart)
          .lt("class.starts_at", dayEnd)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows<{ member_id: string }>((from, to) =>
        db
          .from("message_outbox")
          .select("member_id")
          .eq("event_type", "daily_briefing")
          .eq("payload->>day_key", dayKey)
          .order("member_id")
          .range(from, to),
      ),
      fetchAllRows<{ id: string; phone: string | null; email: string | null }>((from, to) =>
        db
          .from("members")
          .select("id,phone,email")
          .eq("status", "active")
          .order("id")
          .range(from, to),
      ),
    ]);
    const items = new Map<string, { booked: Set<string>; waitlisted: Set<string> }>();
    for (const row of bookings) {
      const memberItems = items.get(row.member_id) ?? {
        booked: new Set<string>(),
        waitlisted: new Set<string>(),
      };
      memberItems.booked.add(row.class_id);
      items.set(row.member_id, memberItems);
    }
    for (const row of waitlist) {
      const memberItems = items.get(row.member_id) ?? {
        booked: new Set<string>(),
        waitlisted: new Set<string>(),
      };
      if (!memberItems.booked.has(row.class_id)) memberItems.waitlisted.add(row.class_id);
      items.set(row.member_id, memberItems);
    }
    const alreadyPrepared = new Set(existing.map((row: { member_id: string }) => row.member_id));
    const eligible = [...items.entries()]
      .map(([memberId, memberItems]) => ({
        memberId,
        bookingCount: memberItems.booked.size,
        waitlistCount: memberItems.waitlisted.size,
      }))
      .filter((candidate) => dailyBriefingEligible(candidate))
      .filter((candidate) => !alreadyPrepared.has(candidate.memberId));
    const memberById = new Map(activeMembers.map((member) => [member.id, member]));
    for (const count of eligible) {
      const member = memberById.get(count.memberId);
      if (!member) continue;
      if (
        runtime.mode === "allowlist" &&
        !runtimeAllowsRolloutRecipient(runtime, [member.id, member.phone, member.email])
      ) {
        continue;
      }
      const result = await db.from("message_outbox").upsert(
        {
          event_type: "daily_briefing",
          aggregate_type: "member_day",
          aggregate_id: null,
          member_id: count.memberId,
          payload: {
            item_count: count.bookingCount + count.waitlistCount,
            booking_count: count.bookingCount,
            waitlist_count: count.waitlistCount,
            day_key: dayKey,
          },
          deduplication_key: `member:${count.memberId}:daily_briefing:${dayKey}`,
          available_at: now.toISOString(),
          expires_at: dayEnd,
        },
        { onConflict: "deduplication_key", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
      dailyBriefings += 1;
      if (dailyBriefings >= limit) break;
    }
  }

  return { weeklySchedules, dailyBriefings };
}

async function enqueueDueCanonicalEvents(
  now: Date,
  limit: number,
  runtime: ReturnType<typeof resolveMessagingRuntime>,
) {
  const db = notificationDatabase as any;
  const horizon = new Date(now.getTime() + 72 * 60 * 60_000).toISOString();
  const bookings = await db
    .from("bookings")
    .select(
      "id,member_id,class_id,class:classes!inner(id,starts_at,cancellation_window_hours,status,notification_schedule_version)",
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
    const events: Array<["class_reminder_planning" | "class_reminder_final", boolean]> = [
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
          payload: {
            booking_id: booking.id,
            class_id: booking.class_id,
            class_starts_at: startsAt.toISOString(),
            expected_start_at: startsAt.toISOString(),
            class_schedule_version: String(studioClass.notification_schedule_version ?? 0),
          },
          deduplication_key: reminderDeduplicationKey({
            bookingId: booking.id,
            eventType,
            startsAt,
            scheduleVersion: studioClass.notification_schedule_version ?? 0,
          }),
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
  const pendingPaymentResult = await db
    .from("payments")
    .select("id,member_id,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(Math.max(limit * 20, 100), 2_000));
  if (pendingPaymentResult.error) throw pendingPaymentResult.error;
  const pendingPaymentRows = (pendingPaymentResult.data ?? []) as Array<{
    id: string;
    member_id: string;
    created_at: string;
  }>;
  const pendingPayments = selectDuePendingPaymentReminders(pendingPaymentRows, {
    dueBefore: new Date(pendingBefore),
    limit,
  });
  for (const payment of pendingPayments) {
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
      "weekly_schedule",
      "daily_briefing",
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
      const inactiveDays = Math.floor(
        (now.getTime() - new Date(member.last_visit_at).getTime()) / 86_400_000,
      );
      const retentionStage = inactiveDays >= 30 ? "personal_whatsapp" : "caring_push";
      const result = await db.from("message_outbox").upsert(
        {
          event_type: "retention_reminder",
          aggregate_type: "member",
          aggregate_id: member.id,
          member_id: member.id,
          payload: { retention_stage: retentionStage, inactive_days: inactiveDays },
          deduplication_key: `member:${member.id}:retention_reminder:${retentionStage}:${cycle}`,
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
  const scheduledConcierge = await enqueueScheduledConciergeJourneys(
    now,
    limit,
    runtime,
    enabledDueEvents,
  );
  const openClassAlerts = await enqueueOpenClassAlerts(now, limit, runtime);
  return {
    reminders,
    paymentReminders: pendingPayments.length,
    paymentFailureFollowups: failedPayments.data?.length ?? 0,
    membershipReminders,
    renewalReminders,
    engagementReminders,
    classRecommendations,
    scheduledConcierge,
    openClassAlerts,
  };
}

export function normalizeUnifiedMessagingSweepLimit(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(200, Math.trunc(parsed))) : 50;
}

export async function runUnifiedMessagingCanary() {
  const db = notificationDatabase as any;
  const [outboxProbe, deliveryProbe] = await Promise.all([
    db.from("message_outbox").select("id").limit(1),
    db.from("message_deliveries").select("id").limit(1),
  ]);
  if (outboxProbe.error) throw outboxProbe.error;
  if (deliveryProbe.error) throw deliveryProbe.error;
  return {
    canary: true as const,
    databaseReady: true as const,
    mode: resolveMessagingRuntime(process.env).mode,
  };
}

async function staleTransactionStillCurrent(row: StaleOutboxRow, nowIso: string) {
  const db = notificationDatabase as any;
  if (
    [
      "booking_confirmed",
      "booking_changed",
      "booking_checked_in",
      "booking_cancelled",
      "booking_no_show_followup",
      "waitlist_accepted",
    ].includes(row.event_type)
  ) {
    if (!row.aggregate_id) return false;
    const result = await db
      .from("bookings")
      .select("status,class:classes(status,starts_at)")
      .eq("id", row.aggregate_id)
      .maybeSingle();
    if (result.error) throw result.error;
    const status = result.data?.status;
    if (row.event_type === "booking_cancelled") return status === "cancelled";
    if (row.event_type === "booking_checked_in") return status === "checked_in";
    if (row.event_type === "booking_no_show_followup") return status === "no_show";
    const studioClass = relation(result.data?.class);
    return (
      status === "booked" &&
      studioClass?.status === "scheduled" &&
      new Date(studioClass.starts_at).getTime() > new Date(nowIso).getTime()
    );
  }
  if (row.event_type === "credits_low" || row.event_type === "credits_depleted") {
    if (!row.member_id) return false;
    const result = await db
      .from("members")
      .select("remaining_credits")
      .eq("id", row.member_id)
      .maybeSingle();
    if (result.error) throw result.error;
    const credits = Number(result.data?.remaining_credits ?? 0);
    return row.event_type === "credits_depleted" ? credits === 0 : credits >= 1 && credits <= 2;
  }
  if (row.event_type === "membership_expired") {
    if (!row.aggregate_id) return false;
    const result = await db
      .from("member_plans")
      .select("status")
      .eq("id", row.aggregate_id)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data?.status === "expired";
  }
  if (row.event_type === "payment_confirmed" || row.event_type === "payment_failed") {
    if (!row.aggregate_id) return false;
    const result = await db
      .from("payments")
      .select("status")
      .eq("id", row.aggregate_id)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data?.status === (row.event_type === "payment_confirmed" ? "paid" : "failed");
  }
  if (row.event_type === "member_welcome") {
    if (!row.member_id) return false;
    const result = await db.from("members").select("status").eq("id", row.member_id).maybeSingle();
    if (result.error) throw result.error;
    return result.data?.status === "active";
  }
  return false;
}

async function suppressDisabledExternalDeliveryBacklog(
  externalChannels: ExternalChannelAvailability,
) {
  const db = notificationDatabase as any;
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
  deliveryTransport?: "inline" | "cloud_tasks";
  signal?: AbortSignal;
}) {
  const db = notificationDatabase as any;
  const now = input?.now ?? new Date();
  const limit = normalizeUnifiedMessagingSweepLimit(input?.limit);
  const workerId = input?.workerId ?? `messaging:${randomUUID()}`;
  const runtime = resolveMessagingRuntime(process.env);
  const externalChannels =
    runtime.mode === "disabled" ? { whatsapp: false, email: false, push: false } : runtime.channels;
  input?.signal?.throwIfAborted();
  const disabledBacklogSuppressed = await suppressDisabledExternalDeliveryBacklog(externalChannels);
  input?.signal?.throwIfAborted();
  const expiredOutbox = await closeExpiredOutboxRows(
    {
      async listExpired(nowIso, batchSize) {
        const result = await db
          .from("message_outbox")
          .select("id")
          .is("processed_at", null)
          .not("expires_at", "is", null)
          .lte("expires_at", nowIso)
          .order("expires_at", { ascending: true })
          .limit(batchSize);
        if (result.error) throw result.error;
        return result.data ?? [];
      },
      async markExpired(ids, nowIso) {
        const result = await db
          .from("message_outbox")
          .update({
            processed_at: nowIso,
            claimed_at: null,
            claimed_by: null,
            last_error: "outbox_expired_before_materialization",
            updated_at: nowIso,
          })
          .in("id", ids)
          .is("processed_at", null)
          .select("id");
        if (result.error) throw result.error;
        return result.data?.length ?? 0;
      },
    },
    now,
  );
  input?.signal?.throwIfAborted();
  const staleOutbox = await closeStaleOutboxRows(
    {
      async listStale(cutoffIso, nowIso, batchSize) {
        const result = await db
          .from("message_outbox")
          .select("id,event_type,aggregate_id,member_id")
          .is("processed_at", null)
          .lte("created_at", cutoffIso)
          .lte("available_at", nowIso)
          .order("created_at", { ascending: true })
          .limit(batchSize);
        if (result.error) throw result.error;
        return result.data ?? [];
      },
      transactionStillCurrent: staleTransactionStillCurrent,
      async markStale(decisions: StaleOutboxDecision[], nowIso) {
        let updated = 0;
        for (const reason of [...new Set(decisions.map((decision) => decision.reason))]) {
          const ids = decisions
            .filter((decision) => decision.reason === reason)
            .map((decision) => decision.id);
          const result = await db
            .from("message_outbox")
            .update({
              processed_at: nowIso,
              claimed_at: null,
              claimed_by: null,
              last_error: reason,
              updated_at: nowIso,
            })
            .in("id", ids)
            .is("processed_at", null)
            .select("id");
          if (result.error) throw result.error;
          updated += result.data?.length ?? 0;
        }
        return updated;
      },
    },
    now,
    (eventType) => requiresPromotionalFrequencyReservation(eventType as MessageEventType, false),
  );
  input?.signal?.throwIfAborted();
  const staleDeliveries = await closeStaleDeliveryRows(
    {
      async listStale(cutoffIso, nowIso, batchSize) {
        const baseQuery = () =>
          db
            .from("message_deliveries")
            .select("id,message:messages!inner(template_version)")
            .in("status", ["queued", "failed"])
            .lte("created_at", cutoffIso)
            .lte("scheduled_for", nowIso)
            .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order("created_at", { ascending: true })
            .limit(batchSize);
        const [v2Result, snapshotResult] = await Promise.all([
          baseQuery().eq("message.template_version", "v2"),
          db
            .from("message_deliveries")
            .select("id")
            .in("status", ["queued", "failed"])
            .not("snapshot_id", "is", null)
            .lte("created_at", cutoffIso)
            .lte("scheduled_for", nowIso)
            .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order("created_at", { ascending: true })
            .limit(batchSize),
        ]);
        if (v2Result.error) throw v2Result.error;
        if (snapshotResult.error) throw snapshotResult.error;
        return [
          ...new Map(
            [...(v2Result.data ?? []), ...(snapshotResult.data ?? [])].map((row) => [row.id, row]),
          ).values(),
        ].slice(0, batchSize);
      },
      async markStale(ids, nowIso) {
        const result = await db
          .from("message_deliveries")
          .update({
            status: "cancelled",
            failure_class: null,
            error_code: "delivery_stale_recovery_suppressed",
            error_message: "Suppressed during outage recovery because the delivery is stale.",
            next_attempt_at: null,
            lease_owner: null,
            lease_expires_at: null,
            updated_at: nowIso,
          })
          .in("id", ids)
          .in("status", ["queued", "failed"])
          .select("id");
        if (result.error) throw result.error;
        return result.data?.length ?? 0;
      },
    },
    now,
  );
  // The current promotion sender performs provider I/O inline. Task preparation
  // must never invoke it, including during shadow rollout or post-commit kicks.
  // Retain the legacy scheduled sweep until promotions have a task-safe path.
  const promotions = await dispatchDuePromotions({
    now,
    limit: Math.min(limit, 10),
    dryRun: input?.deliveryTransport === "cloud_tasks",
  });
  input?.signal?.throwIfAborted();
  const obsoleteReminders = await db.rpc("cancel_obsolete_notification_reminders", {
    p_limit: limit,
  });
  if (obsoleteReminders.error) throw obsoleteReminders.error;
  const obsoleteRemindersCancelled = Number(obsoleteReminders.data ?? 0);
  input?.signal?.throwIfAborted();
  const scheduled = await enqueueDueCanonicalEvents(now, limit, runtime);
  input?.signal?.throwIfAborted();
  const outboxClaim = await db.rpc("claim_message_outbox", {
    p_worker: workerId,
    p_limit: limit,
    p_lease_seconds: 120,
  });
  if (outboxClaim.error) throw outboxClaim.error;
  const materialized = { succeeded: 0, failed: 0 };
  for (const outbox of (outboxClaim.data ?? []) as OutboxRow[]) {
    input?.signal?.throwIfAborted();
    const result = await materializeOutbox(outbox, now, externalChannels, runtime);
    if (result.ok) materialized.succeeded += 1;
    else materialized.failed += 1;
  }
  const { reconcilePendingProviderWebhookLedger } = await import("@/lib/messageStatus.server");
  input?.signal?.throwIfAborted();
  const webhookReconciliation = await reconcilePendingProviderWebhookLedger(limit, input?.signal);
  input?.signal?.throwIfAborted();

  if (input?.deliveryTransport === "cloud_tasks") {
    return {
      workerId,
      mode: runtime.mode,
      disabledBacklogSuppressed,
      expiredOutbox,
      staleOutbox,
      staleDeliveries,
      obsoleteRemindersCancelled,
      scheduled,
      outboxClaimed: outboxClaim.data?.length ?? 0,
      materialized,
      webhookReconciliation,
      deliveriesClaimed: 0,
      deliveryOutcomes: {},
    };
  }

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
  input?.signal?.throwIfAborted();
  await alertRecoveredStaleWhatsappDeliveries();
  const delivered: Record<string, number> = {};
  for (const delivery of (deliveryClaim.data ?? []) as DeliveryRow[]) {
    input?.signal?.throwIfAborted();
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
    expiredOutbox,
    staleOutbox,
    staleDeliveries,
    promotions,
    obsoleteRemindersCancelled,
    scheduled,
    outboxClaimed: outboxClaim.data?.length ?? 0,
    materialized,
    webhookReconciliation,
    deliveriesClaimed: deliveryClaim.data?.length ?? 0,
    deliveryOutcomes: delivered,
  };
}

export async function retryCanonicalDelivery(
  deliveryId: string,
  actorId: string,
  now = new Date(),
) {
  const result = await (notificationDatabase as any).rpc("admin_retry_notification_delivery", {
    p_actor_id: actorId,
    p_delivery_id: deliveryId,
    p_now: now.toISOString(),
  });
  if (result.error) throw result.error;
  if (result.data !== true) throw new Error("delivery_not_retryable");
  return { ok: true };
}
