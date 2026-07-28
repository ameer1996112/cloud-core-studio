import { createServerFn } from "@tanstack/react-start";
import { kickUnifiedMessagingAfterCommit } from "@/lib/unifiedMessagingKick.server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deriveAdminClassWorkflowSnapshot,
  type AdminCancelClassResult,
  type AdminDeleteClassResult,
} from "@/lib/adminClassWorkflow";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
import { hasTestClassRecord, isTestRecord } from "@/lib/test-records";
import { formatClassDate, formatClassTime } from "@/lib/messageTemplate";
import {
  buildMemberNotificationCopy,
  normalizeMemberNotificationLanguage,
} from "@/lib/memberNotificationCopy";
import { getScheduleDigestIdempotencyKey } from "@/lib/notificationDelivery";

async function ensureStaff(supabase: any, userId: string, level: "admin" | "staff" = "staff") {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = data?.role;
  if (level === "admin" && role !== "admin") throw new Error("forbidden");
  if (level === "staff" && role !== "admin" && role !== "instructor") throw new Error("forbidden");
  return role as "admin" | "instructor";
}

async function insertNotificationDraftRows(_supabase: any, rows: any[]) {
  if (!rows.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("notification_logs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error("notification_draft_insert_failed", error.message);
}

function buildClassVariables(cls: any) {
  return {
    class_name: cls.title,
    class_date: formatClassDate(cls.starts_at),
    class_time: formatClassTime(cls.starts_at),
    instructor_name: cls.instructor?.name ?? "",
  };
}

async function buildClassMemberDraftRows(
  supabase: any,
  input: {
    classId: string;
    eventKey: "class_cancelled_by_admin" | "class_time_changed";
  },
) {
  const [bookingsRes, clsRes, settingsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,member:members(id,name,phone,email,preferred_language)")
      .eq("class_id", input.classId)
      .eq("status", "booked"),
    supabase
      .from("classes")
      .select("id,title,starts_at,instructor:instructors(name)")
      .eq("id", input.classId)
      .maybeSingle(),
    supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (bookingsRes.error) throw bookingsRes.error;
  if (clsRes.error) throw clsRes.error;
  if (settingsRes.error) throw settingsRes.error;
  const cls = clsRes.data as any;
  if (!cls) return [];
  return (bookingsRes.data ?? []).flatMap((booking: any) =>
    booking.member
      ? buildNotificationDraftRows({
          eventKey: input.eventKey,
          channels: ["whatsapp", "email"],
          audience: "member",
          member: booking.member,
          appLanguage: null,
          studioSettings: settingsRes.data ?? null,
          relatedIds: { bookingId: booking.id, classId: input.classId },
          variables: buildClassVariables(cls),
        })
      : [],
  );
}

async function enqueueClassMemberPushNotifications(
  supabase: any,
  input: {
    classId: string;
    eventKey: "class_cancelled_by_admin" | "class_time_changed";
  },
) {
  const { enqueueMemberNotification } = await import("@/lib/memberNotificationDelivery.server");
  const [bookingsResult, classResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,member_id,member:members(id,preferred_language,status)")
      .eq("class_id", input.classId)
      .in("status", input.eventKey === "class_time_changed" ? ["booked"] : ["booked", "cancelled"]),
    supabase.from("classes").select("id,title,starts_at").eq("id", input.classId).maybeSingle(),
  ]);
  if (bookingsResult.error) throw bookingsResult.error;
  if (classResult.error) throw classResult.error;
  if (!classResult.data) return;

  await Promise.all(
    (bookingsResult.data ?? []).map(async (booking: any) => {
      if (!booking.member || booking.member.status !== "active") return;
      const language = normalizeMemberNotificationLanguage(booking.member.preferred_language);
      const copy = buildMemberNotificationCopy(input.eventKey, language, {
        class_id: classResult.data.id,
        class_name: classResult.data.title,
        class_time: formatClassTime(classResult.data.starts_at),
      });
      await enqueueMemberNotification({
        memberId: booking.member_id,
        category: copy.category,
        title: copy.title,
        body: copy.body,
        actionUrl: copy.actionUrl,
        idempotencyKey: `booking:${booking.id}:${input.eventKey}:member_push`,
        relatedIds: { bookingId: booking.id, classId: input.classId },
      });
    }),
  );
}

async function enqueueWaitlistMemberPush(entry: any, expiresAt?: Date) {
  if (!entry?.member || entry.member.status !== "active" || !entry.class) return;
  const language = normalizeMemberNotificationLanguage(entry.member.preferred_language);
  const copy = buildMemberNotificationCopy("waitlist_spot_available", language, {
    class_id: entry.class_id,
    class_name: entry.class.title,
    class_time: formatClassTime(entry.class.starts_at),
  });
  const { enqueueMemberNotification } = await import("@/lib/memberNotificationDelivery.server");
  await enqueueMemberNotification({
    memberId: entry.member.id,
    category: copy.category,
    title: copy.title,
    body: copy.body,
    actionUrl: copy.actionUrl,
    idempotencyKey: `waitlist:${entry.id}:waitlist_spot_available:member_push`,
    relatedIds: { classId: entry.class_id },
    expiresAt,
  });
}

async function listAllActiveMembers(supabase: any) {
  const pageSize = 500;
  const members: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("members")
      .select("id,preferred_language")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    members.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) return members;
  }
}

