import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getIsraelNowParts, getNextAllowedSendTime } from "@/lib/notificationDelivery";
import {
  decideMemberNotificationDelivery,
  type MemberNotificationCategory,
  type MemberNotificationPreferences,
} from "@/lib/memberNotificationPolicy";
import { safeNotificationActionUrl } from "@/lib/memberNotificationsApi";
import { readMemberNotificationPreferences } from "@/lib/memberNotificationPreferences";
import { isApnsConfigured, sendApnsAlert } from "@/lib/apns.server";

type RelatedIds = {
  bookingId?: string | null;
  classId?: string | null;
  paymentId?: string | null;
  memberPlanId?: string | null;
  campaignId?: string | null;
  promotionId?: string | null;
};

export type EnqueueMemberNotificationInput = {
  memberId: string;
  category: MemberNotificationCategory;
  title: string;
  body: string;
  actionUrl?: string | null;
  idempotencyKey: string;
  relatedIds?: RelatedIds;
  expiresAt?: Date | string | null;
  now?: Date;
};

const MARKETING_CATEGORIES: MemberNotificationCategory[] = [
  "activation",
  "marketing",
  "retention",
  "schedule",
];

const DEFAULT_PREFERENCES: MemberNotificationPreferences = {
  pushEnabled: true,
  lessonReminders: true,
  scheduleUpdates: true,
  packageReminders: true,
  marketing: false,
  sound: true,
};

function preferencesFromRow(row: any): MemberNotificationPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  return {
    pushEnabled: row.push_enabled !== false,
    lessonReminders: Boolean(row.lesson_reminders),
    scheduleUpdates: Boolean(row.schedule_updates),
    packageReminders: Boolean(row.package_reminders),
    marketing: Boolean(row.marketing),
    sound: Boolean(row.sound),
  };
}

function memberQuietHours(now: Date) {
  const { hour, minute } = getIsraelNowParts(now);
  const value = hour * 60 + minute;
  return value < 8 * 60 + 30 || value >= 21 * 60;
}

function nextMemberSendTime(now: Date) {
  return getNextAllowedSendTime({
    now,
    timezone: "Asia/Jerusalem",
    startHour: 8,
    startMinute: 30,
    endHour: 21,
    endMinute: 0,
  });
}

function invalidDeviceToken(error: string) {
  return /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/i.test(error);
}

function apnsErrorText(result: { ok: false; error?: string; skipped?: string }) {
  return result.error ?? result.skipped ?? "apns_delivery_failed";
}

