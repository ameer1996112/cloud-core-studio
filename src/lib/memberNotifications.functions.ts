import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  memberNotificationIdSchema,
  memberNotificationPreferencesSchema,
  memberPushTokenSchema,
  safeNotificationActionUrl,
} from "@/lib/memberNotificationsApi";

const DEFAULT_PREFERENCES = {
  lessonReminders: true,
  scheduleUpdates: true,
  packageReminders: true,
  marketing: false,
  sound: true,
};

async function requireMember(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.role !== "member") throw new Error("Member access required");
  return db;
}

function mapPreferences(row: any) {
  if (!row) return DEFAULT_PREFERENCES;
  return {
    lessonReminders: Boolean(row.lesson_reminders),
    scheduleUpdates: Boolean(row.schedule_updates),
    packageReminders: Boolean(row.package_reminders),
    marketing: Boolean(row.marketing),
    sound: Boolean(row.sound),
  };
}

export const getMemberNotificationCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireMember(context.userId);
    const [preferencesResult, devicesResult, notificationsResult] = await Promise.all([
      db
        .from("member_notification_preferences")
        .select("lesson_reminders,schedule_updates,package_reminders,marketing,sound")
        .eq("member_id", context.userId)
        .maybeSingle(),
      db.from("member_push_tokens").select("id").eq("member_id", context.userId).eq("active", true),
      db
        .from("member_notifications")
        .select(
          "id,category,title,body,action_url,sound,campaign_id,delivery_status,read_at,opened_at,created_at",
        )
        .eq("member_id", context.userId)
        .neq("delivery_status", "suppressed")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (preferencesResult.error) throw preferencesResult.error;
    if (devicesResult.error) throw devicesResult.error;
    if (notificationsResult.error) throw notificationsResult.error;

    if (!preferencesResult.data) {
      const { error } = await db
        .from("member_notification_preferences")
        .upsert({ member_id: context.userId }, { onConflict: "member_id" });
      if (error) throw error;
    }

    const notifications = (notificationsResult.data ?? []).map((row: any) => ({
      ...row,
      action_url: safeNotificationActionUrl(row.action_url),
    }));

    return {
      preferences: mapPreferences(preferencesResult.data),
      hasActiveDevice: Boolean(devicesResult.data?.length),
      unreadCount: notifications.filter((row: any) => !row.read_at).length,
      notifications,
    };
  });

export const registerMemberPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => memberPushTokenSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireMember(context.userId);
    const now = new Date().toISOString();
    const { error } = await db.from("member_push_tokens").upsert(
      {
        member_id: context.userId,
        token: data.token,
        platform: data.platform,
        active: true,
        permission_status: "granted",
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "token" },
    );
    if (error) throw error;
    return { ok: true as const };
  });

export const updateMemberNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => memberNotificationPreferencesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireMember(context.userId);
    const { error } = await db.from("member_notification_preferences").upsert(
      {
        member_id: context.userId,
        lesson_reminders: data.lessonReminders,
        schedule_updates: data.scheduleUpdates,
        package_reminders: data.packageReminders,
        marketing: data.marketing,
        sound: data.sound,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" },
    );
    if (error) throw error;
    return { ok: true as const, preferences: data };
  });

export const markMemberNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => memberNotificationIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireMember(context.userId);
    const now = new Date().toISOString();
    const { data: existing, error: findError } = await db
      .from("member_notifications")
      .select("id,campaign_id,opened_at")
      .eq("id", data.notificationId)
      .eq("member_id", context.userId)
      .maybeSingle();
    if (findError) throw findError;
    if (!existing) return { ok: false };
    const { data: updated, error } = await db
      .from("member_notifications")
      .update({ read_at: now, opened_at: now })
      .eq("id", data.notificationId)
      .eq("member_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (updated && existing.campaign_id && !existing.opened_at) {
      const { error: metricError } = await db.rpc("increment_notification_campaign_metric", {
        p_campaign_id: existing.campaign_id,
        p_metric: "opened",
      });
      if (metricError) console.warn("notification_campaign_open_metric_failed", metricError);
    }
    return { ok: Boolean(updated) };
  });

export const markAllMemberNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({}).parse(data ?? {}))
  .handler(async ({ context }) => {
    const db = await requireMember(context.userId);
    const { error } = await db
      .from("member_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("member_id", context.userId)
      .is("read_at", null);
    if (error) throw error;
    return { ok: true as const };
  });

export const recordMemberNotificationCampaignBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ campaignId: z.string().uuid(), bookingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await requireMember(context.userId);
    const cutoff = new Date(Date.now() - 72 * 60 * 60_000).toISOString();
    const [notificationResult, bookingResult] = await Promise.all([
      db
        .from("member_notifications")
        .select("id")
        .eq("member_id", context.userId)
        .eq("campaign_id", data.campaignId)
        .not("opened_at", "is", null)
        .gte("opened_at", cutoff)
        .limit(1),
      db
        .from("bookings")
        .select("id")
        .eq("id", data.bookingId)
        .eq("member_id", context.userId)
        .maybeSingle(),
    ]);
    if (notificationResult.error) throw notificationResult.error;
    if (bookingResult.error) throw bookingResult.error;
    if (!notificationResult.data?.length || !bookingResult.data) {
      return { ok: false as const, skipped: "not_attributable" as const };
    }

    const { data: conversion, error } = await db
      .from("notification_campaign_conversions")
      .upsert(
        {
          campaign_id: data.campaignId,
          member_id: context.userId,
          booking_id: data.bookingId,
        },
        { onConflict: "campaign_id,member_id,booking_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!conversion) return { ok: true as const, duplicate: true as const };

    const { error: metricError } = await db.rpc("increment_notification_campaign_metric", {
      p_campaign_id: data.campaignId,
      p_metric: "booked",
    });
    if (metricError) throw metricError;
    return { ok: true as const, duplicate: false as const };
  });