async function enqueueDailyScheduleOpenedPushes(supabase: any, classId: string) {
  const { enqueueMemberNotification } = await import("@/lib/memberNotificationDelivery.server");
  const now = new Date();
  const [classResult, membersResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id,title,starts_at,status,member_visible")
      .eq("id", classId)
      .maybeSingle(),
    listAllActiveMembers(supabase),
  ]);
  if (classResult.error) throw classResult.error;
  const cls = classResult.data;
  if (
    !cls ||
    cls.status !== "scheduled" ||
    cls.member_visible !== true ||
    new Date(cls.starts_at) <= new Date()
  )
    return;

  const results = await Promise.allSettled(
    membersResult.map(async (member: any) => {
      const copy = buildMemberNotificationCopy(
        "schedule_opened",
        normalizeMemberNotificationLanguage(member.preferred_language),
        {
          class_id: cls.id,
          class_name: cls.title,
          class_time: formatClassTime(cls.starts_at),
        },
      );
      return enqueueMemberNotification({
        memberId: member.id,
        category: copy.category,
        title: copy.title,
        body: copy.body,
        actionUrl: copy.actionUrl,
        idempotencyKey: getScheduleDigestIdempotencyKey(member.id, now),
        now,
      });
    }),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("schedule_opened_member_push_failed", result.reason);
    }
  }
}

// ===== Overview =====
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureStaff(supabase, userId, "staff");
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      classes,
      todayClasses,
      members,
      bookings,
      waitlist,
      log,
      payments,
      rooms,
      lowCredit,
      firstTimers,
    ] = await Promise.all([
      supabase
        .from("classes")
        .select(
          "id, title, starts_at, capacity, booked_count, status, room, member_visible, instructor:instructors(id,name), room_ref:rooms(id,name), program_type:program_types(id,name_en,name_he,name_ar,level)",
        )
        .gte("starts_at", now.toISOString())
        .order("starts_at")
        .limit(8),
      supabase
        .from("classes")
        .select(
          "id, title, starts_at, capacity, booked_count, room, member_visible, instructor:instructors(id,name), room_ref:rooms(id,name), program_type:program_types(id,name_en,name_he,name_ar,level)",
        )
        .gte("starts_at", dayStart.toISOString())
        .lte("starts_at", dayEnd.toISOString())
        .order("starts_at"),
      supabase.from("members").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "booked"),
      supabase
        .from("waitlist_entries")
        .select("id", { count: "exact", head: true })
        .eq("status", "waiting"),
      supabase
        .from("admin_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
      (supabase as any)
        .from("payments")
        .select("amount, refunded_amount")
        .eq("status", "paid")
        .gte("paid_at", monthStart.toISOString()),
      (supabase as any)
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabase
        .from("members")
        .select("id, name, remaining_credits")
        .lte("remaining_credits", 1)
        .order("remaining_credits")
        .limit(5),
      supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("attendance_count", 0),
    ]);
    const monthRevenueIls = (payments.data ?? []).reduce(
      (a: number, r: any) => a + Number(r.amount) - Number(r.refunded_amount ?? 0),
      0,
    );
    const visibleUpcoming = (classes.data ?? []).filter((c: any) => !hasTestClassRecord(c));
    const visibleTodayClasses = (todayClasses.data ?? []).filter(
      (c: any) => !hasTestClassRecord(c),
    );
    const visibleLowCredit = (lowCredit.data ?? []).filter((m: any) => !isTestRecord(m.name));
    return {
      upcoming: visibleUpcoming,
      todayClasses: visibleTodayClasses,
      memberCount: members.count ?? 0,
      activeBookings: bookings.count ?? 0,
      waitingCount: waitlist.count ?? 0,
      recentLog: log.data ?? [],
      monthRevenueIls,
      roomCount: rooms.count ?? 0,
      membersLowCredit: visibleLowCredit,
      firstTimerCount: firstTimers.count ?? 0,
    };
  });

// ===== Classes =====
export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data } = await context.supabase
      .from("classes")
      .select(
        "*, instructor:instructors(id,name), room_ref:rooms(id,name,color,capacity), program_type:program_types(id,name_en,name_he,name_ar,level,image_url)",
      )
      .order("starts_at", { ascending: false })
      .limit(200);
    return (data ?? []).filter((c: any) => !hasTestClassRecord(c));
  });

const classInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  starts_at: z.string(),
  duration_minutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  room: z.string().min(1),
  room_id: z.string().uuid().nullable().optional(),
  energy: z.string().min(1),
  cancellation_window_hours: z.number().int().min(0),
  credit_cost: z.number().int().min(0),
  instructor_id: z.string().uuid().nullable().optional(),
  program_type_id: z.string().uuid().nullable().optional(),
  member_visible: z.boolean().optional(),
  status: z.enum(["scheduled", "cancelled", "archived"]).optional(),
});