async function deliverNotification(row: any, tokens: Array<{ id: string; token: string }>) {
  const db = supabaseAdmin as any;
  const attemptCount = Number(row.attempt_count ?? 0) + 1;
  const attemptedAt = new Date();
  const { data: claim, error: claimError } = await db
    .from("member_notifications")
    .update({
      delivery_status: "sending",
      attempt_count: attemptCount,
      last_attempt_at: attemptedAt.toISOString(),
    })
    .eq("id", row.id)
    .eq("delivery_status", "queued")
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claim) {
    return {
      sent: 0,
      failed: 0,
      missingConfig: false,
      alreadyClaimed: true,
      retryScheduled: false,
    };
  }

  if (!isApnsConfigured()) {
    await db
      .from("member_notifications")
      .update({ delivery_status: "failed", suppression_reason: "missing_apns_config" })
      .eq("id", row.id)
      .eq("delivery_status", "sending");
    return {
      sent: 0,
      failed: tokens.length,
      missingConfig: true,
      alreadyClaimed: false,
      retryScheduled: false,
    };
  }

  const { count } = await db
    .from("member_notifications")
    .select("id", { count: "exact", head: true })
    .eq("member_id", row.member_id)
    .is("read_at", null);
  const results = await Promise.all(
    tokens.map(async (device) => ({
      device,
      result: await sendApnsAlert(device.token, {
        title: row.title,
        body: row.body,
        url: safeNotificationActionUrl(row.action_url),
        sound: row.sound,
        badge: count ?? 1,
        notificationId: row.id,
        campaignId: row.campaign_id ?? undefined,
      }),
    })),
  );

  const successes = results.filter(({ result }) => result.ok);
  const failures = results.filter(({ result }) => !result.ok);
  await Promise.all(
    failures.map(({ device, result }) => {
      if (result.ok || !invalidDeviceToken(apnsErrorText(result))) return Promise.resolve();
      return db
        .from("member_push_tokens")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", device.id);
    }),
  );

  const firstSuccess = successes[0]?.result;
  const errorText = failures
    .map(({ result }) => (result.ok ? "" : apnsErrorText(result)))
    .filter(Boolean)
    .join("; ")
    .slice(0, 1000);
  const now = new Date().toISOString();
  const retryScheduled =
    successes.length === 0 &&
    failures.some(({ result }) => !result.ok && !invalidDeviceToken(apnsErrorText(result))) &&
    attemptCount < 3;
  const retryAt = retryScheduled
    ? new Date(attemptedAt.getTime() + [5, 15, 30][attemptCount - 1] * 60_000)
    : null;
  await db
    .from("member_notifications")
    .update({
      delivery_status: successes.length ? "sent" : retryScheduled ? "queued" : "failed",
      sent_at: successes.length ? now : null,
      apns_id: firstSuccess?.ok ? firstSuccess.apnsId : null,
      suppression_reason: errorText || null,
      scheduled_for: retryAt?.toISOString() ?? row.scheduled_for,
      next_attempt_at: retryAt?.toISOString() ?? null,
    })
    .eq("id", row.id)
    .eq("delivery_status", "sending");

  return {
    sent: successes.length,
    failed: failures.length,
    missingConfig: false,
    alreadyClaimed: false,
    retryScheduled,
  };
}

