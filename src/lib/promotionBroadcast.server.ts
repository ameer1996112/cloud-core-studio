import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enqueueMemberNotification } from "@/lib/memberNotificationDelivery.server";
import {
  resolvePromotionDeliveryChannels,
  selectPromotionAudience,
  type PromotionAudience,
  type PromotionChannel,
} from "@/lib/promotionCampaigns";
import { sendOfficialWhatsappTemplateMessage } from "@/lib/officialWhatsapp.server";

function language(value: string | null | undefined): "he" | "ar" | "en" {
  return value === "ar" || value === "en" ? value : "he";
}

async function audienceForCampaign(db: any, campaign: any, now: Date) {
  const horizon = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const [members, bookings, plans, attendance, preferences, devices, recent] = await Promise.all([
    db
      .from("members")
      .select("id,name,phone,preferred_language,status,remaining_credits,last_visit_at,tags")
      .eq("status", "active"),
    db
      .from("bookings")
      .select("member_id,status,class:classes(starts_at,status)")
      .neq("status", "cancelled")
      .limit(10_000),
    db
      .from("member_plans")
      .select("member_id")
      .eq("status", "active")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", horizon),
    db
      .from("attendance_records")
      .select("member_id,status,class:classes(program_type_id)")
      .in("status", ["checked_in", "attended"])
      .limit(10_000),
    db
      .from("member_notification_preferences")
      .select("member_id,marketing,push_enabled,whatsapp_enabled"),
    db.from("member_push_tokens").select("member_id").eq("active", true),
    db
      .from("member_notifications")
      .select("member_id,sent_at")
      .in("category", ["activation", "marketing", "retention", "schedule"])
      .gte("sent_at", new Date(now.getTime() - 7 * 86_400_000).toISOString()),
  ]);
  for (const result of [members, bookings, plans, attendance, preferences, devices, recent]) {
    if (result.error) throw result.error;
  }
  const bookedMemberIds = new Set<string>((bookings.data ?? []).map((row: any) => row.member_id));
  const upcomingMemberIds = new Set<string>(
    (bookings.data ?? [])
      .filter((row: any) => {
        const cls = Array.isArray(row.class) ? row.class[0] : row.class;
        return cls?.status !== "cancelled" && cls?.starts_at && new Date(cls.starts_at) > now;
      })
      .map((row: any) => row.member_id),
  );
  const attended = new Map<string, Set<string>>();
  for (const row of attendance.data ?? []) {
    const cls = Array.isArray(row.class) ? row.class[0] : row.class;
    if (!cls?.program_type_id) continue;
    const set = attended.get(row.member_id) ?? new Set<string>();
    set.add(cls.program_type_id);
    attended.set(row.member_id, set);
  }
  const eligibleProgramTypeIds = (campaign.promotion_eligible_class_types ?? []).map(
    (row: any) => row.program_type_id,
  );
  const candidates = (members.data ?? [])
    .filter(
      (member: any) =>
        !member.tags?.some((tag: string) =>
          ["test", "staff", "service", "blocked", "deleted", "duplicate"].includes(tag),
        ),
    )
    .map((member: any) => ({
      ...member,
      remainingCredits: member.remaining_credits,
      lastVisitAt: member.last_visit_at,
    }));
  const selected = selectPromotionAudience({
    members: candidates,
    audience: campaign.audience as PromotionAudience,
    eligibleProgramTypeIds,
    attendedProgramTypeIdsByMember: attended,
    bookedMemberIds,
    upcomingMemberIds,
    expiringMemberIds: new Set((plans.data ?? []).map((row: any) => row.member_id)),
    now,
  });
  const preferenceByMember = new Map(
    (preferences.data ?? []).map((row: any) => [row.member_id, row]),
  );
  const deviceMembers = new Set((devices.data ?? []).map((row: any) => row.member_id));
  const today = new Date(now.getTime() - 86_400_000).toISOString();
  const counts = new Map<string, { day: number; week: number }>();
  for (const row of recent.data ?? []) {
    const value = counts.get(row.member_id) ?? { day: 0, week: 0 };
    value.week += 1;
    if (row.sent_at && row.sent_at >= today) value.day += 1;
    counts.set(row.member_id, value);
  }
  return selected.map((member: any) => ({
    ...member,
    preferences: preferenceByMember.get(member.id) ?? null,
    hasActivePushDevice: deviceMembers.has(member.id),
    contacts: counts.get(member.id) ?? { day: 0, week: 0 },
  }));
}