export const upsertClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => classInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const payload = { ...data, status: data.status ?? "scheduled" };
    if (data.id) {
      const { data: previous, error: previousError } = await context.supabase
        .from("classes")
        .select("id,starts_at,status,member_visible")
        .eq("id", data.id)
        .maybeSingle();
      if (previousError) throw previousError;
      const { error } = await context.supabase.from("classes").update(payload).eq("id", data.id);
      if (error) throw error;
      const timeChanged =
        previous?.starts_at &&
        new Date(previous.starts_at).getTime() !== new Date(data.starts_at).getTime() &&
        payload.status === "scheduled";
      const becameCancelled = previous?.status !== "cancelled" && payload.status === "cancelled";
      const becameVisibleSchedule =
        payload.status === "scheduled" &&
        ((previous?.member_visible !== true && payload.member_visible === true) ||
          (previous?.status !== "scheduled" && payload.member_visible !== false));
      if (timeChanged) {
        try {
          await insertNotificationDraftRows(
            context.supabase,
            await buildClassMemberDraftRows(context.supabase, {
              classId: data.id,
              eventKey: "class_time_changed",
            }),
          );
          await enqueueClassMemberPushNotifications(context.supabase, {
            classId: data.id,
            eventKey: "class_time_changed",
          });
        } catch (draftError) {
          console.error("class_time_changed_draft_prepare_failed", draftError);
        }
      }
      if (becameCancelled) {
        try {
          await insertNotificationDraftRows(
            context.supabase,
            await buildClassMemberDraftRows(context.supabase, {
              classId: data.id,
              eventKey: "class_cancelled_by_admin",
            }),
          );
          await enqueueClassMemberPushNotifications(context.supabase, {
            classId: data.id,
            eventKey: "class_cancelled_by_admin",
          });
        } catch (draftError) {
          console.error("class_cancelled_by_admin_draft_prepare_failed", draftError);
        }
      }
      if (becameVisibleSchedule) {
        try {
          await enqueueDailyScheduleOpenedPushes(context.supabase, data.id);
        } catch (notificationError) {
          console.error("schedule_opened_push_prepare_failed", notificationError);
        }
      }
      // audit log entry is best-effort; _log_action is internal
      await kickUnifiedMessagingAfterCommit();
      return { id: data.id };
    } else {
      const { data: row, error } = await context.supabase
        .from("classes")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      try {
        await enqueueDailyScheduleOpenedPushes(context.supabase, row.id);
      } catch (notificationError) {
        console.error("schedule_opened_push_prepare_failed", notificationError);
      }
      await kickUnifiedMessagingAfterCommit();
      return { id: row.id };
    }
  });

export const rescheduleClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), startsAt: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { data: previous, error: previousError } = await context.supabase
      .from("classes")
      .select("id,starts_at,status")
      .eq("id", data.id)
      .maybeSingle();
    if (previousError) throw previousError;
    if (!previous) throw new Error("class_not_found");
    if (previous.status !== "scheduled") throw new Error("class_not_scheduled");

    const timeChanged =
      new Date(previous.starts_at).getTime() !== new Date(data.startsAt).getTime();
    if (!timeChanged) return { id: data.id, changed: false };

    const { data: updated, error } = await context.supabase
      .from("classes")
      .update({ starts_at: data.startsAt })
      .eq("id", data.id)
      .eq("status", "scheduled")
      .eq("starts_at", previous.starts_at)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("class_changed_concurrently");

    try {
      await insertNotificationDraftRows(
        context.supabase,
        await buildClassMemberDraftRows(context.supabase, {
          classId: data.id,
          eventKey: "class_time_changed",
        }),
      );
      await enqueueClassMemberPushNotifications(context.supabase, {
        classId: data.id,
        eventKey: "class_time_changed",
      });
    } catch (notificationError) {
      console.error("class_time_changed_draft_prepare_failed", notificationError);
    }

    try {
      await kickUnifiedMessagingAfterCommit();
    } catch (kickError) {
      console.error("class_time_changed_messaging_kick_failed", kickError);
    }
    return { id: data.id, changed: true };
  });

export const setClassStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["scheduled", "cancelled", "archived"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase
      .from("classes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    if (data.status === "cancelled") {
      try {
        await insertNotificationDraftRows(
          context.supabase,
          await buildClassMemberDraftRows(context.supabase, {
            classId: data.id,
            eventKey: "class_cancelled_by_admin",
          }),
        );
        await enqueueClassMemberPushNotifications(context.supabase, {
          classId: data.id,
          eventKey: "class_cancelled_by_admin",
        });
      } catch (draftError) {
        console.error("class_cancelled_by_admin_draft_prepare_failed", draftError);
      }
    }
    await kickUnifiedMessagingAfterCommit();
    return { ok: true };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase.from("classes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getAdminClassWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");

    const [clsRes, bookingListRes, waitlistRes, attendanceRes, notificationRes] = await Promise.all(
      [
        context.supabase.from("classes").select("id,status").eq("id", data.classId).maybeSingle(),
        context.supabase.from("bookings").select("id,status").eq("class_id", data.classId),
        context.supabase
          .from("waitlist_entries")
          .select("id", { count: "exact", head: true })
          .eq("class_id", data.classId),
        context.supabase
          .from("attendance_records")
          .select("id", { count: "exact", head: true })
          .eq("class_id", data.classId),
        context.supabase
          .from("notification_logs")
          .select("id", { count: "exact", head: true })
          .eq("related_class_id", data.classId),
      ],
    );

    if (clsRes.error) throw clsRes.error;
    if (bookingListRes.error) throw bookingListRes.error;
    if (waitlistRes.error) throw waitlistRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (notificationRes.error) throw notificationRes.error;

    const bookingIds = (bookingListRes.data ?? []).map((row: any) => row.id);
    const financialRes = bookingIds.length
      ? await context.supabase
          .from("credit_transactions")
          .select("id", { count: "exact", head: true })
          .in("related_booking_id", bookingIds)
      : { count: 0, error: null };

    if (financialRes.error) throw financialRes.error;

    const counts = {
      bookings: bookingListRes.data?.length ?? 0,
      waitlist: waitlistRes.count ?? 0,
      attendance: attendanceRes.count ?? 0,
      notifications: notificationRes.count ?? 0,
      financial: financialRes.count ?? 0,
    };

    return {
      classId: data.classId,
      classStatus: clsRes.data?.status ?? "scheduled",
      counts,
      ...deriveAdminClassWorkflowSnapshot({
        status: clsRes.data?.status ?? "scheduled",
        ...counts,
      }),
    };
  });

