import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
import { getIsraelNowParts, getPreviousIsraelEvening } from "@/lib/notificationDelivery";
import {
  buildMemberNotificationCopy,
  normalizeMemberNotificationLanguage,
  type MemberAutomationEvent,
} from "@/lib/memberNotificationCopy";
import {
  deliverQueuedMemberNotifications,
  enqueueMemberNotification,
} from "@/lib/memberNotificationDelivery.server";
import { decidePaymentReminderActions } from "@/lib/memberNotificationPolicy";
import { LEGACY_PAYMENT_AUTOMATION_STATUSES } from "@/lib/paymentReminderCandidates";
import {
  dispatchDueNotificationCampaigns,
  reconcileSendingNotificationCampaigns,
} from "@/lib/adminNotificationCampaigns.functions";
import { dispatchDuePromotions } from "@/lib/promotionBroadcast.server";

type BookingCandidate = {
  id: string;
  member_id: string;
  class_id: string;
  member: { preferred_language: string | null; status: string } | null;
  class: {
    id: string;
    title: string;
    starts_at: string;
    cancellation_window_hours: number;
    status: string;
  } | null;
};

type PaymentCandidate = {
  id: string;
  member_id: string;
  status: (typeof LEGACY_PAYMENT_AUTOMATION_STATUSES)[number];
  created_at: string;
  member: {
    name: string | null;
    phone: string | null;
    email: string | null;
    preferred_language: string | null;
    status: string;
  } | null;
};

type StudioSettings = {
  default_language?: string | null;
  studio_name?: string | null;
  public_phone?: string | null;
  whatsapp_number?: string | null;
};