async function recordDelivery(db: any, input: Record<string, unknown>) {
  const { error } = await db
    .from("promotion_deliveries")
    .upsert(input, { onConflict: "promotion_id,member_id,channel" });
  if (error) throw error;
}

async function claimDelivery(
  db: any,
  input: { promotionId: string; memberId: string; channel: PromotionChannel; now: Date },
) {
  const row = {
    promotion_id: input.promotionId,
    member_id: input.memberId,
    channel: input.channel,
    status: "queued",
    updated_at: input.now.toISOString(),
  };
  const { data, error } = await db
    .from("promotion_deliveries")
    .upsert(row, {
      onConflict: "promotion_id,member_id,channel",
      ignoreDuplicates: true,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (data) return true;
  const { data: reclaimed, error: reclaimError } = await db
    .from("promotion_deliveries")
    .update({ status: "queued", error_message: null, updated_at: input.now.toISOString() })
    .eq("promotion_id", input.promotionId)
    .eq("member_id", input.memberId)
    .eq("channel", input.channel)
    .eq("status", "skipped")
    .eq("error_message", "campaign_inactive")
    .select("id")
    .maybeSingle();
  if (reclaimError) throw reclaimError;
  return Boolean(reclaimed);
}

async function campaignLeaseIsActive(
  db: any,
  promotionId: string,
  leaseStartedAt: string,
  checkedAt = new Date(),
) {
  const { data, error } = await db
    .from("promotion_campaigns")
    .select("id")
    .eq("id", promotionId)
    .eq("enabled", true)
    .eq("status", "active")
    .eq("broadcast_dispatch_started_at", leaseStartedAt)
    .or(`ends_at.is.null,ends_at.gt.${checkedAt.toISOString()}`)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function dispatchClaimedPromotion(db: any, campaign: any, now: Date, leaseStartedAt: string) {
  const members = await audienceForCampaign(db, campaign, now);
  const { data: existingDeliveries, error: existingError } = await db
    .from("promotion_deliveries")
    .select("member_id,channel")
    .eq("promotion_id", campaign.id)
    .in("status", ["queued", "sent", "delivered", "read"]);
  if (existingError) throw existingError;
  const alreadyDelivered = new Set(
    (existingDeliveries ?? []).map((row: any) => `${row.member_id}:${row.channel}`),
  );
  let sent = 0;
  let queued = 0;
  let skipped = 0;
  let interrupted = false;
  memberLoop: for (const member of members) {
    const locale = language(member.preferred_language);
    const copy = campaign.localized_content?.[locale] ?? campaign.localized_content?.he;
    if (!copy?.title || !copy?.body) continue;
    const template = campaign.whatsapp_templates?.[locale];
    const channels = resolvePromotionDeliveryChannels({
      requestedChannels: campaign.channels as PromotionChannel[],
      marketingConsent: Boolean(member.preferences?.marketing),
      pushEnabled: member.preferences?.push_enabled !== false,
      whatsappEnabled: Boolean(member.preferences?.whatsapp_enabled),
      hasActivePushDevice: member.hasActivePushDevice,
      hasWhatsappNumber: Boolean(member.phone),
      promotionalContactsToday: member.contacts.day,
      promotionalContactsThisWeek: member.contacts.week,
      whatsappTemplateApproved: template?.status === "approved",
    });

    if (channels.deliver.includes("push") && !alreadyDelivered.has(`${member.id}:push`)) {
      if (!(await campaignLeaseIsActive(db, campaign.id, leaseStartedAt))) {
        interrupted = true;
        break memberLoop;
      }
      const result = await enqueueMemberNotification({
        memberId: member.id,
        category: "marketing",
        title: copy.title,
        body: copy.body,
        actionUrl: campaign.action_url,
        idempotencyKey: `promotion:${campaign.id}:member:${member.id}:push`,
        relatedIds: { promotionId: campaign.id },
        expiresAt: campaign.ends_at,
        now,
      });
      const status = result.delivery?.sent ? "sent" : "queued";
      await recordDelivery(db, {
        promotion_id: campaign.id,
        member_id: member.id,
        channel: "push",
        status,
        sent_at: result.delivery?.sent ? now.toISOString() : null,
        updated_at: now.toISOString(),
      });
      if (status === "sent") sent += 1;
      else queued += 1;
      if (channels.deliver.includes("in_app")) {
        await recordDelivery(db, {
          promotion_id: campaign.id,
          member_id: member.id,
          channel: "in_app",
          status: "sent",
          sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
      }
    } else if (
      channels.deliver.includes("in_app") &&
      !alreadyDelivered.has(`${member.id}:in_app`)
    ) {
      if (!(await campaignLeaseIsActive(db, campaign.id, leaseStartedAt))) {
        interrupted = true;
        break memberLoop;
      }
      const { error: inboxError } = await db.from("member_notifications").upsert(
        {
          member_id: member.id,
          category: "marketing",
          title: copy.title,
          body: copy.body,
          action_url: campaign.action_url,
          promotion_id: campaign.id,
          delivery_status: "inbox",
          idempotency_key: `promotion:${campaign.id}:member:${member.id}:in_app`,
          scheduled_for: now.toISOString(),
          expires_at: campaign.ends_at,
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
      if (inboxError) throw inboxError;
      await recordDelivery(db, {
        promotion_id: campaign.id,
        member_id: member.id,
        channel: "in_app",
        status: "sent",
        sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
      sent += 1;
    }

    if (channels.deliver.includes("whatsapp") && !alreadyDelivered.has(`${member.id}:whatsapp`)) {
      if (!(await campaignLeaseIsActive(db, campaign.id, leaseStartedAt))) {
        interrupted = true;
        break memberLoop;
      }
      const claimed = await claimDelivery(db, {
        promotionId: campaign.id,
        memberId: member.id,
        channel: "whatsapp",
        now,
      });
      if (!claimed) continue;
      if (!(await campaignLeaseIsActive(db, campaign.id, leaseStartedAt))) {
        await recordDelivery(db, {
          promotion_id: campaign.id,
          member_id: member.id,
          channel: "whatsapp",
          status: "skipped",
          error_message: "campaign_inactive",
          updated_at: now.toISOString(),
        });
        interrupted = true;
        break memberLoop;
      }
      const result = await sendOfficialWhatsappTemplateMessage({
        to: member.phone,
        template: {
          name: template.name,
          languageCode: locale === "en" ? "en_US" : locale,
          components: [
            { type: "body", parameters: [{ type: "text", text: member.name || "Cloud & Core" }] },
          ],
        },
      });
      await recordDelivery(db, {
        promotion_id: campaign.id,
        member_id: member.id,
        channel: "whatsapp",
        status: result.ok ? "sent" : "failed",
        provider_message_id: result.providerMessageId ?? null,
        error_message: result.ok ? null : result.error,
        sent_at: result.ok ? now.toISOString() : null,
        updated_at: now.toISOString(),
      });
      if (result.ok) sent += 1;
      else skipped += 1;
    }

    for (const [channel, reason] of Object.entries(channels.suppressed)) {
      await recordDelivery(db, {
        promotion_id: campaign.id,
        member_id: member.id,
        channel,
        status: "skipped",
        error_message: reason,
        updated_at: now.toISOString(),
      });
      skipped += 1;
    }
  }
  const { error: auditError } = await db.from("promotion_campaign_audit").insert({
    promotion_id: campaign.id,
    action: interrupted ? "broadcast_interrupted" : "broadcast_dispatched",
    metadata: { audience_count: members.length, sent, queued, skipped, interrupted },
  });
  if (auditError) throw auditError;
  return { promotionId: campaign.id, audience: members.length, sent, queued, skipped, interrupted };
}

const PROMOTION_DISPATCH_LEASE_MS = 60 * 60_000;

export async function dispatchPromotionCampaign(promotionId: string, now = new Date()) {
  const db = supabaseAdmin as any;
  const leaseStartedAt = now.toISOString();
  const staleBefore = new Date(now.getTime() - PROMOTION_DISPATCH_LEASE_MS).toISOString();
  const { data: campaign, error } = await db
    .from("promotion_campaigns")
    .update({ broadcast_dispatch_started_at: leaseStartedAt, updated_at: leaseStartedAt })
    .eq("id", promotionId)
    .eq("enabled", true)
    .eq("status", "active")
    .is("broadcast_dispatched_at", null)
    .or(`ends_at.is.null,ends_at.gt.${leaseStartedAt}`)
    .or(`broadcast_dispatch_started_at.is.null,broadcast_dispatch_started_at.lt.${staleBefore}`)
    .select("*,promotion_eligible_class_types(program_type_id)")
    .maybeSingle();
  if (error) throw error;
  if (!campaign) {
    return { promotionId, audience: 0, sent: 0, queued: 0, skipped: 0, claimed: false };
  }
  try {
    const result = await dispatchClaimedPromotion(db, campaign, now, leaseStartedAt);
    if (result.interrupted) {
      const { error: releaseError } = await db
        .from("promotion_campaigns")
        .update({ broadcast_dispatch_started_at: null, updated_at: new Date().toISOString() })
        .eq("id", campaign.id)
        .eq("broadcast_dispatch_started_at", leaseStartedAt)
        .is("broadcast_dispatched_at", null);
      if (releaseError) throw releaseError;
      return { ...result, claimed: true };
    }
    const { data: completed, error: completionError } = await db
      .from("promotion_campaigns")
      .update({
        broadcast_dispatch_started_at: null,
        broadcast_dispatched_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", campaign.id)
      .eq("broadcast_dispatch_started_at", leaseStartedAt)
      .is("broadcast_dispatched_at", null)
      .select("id")
      .maybeSingle();
    if (completionError) throw completionError;
    if (!completed) throw new Error("promotion_dispatch_lease_lost");
    return { ...result, claimed: true };
  } catch (dispatchError) {
    await db
      .from("promotion_campaigns")
      .update({ broadcast_dispatch_started_at: null, updated_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .eq("broadcast_dispatch_started_at", leaseStartedAt)
      .is("broadcast_dispatched_at", null);
    throw dispatchError;
  }
}

export async function dispatchDuePromotions(input?: { now?: Date; limit?: number }) {
  const db = supabaseAdmin as any;
  const now = input?.now ?? new Date();
  const { error: activationError } = await db
    .from("promotion_campaigns")
    .update({ status: "active", updated_at: now.toISOString() })
    .eq("enabled", true)
    .eq("status", "scheduled")
    .lte("starts_at", now.toISOString())
    .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`);
  if (activationError) throw activationError;
  const { data, error } = await db
    .from("promotion_campaigns")
    .select("id")
    .eq("enabled", true)
    .eq("status", "active")
    .is("broadcast_dispatched_at", null)
    .lte("starts_at", now.toISOString())
    .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`)
    .limit(Math.max(1, Math.min(20, input?.limit ?? 10)));
  if (error) throw error;
  const results = [];
  for (const campaign of data ?? [])
    results.push(await dispatchPromotionCampaign(campaign.id, now));
  return results;
}