export const adminDeleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("admin_delete_class", {
      p_actor_id: context.userId,
      p_class_id: data.classId,
    });
    if (error) throw error;
    return result as AdminDeleteClassResult;
  });

export const adminCancelClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        reason: z.string().trim().nullable().optional(),
        notifyMembers: z.boolean().default(true),
        refundCredits: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rpcResult, error } = await (supabaseAdmin as any).rpc("admin_cancel_class", {
      p_actor_id: context.userId,
      p_class_id: data.classId,
      p_reason: data.reason ?? null,
      p_refund: data.refundCredits,
    });
    if (error) throw error;

    const warnings: string[] = [];
    let notificationsPrepared = 0;
    let notificationsManualReview = 0;

    const cancelledBookingIds: string[] = rpcResult?.cancelled_booking_ids ?? [];
    if (data.notifyMembers && cancelledBookingIds.length > 0) {
      const [bookingRes, settingsRes] = await Promise.all([
        context.supabase
          .from("bookings")
          .select(
            "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
          )
          .in("id", cancelledBookingIds),
        context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
      ]);

      if (bookingRes.error) throw bookingRes.error;
      if (settingsRes.error) throw settingsRes.error;

      const rows = (bookingRes.data ?? []).flatMap((booking: any) =>
        booking.member && booking.class
          ? buildNotificationDraftRows({
              eventKey: "class_cancelled_by_admin",
              channels: ["whatsapp", "email"],
              audience: "member",
              member: booking.member,
              appLanguage: null,
              studioSettings: settingsRes.data ?? null,
              relatedIds: { bookingId: booking.id, classId: booking.class_id },
              variables: buildClassVariables(booking.class),
            })
          : [],
      );

      const { error: notificationError } = await context.supabase
        .from("notification_logs")
        .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });

      notificationsPrepared = rows.filter(
        (row) => row.status === "draft" || row.status === "queued",
      ).length;
      notificationsManualReview = rows.filter((row) => row.status === "skipped").length;

      if (notificationError) {
        warnings.push("notification_drafts_failed");
        notificationsPrepared = 0;
        notificationsManualReview = Math.max(cancelledBookingIds.length, notificationsManualReview);
      }
      try {
        await enqueueClassMemberPushNotifications(context.supabase, {
          classId: data.classId,
          eventKey: "class_cancelled_by_admin",
        });
      } catch (pushError) {
        warnings.push("member_push_failed");
        console.error("class_cancelled_member_push_failed", pushError);
      }
    }

    await kickUnifiedMessagingAfterCommit();
    return {
      status: rpcResult?.status === "already_cancelled" ? "already_cancelled" : "cancelled",
      classId: data.classId,
      summary: {
        bookingsCancelled: rpcResult?.bookings_cancelled ?? 0,
        creditsReturned: rpcResult?.credits_returned ?? 0,
        waitlistClosed: rpcResult?.waitlist_closed ?? 0,
        notificationsPrepared,
        notificationsManualReview,
      },
      warnings,
    } satisfies AdminCancelClassResult;
  });

export const duplicateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), startsAt: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { data: src, error } = await context.supabase
      .from("classes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    const { id, created_at, booked_count, waitlist_count, ...rest } = src as any;
    const { data: row, error: e2 } = await context.supabase
      .from("classes")
      .insert({
        ...rest,
        starts_at: data.startsAt,
        booked_count: 0,
        waitlist_count: 0,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (e2) throw e2;
    return { id: row.id };
  });

// ===== Templates =====
export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data } = await context.supabase
      .from("class_templates")
      .select("*, instructor:instructors(id,name)")
      .order("title");
    return (data ?? []).filter((t: any) => !isTestRecord(t.title));
  });

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1),
        default_duration_minutes: z.number().int().positive(),
        default_capacity: z.number().int().positive(),
        default_room: z.string().min(1),
        default_energy: z.string().min(1),
        default_cancellation_window_hours: z.number().int().min(0),
        default_credit_cost: z.number().int().min(0),
        default_instructor_id: z.string().uuid().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("class_templates").update(rest).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("class_templates")
      .insert(data)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const createClassFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templateId: z.string().uuid(), startsAt: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { data: t, error } = await context.supabase
      .from("class_templates")
      .select("*")
      .eq("id", data.templateId)
      .single();
    if (error) throw error;
    const { data: row, error: e2 } = await context.supabase
      .from("classes")
      .insert({
        title: t.title,
        starts_at: data.startsAt,
        duration_minutes: t.default_duration_minutes,
        capacity: t.default_capacity,
        room: t.default_room,
        energy: t.default_energy,
        cancellation_window_hours: t.default_cancellation_window_hours,
        credit_cost: t.default_credit_cost,
        instructor_id: t.default_instructor_id,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (e2) throw e2;
    return { id: row.id };
  });

