import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminNotificationCampaignSchema,
  campaignAudienceSchema,
  selectCampaignAudience,
  type CampaignAudience,
  type CampaignAudienceMember,
} from "@/lib/adminNotificationCampaigns";
import { normalizeMemberNotificationLanguage } from "@/lib/memberNotificationCopy";
import type { MemberNotificationCategory } from "@/lib/memberNotificationPolicy";

const campaignCategorySchema = z.enum(["activation", "marketing", "retention", "schedule"]);

type AudienceMember = {
  id: string;
  name: string;
  preferred_language: string | null;
  remaining_credits: number;
  last_visit_at: string | null;
};

type AudiencePreference = {
  member_id: string;
  schedule_updates: boolean;
  marketing: boolean;
};

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data?.role !== "admin") throw new Error("Admin access required");
  return db;
}

async function buildCampaignAudience(input: {
  db: any;
  audience: CampaignAudience;
  category: MemberNotificationCategory;
  now: Date;
}) {
  const weekAgo = new Date(input.now.getTime() - 7 * 86_400_000).toISOString();
  const dayAgo = new Date(input.now.getTime() - 24 * 60 * 60_000).toISOString();
  const expiryHorizon = new Date(input.now.getTime() + 7 * 86_400_000).toISOString();
  const [
    membersResult,
    bookingsResult,
    plansResult,
    preferencesResult,
    devicesResult,
    recentResult,
  ] = await Promise.all([
    input.db
      .from("members")
      .select("id,name,preferred_language,remaining_credits,last_visit_at")
      .eq("status", "active")
      .order("name", { ascending: true }),
    input.db
      .from("bookings")
      .select("member_id,status,class:classes(starts_at,status)")
      .in("status", ["booked", "checked_in", "attended", "no_show"])
      .limit(5000),
    input.db
      .from("member_plans")
      .select("member_id,expires_at")
      .eq("status", "active")
      .gte("expires_at", input.now.toISOString())
      .lte("expires_at", expiryHorizon),
    input.db
      .from("member_notification_preferences")
      .select("member_id,lesson_reminders,schedule_updates,package_reminders,marketing"),
    input.db.from("member_push_tokens").select("member_id").eq("active", true),
    input.db
      .from("member_notifications")
      .select("member_id,sent_at")
      .in("category", ["activation", "marketing", "retention", "schedule"])
      .gte("sent_at", weekAgo),
  ]);

  for (const result of [
    membersResult,
    bookingsResult,
    plansResult,
    preferencesResult,
    devicesResult,
    recentResult,
  ]) {
    if (result.error) throw result.error;
  }

  const bookings = bookingsResult.data ?? [];
  const bookedMemberIds = new Set<string>(bookings.map((booking: any) => booking.member_id));
  const upcomingMemberIds = new Set<string>(
    bookings
      .filter((booking: any) => {
        const cls = Array.isArray(booking.class) ? booking.class[0] : booking.class;
        return (
          ["booked", "checked_in"].includes(booking.status) &&
          cls?.status !== "cancelled" &&
          cls?.starts_at &&
          new Date(cls.starts_at) > input.now
        );
      })
      .map((booking: any) => booking.member_id),
  );
  const expiringMemberIds = new Set<string>(
    (plansResult.data ?? []).map((plan: any) => plan.member_id),
  );
  const candidateMembers: Array<
    CampaignAudienceMember & { name: string; preferred_language: string | null }
  > = (membersResult.data ?? []).map((member: AudienceMember) => ({
    ...member,
    remainingCredits: member.remaining_credits,
    lastVisitAt: member.last_visit_at,
  }));
  const selected = selectCampaignAudience<(typeof candidateMembers)[number]>({
    members: candidateMembers,
    audience: input.audience,
    bookedMemberIds,
    upcomingMemberIds,
    expiringMemberIds,
    now: input.now,
  });

  const preferences = new Map<string, AudiencePreference>(
    ((preferencesResult.data ?? []) as AudiencePreference[]).map((row) => [row.member_id, row]),
  );
  const activeDevices = new Set<string>(
    (devicesResult.data ?? []).map((row: any) => row.member_id),
  );
  const weeklyCounts = new Map<string, number>();
  const dailyCounts = new Map<string, number>();
  for (const row of recentResult.data ?? []) {
    weeklyCounts.set(row.member_id, (weeklyCounts.get(row.member_id) ?? 0) + 1);
    if (row.sent_at && row.sent_at >= dayAgo) {
      dailyCounts.set(row.member_id, (dailyCounts.get(row.member_id) ?? 0) + 1);
    }
  }

  const excluded = {
    noActiveDevice: 0,
    preferenceDisabled: 0,
    frequencyLimited: 0,
  };
  const eligible = selected.filter((member) => {
    if (!activeDevices.has(member.id)) {
      excluded.noActiveDevice += 1;
      return false;
    }
    const preference = preferences.get(member.id);
    const preferenceEnabled =
      input.category === "schedule" ? preference?.schedule_updates : preference?.marketing;
    if (!preferenceEnabled) {
      excluded.preferenceDisabled += 1;
      return false;
    }
    if ((weeklyCounts.get(member.id) ?? 0) >= 3 || (dailyCounts.get(member.id) ?? 0) >= 1) {
      excluded.frequencyLimited += 1;
      return false;
    }
    return true;
  });

  return {
    selectedCount: selected.length,
    eligibleCount: eligible.length,
    excluded,
    members: eligible.map((member) => ({
      id: member.id,
      name: member.name,
      preferredLanguage: normalizeMemberNotificationLanguage(member.preferred_language),
    })),
  };
}

export const previewAdminNotificationCampaignAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ audience: campaignAudienceSchema, category: campaignCategorySchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.userId);
    return buildCampaignAudience({ ...data, db, now: new Date() });
  });

export async function dispatchNotificationCampaign(campaignId: string, now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { enqueueMemberNotification } = await import("@/lib/memberNotificationDelivery.server");
  const { data: campaign, error } = await db
    .from("notification_campaigns")
    .update({ status: "sending", updated_at: now.toISOString() })
    .eq("id", campaignId)
    .in("status", ["draft", "scheduled"])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!campaign) {
    return { ok: false as const, skipped: "not_sendable" as const };
  }

  try {
    const audience = await buildCampaignAudience({
      db,
      audience: campaign.audience as CampaignAudience,
      category: campaign.category,
      now,
    });
    await db
      .from("notification_campaigns")
      .update({ recipient_count: audience.eligibleCount, updated_at: now.toISOString() })
      .eq("id", campaignId);

    let sent = 0;
    let queued = 0;
    let prepared = 0;
    const failures: Array<{ memberId: string; error: string }> = [];
    for (const member of audience.members) {
      const localized = campaign.localized_content?.[member.preferredLanguage];
      if (!localized?.title || !localized?.body) continue;
      try {
        const result = await enqueueMemberNotification({
          memberId: member.id,
          category: campaign.category,
          title: localized.title,
          body: localized.body,
          actionUrl: campaign.action_url,
          idempotencyKey: `campaign:${campaignId}:member:${member.id}:push`,
          relatedIds: { campaignId },
          now,
        });
        if (!result.duplicate) prepared += 1;
        if ((result.delivery?.sent ?? 0) > 0) sent += 1;
        if (
          result.decision?.deferredByQuietHours ||
          result.delivery?.alreadyClaimed ||
          result.delivery?.retryScheduled ||
          (result.decision?.sendPush && !result.delivery)
        ) {
          queued += 1;
        }
        if (
          (result.delivery?.failed ?? 0) > 0 &&
          (result.delivery?.sent ?? 0) === 0 &&
          !result.delivery?.retryScheduled
        ) {
          failures.push({ memberId: member.id, error: "apns_delivery_failed" });
        }
      } catch (memberError) {
        failures.push({
          memberId: member.id,
          error: memberError instanceof Error ? memberError.message : String(memberError),
        });
      }
    }

    const status =
      queued > 0 ? "sending" : failures.length || (prepared > 0 && sent === 0) ? "failed" : "sent";
    await db
      .from("notification_campaigns")
      .update({
        status,
        sent_count: sent,
        sent_at: status === "sending" ? null : now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", campaignId);
    return {
      ok: status !== "failed",
      status,
      prepared,
      queued,
      sent,
      audience,
      failures,
    };
  } catch (dispatchError) {
    await db
      .from("notification_campaigns")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", campaignId);
    throw dispatchError;
  }
}

export const createAdminNotificationCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => adminNotificationCampaignSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context.userId);
    const now = new Date();
    const sendAt = data.sendAt ? new Date(data.sendAt) : now;
    const scheduled = sendAt.getTime() > now.getTime() + 60_000;
    const { data: campaign, error } = await db
      .from("notification_campaigns")
      .insert({
        name: data.name,
        category: data.category,
        localized_content: data.localizedContent,
        action_url: data.actionUrl,
        audience: data.audience,
        scheduled_for: sendAt.toISOString(),
        status: scheduled ? "scheduled" : "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (scheduled) return { ok: true as const, scheduled: true as const, campaignId: campaign.id };
    const result = await dispatchNotificationCampaign(campaign.id, now);
    return { ok: result.ok, scheduled: false as const, campaignId: campaign.id, result };
  });

export const listAdminNotificationCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.userId);
    const { data, error } = await db
      .from("notification_campaigns")
      .select(
        "id,name,category,status,recipient_count,sent_count,opened_count,booked_count,scheduled_for,sent_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export async function dispatchDueNotificationCampaigns(input?: { now?: Date; limit?: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(25, Math.trunc(input?.limit ?? 10)));
  const { data, error } = await db
    .from("notification_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const results = [];
  for (const campaign of data ?? []) {
    results.push(await dispatchNotificationCampaign(campaign.id, now));
  }
  return { scanned: data?.length ?? 0, results };
}

export async function reconcileSendingNotificationCampaigns(now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: campaigns, error } = await db
    .from("notification_campaigns")
    .select("id")
    .eq("status", "sending")
    .limit(50);
  if (error) throw error;

  let completed = 0;
  for (const campaign of campaigns ?? []) {
    const { data: notifications, error: notificationError } = await db
      .from("member_notifications")
      .select("delivery_status")
      .eq("campaign_id", campaign.id);
    if (notificationError) throw notificationError;
    const statuses = (notifications ?? []).map(
      (row: { delivery_status: string }) => row.delivery_status,
    );
    if (statuses.some((status: string) => status === "queued" || status === "sending")) continue;
    const sent = statuses.filter(
      (status: string) => status === "sent" || status === "delivered",
    ).length;
    const failed = statuses.filter((status: string) => status === "failed").length;
    const status = failed > 0 || sent === 0 ? "failed" : "sent";
    const { error: updateError } = await db
      .from("notification_campaigns")
      .update({
        status,
        sent_count: sent,
        sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", campaign.id)
      .eq("status", "sending");
    if (updateError) throw updateError;
    completed += 1;
  }
  return { scanned: campaigns?.length ?? 0, completed };
}