function formatClassTime(value: string, language: string | null) {
  return new Intl.DateTimeFormat(language === "he" ? "he-IL" : language === "ar" ? "ar" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function finalReminderAt(startsAt: Date) {
  const { hour, minute } = getIsraelNowParts(startsAt);
  const earlyMorning = hour * 60 + minute < 10 * 60 + 30;
  return earlyMorning
    ? getPreviousIsraelEvening(startsAt)
    : new Date(startsAt.getTime() - 2 * 60 * 60_000);
}

async function enqueueBookingReminder(
  booking: BookingCandidate,
  event: Extract<MemberAutomationEvent, "class_reminder_planning" | "class_reminder_2h">,
  now: Date,
) {
  if (!booking.class || !booking.member || booking.member.status !== "active") return null;
  const language = normalizeMemberNotificationLanguage(booking.member.preferred_language);
  const copy = buildMemberNotificationCopy(event, language, {
    class_id: booking.class.id,
    class_name: booking.class.title,
    class_time: formatClassTime(booking.class.starts_at, booking.member.preferred_language),
  });
  return enqueueMemberNotification({
    memberId: booking.member_id,
    category: copy.category,
    title: copy.title,
    body: copy.body,
    actionUrl: copy.actionUrl,
    idempotencyKey: `booking:${booking.id}:${event}:push`,
    relatedIds: { bookingId: booking.id, classId: booking.class_id },
    now,
  });
}

async function runLessonReminderSweep(now: Date, limit: number) {
  const db = supabaseAdmin as any;
  const horizon = new Date(now.getTime() + 72 * 60 * 60_000).toISOString();
  const { data, error } = await db
    .from("bookings")
    .select(
      "id,member_id,class_id,member:members!inner(preferred_language,status),class:classes!inner(id,title,starts_at,cancellation_window_hours,status)",
    )
    .in("status", ["booked", "checked_in"])
    .gte("class.starts_at", now.toISOString())
    .lte("class.starts_at", horizon)
    .limit(Math.max(limit * 20, 500));
  if (error) throw error;

  const candidates = ((data ?? []) as BookingCandidate[])
    .filter((booking) => booking.class?.status === "scheduled")
    .filter((booking) => booking.class && booking.class.starts_at <= horizon)
    .filter((booking) => booking.class && new Date(booking.class.starts_at) > now);

  let planning = 0;
  let final = 0;
  for (const booking of candidates) {
    if (!booking.class) continue;
    const startsAt = new Date(booking.class.starts_at);
    const cancellationDeadline = new Date(
      startsAt.getTime() - booking.class.cancellation_window_hours * 60 * 60_000,
    );
    const planningAt = new Date(cancellationDeadline.getTime() - 2 * 60 * 60_000);
    if (
      booking.class.cancellation_window_hours > 0 &&
      planningAt <= now &&
      now < cancellationDeadline
    ) {
      const result = await enqueueBookingReminder(booking, "class_reminder_planning", now);
      if (result && !result.duplicate) planning += 1;
    }

    if (finalReminderAt(startsAt) <= now) {
      const result = await enqueueBookingReminder(booking, "class_reminder_2h", now);
      if (result && !result.duplicate) final += 1;
    }
  }

  return { scanned: candidates.length, planning, final };
}

async function runPaymentReminderSweep(now: Date, limit: number) {
  const db = supabaseAdmin as any;
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [{ data, error }, settingsResult] = await Promise.all([
    db
      .from("payments")
      .select(
        "id,member_id,status,created_at,member:members(name,phone,email,preferred_language,status)",
      )
      .in("status", [...LEGACY_PAYMENT_AUTOMATION_STATUSES])
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(Math.max(limit * 20, 500)),
    db.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (error) throw error;
  if (settingsResult.error) throw settingsResult.error;

  let prepared = 0;
  let whatsappPrepared = 0;
  for (const payment of (data ?? []) as PaymentCandidate[]) {
    if (!payment.member || payment.member.status !== "active") continue;
    const ageMs = now.getTime() - new Date(payment.created_at).getTime();
    const actions = decidePaymentReminderActions({
      status: payment.status,
      ageHours: ageMs / (60 * 60_000),
    });
    if (!actions.createInbox) continue;
    const event: Extract<MemberAutomationEvent, "payment_failed" | "payment_confirmed"> =
      payment.status === "failed" ? "payment_failed" : "payment_confirmed";
    const language = normalizeMemberNotificationLanguage(payment.member.preferred_language);
    const copy = buildMemberNotificationCopy(event, language, {});
    const result = await enqueueMemberNotification({
      memberId: payment.member_id,
      category: copy.category,
      title: copy.title,
      body: copy.body,
      actionUrl: copy.actionUrl,
      idempotencyKey: `payment:${payment.id}:${event}:push`,
      relatedIds: { paymentId: payment.id },
      now,
    });
    if (!result.duplicate) prepared += 1;

    if (actions.sendWhatsapp && payment.status === "failed") {
      const eventKey = "payment_failed";
      const [row] = buildNotificationDraftRows({
        eventKey,
        channels: ["whatsapp"],
        audience: "member",
        member: {
          id: payment.member_id,
          name: payment.member.name,
          phone: payment.member.phone,
          email: payment.member.email,
          preferred_language: payment.member.preferred_language,
        },
        studioSettings: (settingsResult.data ?? null) as StudioSettings | null,
        relatedIds: { memberId: payment.member_id, paymentId: payment.id },
        variables: {},
        delivery: { scheduledFor: now },
      });
      const { error: whatsappError } = await db
        .from("notification_logs")
        .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (whatsappError) throw whatsappError;
      if (row.status === "queued") whatsappPrepared += 1;
    }
  }

  return { scanned: data?.length ?? 0, prepared, whatsappPrepared };
}

export async function runMemberNotificationAutomation(input?: { now?: Date; limit?: number }) {
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(100, Math.trunc(input?.limit ?? 50)));
  const [lessonReminders, paymentReminders] = await Promise.all([
    runLessonReminderSweep(now, limit),
    runPaymentReminderSweep(now, limit),
  ]);
  const campaigns = await dispatchDueNotificationCampaigns({ now, limit: Math.min(limit, 10) });
  const promotions = await dispatchDuePromotions({ now, limit: Math.min(limit, 10) });
  const queuedDelivery = await deliverQueuedMemberNotifications({ now, limit });
  const campaignReconciliation = await reconcileSendingNotificationCampaigns(now);
  return {
    lessonReminders,
    paymentReminders,
    campaigns,
    promotions,
    queuedDelivery,
    campaignReconciliation,
  };
}