// ===== Instructors =====
export const listInstructors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data } = await context.supabase.from("instructors").select("*").order("name");
    return (data ?? []).filter((i: any) => !isTestRecord(i.name));
  });

export const upsertInstructor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        bio_short: z.string().nullable().optional(),
        avatar_url: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("instructors").update(rest).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("instructors")
      .insert(data)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

// ===== Members =====
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    let q = context.supabase.from("members").select("*").order("name");
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows } = await q.limit(200);
    return (rows ?? []).filter((m: any) => !isTestRecord(m.name));
  });

export const getMemberDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const [member, bookings, ledger, attendance] = await Promise.all([
      context.supabase.from("members").select("*").eq("id", data.memberId).maybeSingle(),
      context.supabase
        .from("bookings")
        .select("*, class:classes(id,title,starts_at,room)")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("credit_transactions")
        .select("*")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("attendance_records")
        .select("*, class:classes(title,starts_at)")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return {
      member: member.data,
      bookings: (bookings.data ?? []).filter((b: any) => !hasTestClassRecord(b)),
      ledger: ledger.data ?? [],
      attendance: (attendance.data ?? []).filter((a: any) => !hasTestClassRecord(a)),
    };
  });

export const updateMemberPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        memberId: z.string().uuid(),
        preferred_language: z.string().optional(),
        energy_preference: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { memberId, ...rest } = data;
    const { error } = await context.supabase.from("members").update(rest).eq("id", memberId);
    if (error) throw error;
    return { ok: true };
  });

export const adjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        memberId: z.string().uuid(),
        delta: z.number().int(),
        reason: z.string().min(1),
        override: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("admin_adjust_credits", {
      p_actor_id: context.userId,
      p_member_id: data.memberId,
      p_delta: data.delta,
      p_reason: data.reason,
      p_override: data.override ?? false,
    });
    if (error) throw error;
    return result;
  });

// ===== Bookings =====
export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid().optional(),
        memberId: z.string().uuid().optional(),
        status: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    let q = context.supabase
      .from("bookings")
      .select("*, member:members(id,name), class:classes(id,title,starts_at,room)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.classId) q = q.eq("class_id", data.classId);
    if (data.memberId) q = q.eq("member_id", data.memberId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    return (rows ?? []).filter((b: any) => !isTestRecord(b.member?.name) && !hasTestClassRecord(b));
  });

export const adminCreateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        memberId: z.string().uuid(),
        override: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("admin_create_booking", {
      p_actor_id: context.userId,
      p_class_id: data.classId,
      p_member_id: data.memberId,
      p_override: data.override ?? false,
    });
    if (error) throw error;
    const status = (r as any)?.status;
    const bookingId = (r as any)?.booking_id;
    if (status === "booked" && bookingId) {
      try {
        const [bookingRes, settingsRes] = await Promise.all([
          context.supabase
            .from("bookings")
            .select(
              "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
            )
            .eq("id", bookingId)
            .maybeSingle(),
          context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (bookingRes.error) throw bookingRes.error;
        if (settingsRes.error) throw settingsRes.error;
        const booking = bookingRes.data as any;
        if (booking?.member && booking?.class) {
          await insertNotificationDraftRows(
            context.supabase,
            buildNotificationDraftRows({
              eventKey: "booking_confirmed",
              channels: ["whatsapp", "email"],
              audience: "member",
              member: booking.member,
              appLanguage: null,
              studioSettings: settingsRes.data ?? null,
              relatedIds: { bookingId: booking.id, classId: booking.class_id },
              variables: buildClassVariables(booking.class),
            }),
          );
        }
      } catch (draftError) {
        console.error("admin_booking_confirmed_draft_prepare_failed", draftError);
      }
    }
    await kickUnifiedMessagingAfterCommit();
    return r;
  });

export const adminCancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ bookingId: z.string().uuid(), refund: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("admin_cancel_booking", {
      p_actor_id: context.userId,
      p_booking_id: data.bookingId,
      p_refund: data.refund ?? true,
    });
    if (error) throw error;
    if ((r as any)?.status === "cancelled") {
      try {
        const [bookingRes, settingsRes] = await Promise.all([
          context.supabase
            .from("bookings")
            .select(
              "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
            )
            .eq("id", data.bookingId)
            .maybeSingle(),
          context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (bookingRes.error) throw bookingRes.error;
        if (settingsRes.error) throw settingsRes.error;
        const booking = bookingRes.data as any;
        if (booking?.member && booking?.class) {
          await insertNotificationDraftRows(
            context.supabase,
            buildNotificationDraftRows({
              eventKey: "booking_cancelled",
              channels: ["whatsapp", "email"],
              audience: "member",
              member: booking.member,
              appLanguage: null,
              studioSettings: settingsRes.data ?? null,
              relatedIds: { bookingId: booking.id, classId: booking.class_id },
              variables: buildClassVariables(booking.class),
            }),
          );
        }
      } catch (draftError) {
        console.error("admin_booking_cancelled_draft_prepare_failed", draftError);
      }
    }
    await kickUnifiedMessagingAfterCommit();
    return r;
  });

