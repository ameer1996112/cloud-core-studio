import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getIsraelNowParts, getNextAllowedSendTime } from "@/lib/notificationDelivery";
import {
  decideMemberNotificationDelivery,
  type MemberNotificationCategory,
  type MemberNotificationPreferences,
} from "@/lib/memberNotificationPolicy";
import { safeNotificationActionUrl } from "@/lib/memberNotificationsApi";
import { isApnsConfigured, sendApnsAlert } from "@/lib/apns.server";

type RelatedIds = {
  bookingId?: string | null;
  classId?: string | null;
  paymentId?: string | null;
  memberPlanId?: string | null;
  campaignId?: string | null;
};

export type EnqueueMemberNotificationInput = {
  memberId: string;
  category: MemberNotificationCategory;
  title: string;
  body: string;
  actionUrl?: string | null;
  idempotencyKey: string;
  relatedIds?: RelatedIds;
  now?: Date;
};

const MARKETING_CATEGORIES: MemberNotificationCategory[] = [
  "activation",
  "marketing",
  "retention",
  "schedule",
];

const DEFAULT_PREFERENCES: MemberNotificationPreferences = {
  lessonReminders: true,
  scheduleUpdates: true,
  packageReminders: true,
  marketing: false,
  sound: true,
};

function preferencesFromRow(row: any): MemberNotificationPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  return {
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
  const { data: claim, error: claimError } = await db
    .from("member_notifications")
    .update({ delivery_status: "sending" })
    .eq("id", row.id)
    .eq("delivery_status", "queued")
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claim) return { sent: 0, failed: 0, missingConfig: false, alreadyClaimed: true };

  if (!isApnsConfigured()) {
    await db
      .from("member_notifications")
      .update({ delivery_status: "failed", suppression_reason: "missing_apns_config" })
      .eq("id", row.id);
    return { sent: 0, failed: tokens.length, missingConfig: true, alreadyClaimed: false };
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
  await db
    .from("member_notifications")
    .update({
      delivery_status: successes.length ? "sent" : "failed",
      sent_at: successes.length ? now : null,
      apns_id: firstSuccess?.ok ? firstSuccess.apnsId : null,
      suppression_reason: errorText || null,
    })
    .eq("id", row.id);

  return {
    sent: successes.length,
    failed: failures.length,
    missingConfig: false,
    alreadyClaimed: false,
  };
}

export async function enqueueMemberNotification(input: EnqueueMemberNotificationInput) {
  const db = supabaseAdmin as any;
  const now = input.now ?? new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const isMarketing = MARKETING_CATEGORIES.includes(input.category);

  const [preferencesResult, devicesResult, weekResult, dayResult, duplicateResult] =
    await Promise.all([
      db
        .from("member_notification_preferences")
        .select("lesson_reminders,schedule_updates,package_reminders,marketing,sound")
        .eq("member_id", input.memberId)
        .maybeSingle(),
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
            .gte("sent_at", weekAgo)
        : Promise.resolve({ count: 0, error: null }),
      isMarketing
        ? db
            .from("member_notifications")
            .select("id", { count: "exact", head: true })
            .eq("member_id", input.memberId)
            .in("category", MARKETING_CATEGORIES)
            .gte("sent_at", dayAgo)
        : Promise.resolve({ count: 0, error: null }),
      db
        .from("member_notifications")
        .select("id")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle(),
    ]);

  for (const result of [preferencesResult, devicesResult, weekResult, dayResult, duplicateResult]) {
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
    duplicateWithin7Days: false,
  });
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
      title: input.title.trim(),
      body: input.body.trim(),
      action_url: safeNotificationActionUrl(input.actionUrl),
      sound: decision.pushSound,
      campaign_id: input.relatedIds?.campaignId ?? null,
      related_booking_id: input.relatedIds?.bookingId ?? null,
      related_class_id: input.relatedIds?.classId ?? null,
      related_payment_id: input.relatedIds?.paymentId ?? null,
      related_member_plan_id: input.relatedIds?.memberPlanId ?? null,
      delivery_status: deliveryStatus,
      suppression_reason: decision.suppressedReason,
      idempotency_key: input.idempotencyKey,
      scheduled_for: scheduledFor.toISOString(),
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

export async function deliverQueuedMemberNotifications(input?: { limit?: number; now?: Date }) {
  const db = supabaseAdmin as any;
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(100, Math.trunc(input?.limit ?? 50)));
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
    if (!tokens?.length) {
      await db
        .from("member_notifications")
        .update({ delivery_status: "inbox", suppression_reason: "no_active_push_device" })
        .eq("id", row.id);
      continue;
    }
    const delivery = await deliverNotification(row, tokens);
    sent += delivery.sent;
    failed += delivery.failed;
  }

  return { scanned: rows?.length ?? 0, sent, failed };
}
