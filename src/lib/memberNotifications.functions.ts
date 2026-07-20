import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  memberNotificationIdSchema,
  memberNotificationPreferencesSchema,
  memberPushTokenSchema,
  safeNotificationActionUrl,
} from "@/lib/memberNotificationsApi";
import {
  mapMemberNotificationPreferences,
  readMemberNotificationPreferences,
} from "@/lib/memberNotificationPreferences";

async function requireMember(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.role !== "member") throw new Error("Member access required");
  return db;
}

function canonicalReadsEnabled() {
  return process.env.MESSAGING_CANONICAL_READS_ENABLED?.trim().toLowerCase() === "true";
}

function canonicalCategory(eventType: string | null) {
  if (eventType === "payment_confirmed" || eventType === "payment_failed") return eventType;
  if (eventType === "waitlist_joined" || eventType === "waitlist_spot_available") return "waitlist";
  if (eventType === "class_cancelled_by_admin" || eventType === "class_time_changed") {
    return "urgent_class_change";
  }
  if (eventType?.startsWith("class_reminder")) return "lesson_reminder";
  return "schedule";
}

export const getMemberNotificationCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireMember(context.userId);
    const [preferencesResult, devicesResult, notificationsResult] = await Promise.all([
      readMemberNotificationPreferences(db, context.userId),
      db.from("member_push_tokens").select("id").eq("member_id", context.userId).eq("active", true),
      canonicalReadsEnabled()
        ? db
            .from("messages")
            .select(
              "id,event_type,subject,body,content,created_at,message_deliveries!inner(channel,status,read_at)",
            )
            .eq("member_id", context.userId)
            .eq("member_visible", true)
            .eq("direction", "outbound")
            .eq("message_deliveries.channel", "in_app")
            .neq("message_deliveries.status", "suppressed")
            .order("created_at", { ascending: false })
            .limit(100)
        : db
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

    const notifications = canonicalReadsEnabled()
      ? (notificationsResult.data ?? []).map((row: any) => {
          const delivery = Array.isArray(row.message_deliveries)
            ? row.message_deliveries[0]
            : row.message_deliveries;
          const content = row.content && typeof row.content === "object" ? row.content : {};
          return {
            id: row.id,
            category: canonicalCategory(row.event_type),
            title: row.subject ?? "Cloud & Core",
            body: row.body ?? "",
            action_url: safeNotificationActionUrl(content.action_url ?? content.receipt_url),
            sound: false,
            campaign_id: content.campaign_id ?? null,
            delivery_status: delivery?.status ?? "delivered",
            read_at: delivery?.read_at ?? null,
            opened_at: delivery?.read_at ?? null,
            created_at: row.created_at,
          };
        })
      : (notificationsResult.data ?? []).map((row: any) => ({
          ...row,
          action_url: safeNotificationActionUrl(row.action_url),
        }));

    return {
      preferences: mapMemberNotificationPreferences(preferencesResult.data),
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

export const deactivateMemberPushTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const db = await requireMember(context.userId);
    const { error } = await db
      .from("member_push_tokens")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("member_id", context.userId)
      .eq("token", data.token)
      .eq("active", true);
    if (error) throw error;
    return { ok: true as const };
  });

export const updateMemberNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => memberNotificationPreferencesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireMember(context.userId);
    const preferenceUpdate: Record<string, unknown> = {
      member_id: context.userId,
      lesson_reminders: data.lessonReminders,
      schedule_updates: data.scheduleUpdates,
      package_reminders: data.packageReminders,
      marketing: data.marketing,
      sound: data.sound,
      updated_at: new Date().toISOString(),
    };
    if (data.whatsappEnabled != null) {
      preferenceUpdate.whatsapp_enabled = data.whatsappEnabled;
      preferenceUpdate.whatsapp_opted_out_at = data.whatsappEnabled
        ? null
        : new Date().toISOString();
      preferenceUpdate.whatsapp_consent_source = "member_notification_settings";
      if (data.whatsappEnabled) preferenceUpdate.whatsapp_consented_at = new Date().toISOString();
    }
    if (data.emailEnabled != null) {
      preferenceUpdate.email_enabled = data.emailEnabled;
      preferenceUpdate.email_opted_out_at = data.emailEnabled ? null : new Date().toISOString();
      preferenceUpdate.email_consent_source = "member_notification_settings";
      if (data.emailEnabled) preferenceUpdate.email_consented_at = new Date().toISOString();
    }
    const { error } = await db
      .from("member_notification_preferences")
      .upsert(preferenceUpdate, { onConflict: "member_id" });
    if (error) throw error;
    return { ok: true as const, preferences: data };
  });

export const markMemberNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => memberNotificationIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireMember(context.userId);
    const now = new Date().toISOString();
    if (canonicalReadsEnabled()) {
      const message = await db
        .from("messages")
        .select("id")
        .eq("id", data.notificationId)
        .eq("member_id", context.userId)
        .eq("member_visible", true)
        .maybeSingle();
      if (message.error) throw message.error;
      if (!message.data) return { ok: false };
      const updated = await db
        .from("message_deliveries")
        .update({ status: "read", read_at: now, updated_at: now })
        .eq("message_id", data.notificationId)
        .eq("channel", "in_app");
      if (updated.error) throw updated.error;
      return { ok: true };
    }
    const { data: existing, error: findError } = await db
      .from("member_notifications")
      .select("id,campaign_id")
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
      .is("opened_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (updated && existing.campaign_id) {
      const { error: metricError } = await db.rpc("increment_notification_campaign_metric", {
        p_campaign_id: existing.campaign_id,
        p_metric: "opened",
      });
      if (metricError) console.warn("notification_campaign_open_metric_failed", metricError);
    }
    return { ok: true };
  });

export const markAllMemberNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({}).parse(data ?? {}))
  .handler(async ({ context }) => {
    const db = await requireMember(context.userId);
    if (canonicalReadsEnabled()) {
      const messages = await db
        .from("messages")
        .select("id")
        .eq("member_id", context.userId)
        .eq("member_visible", true);
      if (messages.error) throw messages.error;
      const ids = (messages.data ?? []).map((message: { id: string }) => message.id);
      if (ids.length) {
        const now = new Date().toISOString();
        const result = await db
          .from("message_deliveries")
          .update({ status: "read", read_at: now, updated_at: now })
          .in("message_id", ids)
          .eq("channel", "in_app")
          .is("read_at", null);
        if (result.error) throw result.error;
      }
      return { ok: true as const };
    }
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