// ===== Attendance =====
export const getRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const [cls, bookings] = await Promise.all([
      context.supabase
        .from("classes")
        .select("*, instructor:instructors(id,name)")
        .eq("id", data.classId)
        .maybeSingle(),
      context.supabase
        .from("bookings")
        .select(
          "id, status, member:members(id,name,attendance_count), attendance:attendance_records(status)",
        )
        .eq("class_id", data.classId)
        .order("created_at"),
    ]);
    return {
      cls: hasTestClassRecord(cls.data) ? null : cls.data,
      bookings: (bookings.data ?? []).filter((b: any) => !isTestRecord(b.member?.name)),
    };
  });

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        bookingId: z.string().uuid(),
        status: z.enum(["booked", "checked_in", "attended", "no_show", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("mark_attendance_v2", {
      p_actor_id: context.userId,
      p_booking_id: data.bookingId,
      p_status: data.status,
    });
    if (error) throw error;
    if (data.status === "no_show" && (r as any)?.status === "ok") {
      try {
        const [bookingRes, settingsRes] = await Promise.all([
          context.supabase
            .from("bookings")
            .select(
              "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
            )
            .eq("id", data.bookingId)
            .maybeSingle(),
          context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (bookingRes.error) throw bookingRes.error;
        if (settingsRes.error) throw settingsRes.error;
        const booking = bookingRes.data as any;
        if (booking?.member && booking?.class) {
          await insertNotificationDraftRows(
            context.supabase,
            buildNotificationDraftRows({
              eventKey: "no_show_followup",
              channels: ["whatsapp", "email"],
              audience: "member",
              member: booking.member,
              appLanguage: null,
              studioSettings: settingsRes.data ?? null,
              relatedIds: { bookingId: booking.id, classId: booking.class_id },
              variables: buildClassVariables(booking.class),
            }),
          );
        }
      } catch (draftError) {
        console.error("no_show_followup_draft_prepare_failed", draftError);
      }
    }
    await kickUnifiedMessagingAfterCommit();
    return r;
  });

export const prepareClassReminderDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        reminderWindow: z.enum(["24h", "2h"]).default("24h"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const [bookingsRes, clsRes, settingsRes] = await Promise.all([
      context.supabase
        .from("bookings")
        .select("id,member:members(id,name,phone,email,preferred_language)")
        .eq("class_id", data.classId)
        .eq("status", "booked"),
      context.supabase
        .from("classes")
        .select("id,title,starts_at,instructor:instructors(name)")
        .eq("id", data.classId)
        .maybeSingle(),
      context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (bookingsRes.error) throw bookingsRes.error;
    if (clsRes.error) throw clsRes.error;
    if (settingsRes.error) throw settingsRes.error;
    const cls = clsRes.data as any;
    const rows = (bookingsRes.data ?? []).flatMap((booking: any) =>
      booking.member && cls
        ? buildNotificationDraftRows({
            eventKey: data.reminderWindow === "2h" ? "class_reminder_2h" : "class_reminder_24h",
            channels: ["whatsapp", "email"],
            audience: "member",
            member: booking.member,
            appLanguage: null,
            studioSettings: settingsRes.data ?? null,
            relatedIds: { bookingId: booking.id, classId: data.classId },
            variables: buildClassVariables(cls),
          })
        : [],
    );
    await insertNotificationDraftRows(context.supabase, rows);
    return { prepared: rows.length };
  });

export const todaysClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const { data } = await context.supabase
      .from("classes")
      .select("*, instructor:instructors(id,name)")
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at");
    return (data ?? []).filter((c: any) => !hasTestClassRecord(c));
  });

// ===== Waitlist =====
export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data: rows } = await context.supabase
      .from("waitlist_entries")
      .select("*, member:members(id,name)")
      .eq("class_id", data.classId)
      .order("created_at");
    return (rows ?? []).filter((w: any) => !isTestRecord(w.member?.name));
  });

export const waitlistAdd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), memberId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase
      .from("waitlist_entries")
      .insert({ class_id: data.classId, member_id: data.memberId, status: "waiting" });
    if (error) throw error;
    await context.supabase
      .from("classes")
      .update({
        waitlist_count:
          (
            await context.supabase
              .from("waitlist_entries")
              .select("id", { count: "exact", head: true })
              .eq("class_id", data.classId)
              .eq("status", "waiting")
          ).count ?? 0,
      })
      .eq("id", data.classId);
    try {
      const [entryRes, settingsRes] = await Promise.all([
        context.supabase
          .from("waitlist_entries")
          .select(
            "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
          )
          .eq("class_id", data.classId)
          .eq("member_id", data.memberId)
          .eq("status", "waiting")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (entryRes.error) throw entryRes.error;
      if (settingsRes.error) throw settingsRes.error;
      const entry = entryRes.data as any;
      if (entry?.member && entry?.class) {
        await insertNotificationDraftRows(
          context.supabase,
          buildNotificationDraftRows({
            eventKey: "waitlist_joined",
            channels: ["whatsapp", "email"],
            audience: "member",
            member: entry.member,
            appLanguage: null,
            studioSettings: settingsRes.data ?? null,
            relatedIds: { classId: entry.class_id, waitlistEntryId: entry.id },
            variables: buildClassVariables(entry.class),
          }),
        );
      }
    } catch (draftError) {
      console.error("admin_waitlist_joined_draft_prepare_failed", draftError);
    }
    await kickUnifiedMessagingAfterCommit();
    return { ok: true };
  });