export async function enqueueMemberNotification(input: EnqueueMemberNotificationInput) {
  const db = supabaseAdmin as any;
  const now = input.now ?? new Date();
  const title = input.title.trim();
  const body = input.body.trim();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const isMarketing = MARKETING_CATEGORIES.includes(input.category);

  const [preferencesResult, devicesResult, weekResult, dayResult, repeatResult, duplicateResult] =
    await Promise.all([
      readMemberNotificationPreferences(db, input.memberId),
      db
        .from("member_push_tokens")
        .select("id,token")
        .eq("member_id", input.memberId)
        .eq("active", true),
      isMarketing
        ? db
            .from("member_notifications")
            .select("id", { count: "exact", head: true })
            .eq("member_id", input.memberId)
            .in("category", MARKETING_CATEGORIES)
            .in("delivery_status", ["queued", "sending", "sent", "delivered"])
            .gte("created_at", weekAgo)
        : Promise.resolve({ count: 0, error: null }),
      isMarketing
        ? db
            .from("member_notifications")
            .select("id", { count: "exact", head: true })
            .eq("member_id", input.memberId)
            .in("category", MARKETING_CATEGORIES)
            .in("delivery_status", ["queued", "sending", "sent", "delivered"])
            .gte("created_at", dayAgo)
        : Promise.resolve({ count: 0, error: null }),
      isMarketing
        ? db
            .from("member_notifications")
            .select("id", { count: "exact", head: true })
            .eq("member_id", input.memberId)
            .eq("category", input.category)
            .eq("title", title)
            .eq("body", body)
            .in("delivery_status", ["queued", "sending", "sent", "delivered"])
            .gte("created_at", weekAgo)
        : Promise.resolve({ count: 0, error: null }),
      db
        .from("member_notifications")
        .select("id")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle(),
    ]);

  for (const result of [
    preferencesResult,
    devicesResult,
    weekResult,
    dayResult,
    repeatResult,
    duplicateResult,
  ]) {
    if (result.error) throw result.error;
  }

  if (duplicateResult.data) {
    return { ok: true as const, duplicate: true as const, notificationId: duplicateResult.data.id };
  }

  const tokens = (devicesResult.data ?? []) as Array<{ id: string; token: string }>;
  const decision = decideMemberNotificationDelivery({
    category: input.category,
    preferences: preferencesFromRow(preferencesResult.data),
    hasActivePushDevice: tokens.length > 0,
    isQuietHours: memberQuietHours(now),
    marketingPushesLast7Days: weekResult.count ?? 0,
    marketingPushesToday: dayResult.count ?? 0,
    duplicateWithin7Days: (repeatResult.count ?? 0) > 0,
  });
  if (!decision.createInboxItem) {
    return {
      ok: true as const,
      duplicate: false as const,
      notificationId: null,
      decision,
      delivery: null,
    };
  }
  const scheduledFor = decision.deferredByQuietHours ? nextMemberSendTime(now) : now;
  const deliveryStatus = decision.sendPush
    ? "queued"
    : decision.deferredByQuietHours
      ? "queued"
      : decision.suppressedReason === "no_active_push_device" ||
          decision.suppressedReason === "channel_policy"
        ? "inbox"
        : "suppressed";
  const { data: notification, error: insertError } = await db
    .from("member_notifications")
    .insert({
      member_id: input.memberId,
      category: input.category,
      title,
      body,
      action_url: safeNotificationActionUrl(input.actionUrl),
      sound: decision.pushSound,
      campaign_id: input.relatedIds?.campaignId ?? null,
      promotion_id: input.relatedIds?.promotionId ?? null,
      related_booking_id: input.relatedIds?.bookingId ?? null,
      related_class_id: input.relatedIds?.classId ?? null,
      related_payment_id: input.relatedIds?.paymentId ?? null,
      related_member_plan_id: input.relatedIds?.memberPlanId ?? null,
      delivery_status: deliveryStatus,
      suppression_reason: decision.suppressedReason,
      idempotency_key: input.idempotencyKey,
      scheduled_for: scheduledFor.toISOString(),
      expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    })
    .select("*")
    .single();
  if (insertError) throw insertError;

  if (decision.sendPush) {
    const delivery = await deliverNotification(notification, tokens);
    return {
      ok: true as const,
      duplicate: false as const,
      notificationId: notification.id,
      decision,
      delivery,
    };
  }

  return {
    ok: true as const,
    duplicate: false as const,
    notificationId: notification.id,
    decision,
    delivery: null,
  };
}