export const waitlistRemove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase
      .from("waitlist_entries")
      .update({ status: "removed" })
      .eq("id", data.entryId);
    if (error) throw error;
    await kickUnifiedMessagingAfterCommit();
    return { ok: true };
  });

export const waitlistPromote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("admin_waitlist_promote", {
      p_actor_id: context.userId,
      p_entry_id: data.entryId,
    });
    if (error) throw error;
    try {
      const status = (r as any)?.status;
      const bookingId = (r as any)?.booking_id;
      if (status === "booked" && bookingId) {
        const [bookingRes, settingsRes] = await Promise.all([
          context.supabase
            .from("bookings")
            .select(
              "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
            )
            .eq("id", bookingId)
            .maybeSingle(),
          context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (bookingRes.error) throw bookingRes.error;
        if (settingsRes.error) throw settingsRes.error;
        const booking = bookingRes.data as any;
        if (booking?.member && booking?.class) {
          await insertNotificationDraftRows(
            context.supabase,
            buildNotificationDraftRows({
              eventKey: "booking_confirmed",
              channels: ["whatsapp", "email"],
              audience: "member",
              member: booking.member,
              appLanguage: null,
              studioSettings: settingsRes.data ?? null,
              relatedIds: { bookingId: booking.id, classId: booking.class_id },
              variables: buildClassVariables(booking.class),
            }),
          );
        }
      } else if (status === "offered") {
        const [entryRes, settingsRes] = await Promise.all([
          context.supabase
            .from("waitlist_entries")
            .select(
              "id,class_id,member:members(id,name,phone,email,preferred_language,status),class:classes(id,title,starts_at,instructor:instructors(name))",
            )
            .eq("id", data.entryId)
            .maybeSingle(),
          context.supabase.from("studio_settings").select("*").eq("id", 1).maybeSingle(),
        ]);
        if (entryRes.error) throw entryRes.error;
        if (settingsRes.error) throw settingsRes.error;
        const entry = entryRes.data as any;
        if (entry?.member && entry?.class) {
          const waitlistExpiresAt = new Date(
            Date.now() + Number(settingsRes.data?.waitlist_claim_window_minutes ?? 60) * 60_000,
          );
          await insertNotificationDraftRows(
            context.supabase,
            buildNotificationDraftRows({
              eventKey: "waitlist_spot_available",
              channels: ["whatsapp", "email"],
              audience: "member",
              member: entry.member,
              appLanguage: null,
              studioSettings: settingsRes.data ?? null,
              relatedIds: { classId: entry.class_id, waitlistEntryId: entry.id },
              variables: buildClassVariables(entry.class),
              delivery: {
                waitlistExpiresAt,
              },
            }),
          );
          await enqueueWaitlistMemberPush(entry, waitlistExpiresAt);
        }
      }
    } catch (draftError) {
      console.error("waitlist_promote_draft_prepare_failed", draftError);
    }
    await kickUnifiedMessagingAfterCommit();
    return r;
  });

// ===== Settings =====
export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("studio_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data;
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        studio_name: z.string().min(1),
        default_cancellation_window_hours: z.number().int().min(0),
        default_capacity: z.number().int().positive(),
        default_language: z.string().min(1),
        default_credit_cost: z.number().int().min(0),
        rooms: z.array(z.string()),
        energy_labels: z.array(z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase
      .from("studio_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

// ===== Audit =====
export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ entityType: z.string().optional(), entityId: z.string().uuid().optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    let q = context.supabase
      .from("admin_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.entityId) q = q.eq("entity_id", data.entityId);
    const { data: rows } = await q;
    return rows ?? [];
  });

// ===== Plans / Packages =====
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { data } = await context.supabase
      .from("plans")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []).filter((p: any) => !isTestRecord(p.name_en) && !isTestRecord(p.name));
  });

export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        credits: z.number().int().min(0),
        price_cents: z.number().int().min(0),
        currency: z.string().min(1).default("USD"),
        duration_days: z.number().int().positive().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase
        .from("plans")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("plans")
      .insert(data)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const assignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        memberId: z.string().uuid(),
        planId: z.string().uuid(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("admin_assign_plan", {
      p_actor_id: context.userId,
      p_member_id: data.memberId,
      p_plan_id: data.planId,
      p_notes: data.notes ?? undefined,
    });
    if (error) throw error;
    return r;
  });