async function reevaluateQueuedNotification(
  row: any,
  tokens: Array<{ id: string; token: string }>,
  now: Date,
) {
  const db = supabaseAdmin as any;
  if (row.expires_at && new Date(row.expires_at) <= now) {
    await db
      .from("member_notifications")
      .update({ delivery_status: "suppressed", suppression_reason: "expired" })
      .eq("id", row.id)
      .eq("delivery_status", "queued");
    return null;
  }

  if (row.promotion_id) {
    const { data: campaign, error: campaignError } = await db
      .from("promotion_campaigns")
      .select("enabled,status")
      .eq("id", row.promotion_id)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign?.enabled || campaign.status !== "active") {
      await db
        .from("member_notifications")
        .update({ delivery_status: "suppressed", suppression_reason: "campaign_inactive" })
        .eq("id", row.id)
        .eq("delivery_status", "queued");
      await db
        .from("promotion_deliveries")
        .update({
          status: "skipped",
          error_message: "campaign_inactive",
          updated_at: now.toISOString(),
        })
        .eq("promotion_id", row.promotion_id)
        .eq("member_id", row.member_id)
        .eq("channel", "push")
        .eq("status", "queued");
      return null;
    }
  }

  const isMarketing = MARKETING_CATEGORIES.includes(row.category);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const [preferencesResult, weekResult, dayResult, repeatResult] = await Promise.all([
    readMemberNotificationPreferences(db, row.member_id),
    isMarketing
      ? db
          .from("member_notifications")
          .select("id", { count: "exact", head: true })
          .eq("member_id", row.member_id)
          .neq("id", row.id)
          .in("category", MARKETING_CATEGORIES)
          .in("delivery_status", ["queued", "sending", "sent", "delivered"])
          .gte("created_at", weekAgo)
      : Promise.resolve({ count: 0, error: null }),
    isMarketing
      ? db
          .from("member_notifications")
          .select("id", { count: "exact", head: true })
          .eq("member_id", row.member_id)
          .neq("id", row.id)
          .in("category", MARKETING_CATEGORIES)
          .in("delivery_status", ["queued", "sending", "sent", "delivered"])
          .gte("created_at", dayAgo)
      : Promise.resolve({ count: 0, error: null }),
    isMarketing
      ? db
          .from("member_notifications")
          .select("id", { count: "exact", head: true })
          .eq("member_id", row.member_id)
          .neq("id", row.id)
          .eq("category", row.category)
          .eq("title", row.title)
          .eq("body", row.body)
          .in("delivery_status", ["queued", "sending", "sent", "delivered"])
          .gte("created_at", weekAgo)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  for (const result of [preferencesResult, weekResult, dayResult, repeatResult]) {
    if (result.error) throw result.error;
  }

  const decision = decideMemberNotificationDelivery({
    category: row.category,
    preferences: preferencesFromRow(preferencesResult.data),
    hasActivePushDevice: tokens.length > 0,
    isQuietHours: memberQuietHours(now),
    marketingPushesLast7Days: weekResult.count ?? 0,
    marketingPushesToday: dayResult.count ?? 0,
    duplicateWithin7Days: (repeatResult.count ?? 0) > 0,
  });
  if (!decision.sendPush) {
    const keepQueued = decision.deferredByQuietHours;
    await db
      .from("member_notifications")
      .update({
        delivery_status: keepQueued
          ? "queued"
          : decision.suppressedReason === "no_active_push_device"
            ? "inbox"
            : "suppressed",
        suppression_reason: decision.suppressedReason,
        scheduled_for: keepQueued ? nextMemberSendTime(now).toISOString() : row.scheduled_for,
      })
      .eq("id", row.id)
      .eq("delivery_status", "queued");
    return null;
  }

  await db
    .from("member_notifications")
    .update({ sound: decision.pushSound, suppression_reason: null })
    .eq("id", row.id)
    .eq("delivery_status", "queued");
  return { ...row, sound: decision.pushSound };
}

export async function deliverQueuedMemberNotifications(input?: { limit?: number; now?: Date }) {
  const db = supabaseAdmin as any;
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(100, Math.trunc(input?.limit ?? 50)));
  const staleBefore = new Date(now.getTime() - 10 * 60_000).toISOString();
  const { error: recoveryError } = await db
    .from("member_notifications")
    .update({
      delivery_status: "queued",
      scheduled_for: now.toISOString(),
      suppression_reason: "stale_sending_recovered",
    })
    .eq("delivery_status", "sending")
    .lt("last_attempt_at", staleBefore);
  if (recoveryError) throw recoveryError;
  const { data: rows, error } = await db
    .from("member_notifications")
    .select("*")
    .eq("delivery_status", "queued")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const { data: tokens, error: tokenError } = await db
      .from("member_push_tokens")
      .select("id,token")
      .eq("member_id", row.member_id)
      .eq("active", true);
    if (tokenError) throw tokenError;
    const ready = await reevaluateQueuedNotification(row, tokens ?? [], now);
    if (!ready) continue;
    const delivery = await deliverNotification(ready, tokens ?? []);
    sent += delivery.sent;
    failed += delivery.failed;
  }

  return { scanned: rows?.length ?? 0, sent, failed };
}