export const listMemberPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ memberId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    if (data.memberId) {
      await context.supabase.rpc("sweep_member_credits", { p_member_id: data.memberId });
    } else {
      await context.supabase.rpc("sweep_all_members_credits");
    }
    let q = context.supabase
      .from("member_plans")
      .select("*, plan:plans(name,description,credits,duration_days), member:members(id,name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.memberId) q = q.eq("member_id", data.memberId);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const generateClassFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ templateId: z.string().uuid(), startsAt: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("admin_generate_class_from_template", {
      p_actor_id: context.userId,
      p_template_id: data.templateId,
      p_start_at: data.startsAt,
    });
    if (error) throw error;
    return r;
  });

// ===== Weekly Planner =====
export const weekClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ weekStart: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const start = new Date(data.weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const { data: rows } = await context.supabase
      .from("classes")
      .select("*, instructor:instructors(id,name)")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at");
    return rows ?? [];
  });

// ===== Member password (admin only) =====
export const sendMemberPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ memberId: z.string().uuid(), redirectTo: z.string().url() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.memberId);
    if (uErr || !user?.user?.email) throw new Error("Member has no email on file");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(user.user.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw error;
    return { ok: true, email: user.user.email };
  });

export const setMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ memberId: z.string().uuid(), password: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.memberId, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true };
  });

// ===== Program types =====
export const listProgramTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("program_types")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const upsertProgramType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z
          .string()
          .min(1)
          .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
        name_en: z.string().min(1),
        name_he: z.string().min(1),
        name_ar: z.string().min(1),
        description_en: z.string().nullable().optional(),
        description_he: z.string().nullable().optional(),
        description_ar: z.string().nullable().optional(),
        age_groups: z.array(z.string()).default([]),
        level: z.string().nullable().optional(),
        default_duration_minutes: z.number().int().positive().default(60),
        default_capacity: z.number().int().positive().default(12),
        default_credit_cost: z.number().int().min(0).default(1),
        equipment: z.array(z.string()).default([]),
        color_tag: z.string().default("#D4AF6A"),
        cover_image_url: z.string().nullable().optional(),
        sort_order: z.number().int().default(0),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("program_types").update(rest).eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("program_types")
      .insert(data)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const archiveProgramType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase
      .from("program_types")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ===== Studio Pulse =====
// Live, calm snapshot of upcoming classes with roster, capacity, waitlist, and care signals.
// Used by /admin/pulse and the instructor home.
export const studioPulse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        hoursAhead: z.number().int().min(1).max(168).optional(),
        mineOnly: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const role = await ensureStaff(context.supabase, context.userId, "staff");
    const { supabase } = context;
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + (data.hoursAhead ?? 48));

    // Resolve the caller's instructor id when they want only their own classes.
    let myInstructorId: string | null = null;
    let mineOnlyEffective = false;
    if (data.mineOnly && role === "instructor") {
      const { data: inst } = await supabase
        .from("instructors")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      myInstructorId = inst?.id ?? null;
      mineOnlyEffective = !!myInstructorId;
    }

    let q = supabase
      .from("classes")
      .select(
        "id, title, starts_at, duration_minutes, capacity, booked_count, waitlist_count, room, status, image_url, energy, credit_cost, cancellation_window_hours, instructor:instructors(id,name,avatar_url), room_ref:rooms(id,name,color), program_type:program_types(id,name_en,name_he,name_ar,level,image_url)",
      )
      .gte("starts_at", new Date(now.getTime() - 30 * 60_000).toISOString())
      .lte("starts_at", end.toISOString())
      .neq("status", "archived")
      .order("starts_at")
      .limit(40);
    if (mineOnlyEffective && myInstructorId) q = q.eq("instructor_id", myInstructorId);
    const { data: classes } = await q;

    const visibleClasses = (classes ?? []).filter((c: any) => !hasTestClassRecord(c));
    const classIds = visibleClasses.map((c: any) => c.id);
    if (classIds.length === 0) {
      return {
        generated_at: now.toISOString(),
        classes: [] as any[],
        mine_only: mineOnlyEffective,
      };
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id, class_id, status, member:members(id, name, attendance_count, care_notes, remaining_credits)",
      )
      .in("class_id", classIds)
      .eq("status", "booked")
      .order("created_at");

    const rosterByClass = new Map<string, any[]>();
    for (const b of bookings ?? []) {
      const arr = rosterByClass.get((b as any).class_id) ?? [];
      arr.push(b);
      rosterByClass.set((b as any).class_id, arr);
    }

    const enriched = visibleClasses.map((c: any) => {
      const roster = rosterByClass.get(c.id) ?? [];
      const members = roster.map((b: any) => b.member).filter(Boolean);
      const firstTimers = members.filter((m: any) => (m.attendance_count ?? 0) === 0).length;
      const careFlags = members.filter((m: any) => !!m.care_notes).length;
      const lowCredits = members.filter((m: any) => (m.remaining_credits ?? 0) <= 1).length;
      return {
        ...c,
        roster_summary: {
          booked: roster.length,
          first_timers: firstTimers,
          care_flags: careFlags,
          low_credits: lowCredits,
        },
        roster_preview: members.slice(0, 6).map((m: any) => ({
          id: m.id,
          name: m.name,
          is_first_timer: (m.attendance_count ?? 0) === 0,
          has_care_notes: !!m.care_notes,
          low_credits: (m.remaining_credits ?? 0) <= 1,
        })),
      };
    });

    return { generated_at: now.toISOString(), classes: enriched, mine_only: mineOnlyEffective };
  });
