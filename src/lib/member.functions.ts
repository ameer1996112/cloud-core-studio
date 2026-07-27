import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { kickUnifiedMessagingAfterCommit } from "@/lib/unifiedMessagingKick.server";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
import { hasTestClassRecord, hasTestPlanRecord, isTestRecord } from "@/lib/test-records";
import { formatClassDate, formatClassTime } from "@/lib/messageTemplate";
import {
  resolvePersonalConciergeExperience,
  resolvePersonalConciergeVisibility,
  type PersonalConciergeCommunicationPace,
} from "@/lib/personalConciergeExperience";

export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    const request = getRequest();
    if (!request?.headers) {
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false },
      });
      return next({ context: { supabase, userId: null } });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false },
      });
      return next({ context: { supabase, userId: null } });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false },
      });
      return next({ context: { supabase, userId: null } });
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims || !data.claims.sub) {
      const supabaseAnon = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false },
      });
      return next({ context: { supabase: supabaseAnon, userId: null } });
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
      },
    });
  },
);

const classSelect =
  "id,title,starts_at,duration_minutes,capacity,booked_count,waitlist_count,room,energy,credit_cost,cancellation_window_hours,status,member_visible,image_url,image_card_url,image_hero_url,image_thumb_url,room_id,instructor:instructors(id,name,bio_short,avatar_url),program_type:program_types(id,name_en,name_he,name_ar,color_tag,level,description_en,description_he,description_ar,image_url,image_card_url,image_hero_url,image_thumb_url,cover_image_url),room_ref:rooms(id,name,image_url,capacity)";

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

function hasUsableActivePackage(
  plans: Array<{ expires_at?: string | null }> | null | undefined,
): boolean {
  const now = Date.now();
  return (plans ?? []).some(
    (plan) => !plan.expires_at || new Date(plan.expires_at).getTime() > now,
  );
}

export const getMemberHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.rpc("sweep_member_credits", { p_member_id: userId });
    const now = new Date().toISOString();

    const [
      memberRes,
      nextBookingRes,
      recentClassesRes,
      activePlanRes,
      relationshipRes,
      attendanceRes,
      communicationPaceRes,
    ] = await Promise.all([
      supabase
        .from("members")
        .select(
          "id,name,remaining_credits,attendance_count,last_visit_at,preferred_language,energy_preference,phone,email,status,emergency_contact",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select(`id,status,credit_cost,class:classes(${classSelect})`)
        .eq("member_id", userId)
        .eq("status", "booked")
        .gte("class.starts_at", now)
        .order("created_at", { ascending: true })
        .limit(5),
      supabase
        .from("classes")
        .select(classSelect)
        .eq("status", "scheduled")
        .eq("member_visible", true)
        .gte("starts_at", now)
        .order("starts_at", { ascending: true })
        .limit(6),
      supabase
        .from("member_plans")
        .select(
          "id,credits_granted,expires_at,starts_at,status,created_at,plan:plans(id,name,description,credits,duration_days)",
        )
        .eq("member_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("personal_concierge_relationships")
        .select("personalization_paused")
        .eq("member_id", userId)
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("attendance_records")
        .select("status,marked_at,booking:bookings!inner(member_id)")
        .eq("booking.member_id", userId)
        .in("status", ["attended", "no_show"])
        .order("marked_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("personal_concierge_preference_evidence")
        .select("preference_value")
        .eq("member_id", userId)
        .eq("preference_key", "communication_pace")
        .eq("member_visible", true)
        .is("removed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const upcoming = (nextBookingRes.data ?? []).filter(
      (b: any) => b.class && !hasTestClassRecord(b),
    ) as any[];
    const member = memberRes.data;
    const nextBooking = upcoming[0] ?? null;
    const nextClass = nextBooking?.class ?? null;
    const locale =
      member?.preferred_language === "ar" || member?.preferred_language === "en"
        ? member.preferred_language
        : "he";
    const concierge =
      member &&
      resolvePersonalConciergeVisibility(process.env, userId) &&
      !relationshipRes.error &&
      relationshipRes.data &&
      !attendanceRes.error &&
      !communicationPaceRes.error
        ? resolvePersonalConciergeExperience({
            member: {
              firstName:
                member.name?.trim().split(/\s+/)[0] || (locale === "he" ? "יקרה" : "friend"),
              locale,
              attendanceCount: member.attendance_count ?? 0,
              personalizationPaused: relationshipRes.data.personalization_paused === true,
              communicationPace: ["quiet", "balanced", "attentive"].includes(
                communicationPaceRes.data?.preference_value,
              )
                ? (communicationPaceRes.data
                    ?.preference_value as PersonalConciergeCommunicationPace)
                : undefined,
            },
            nextBooking: nextClass
              ? {
                  id: nextBooking.id,
                  className: nextClass.title,
                  startsAt: nextClass.starts_at,
                  instructorName: nextClass.instructor?.name ?? null,
                  locationName: nextClass.room_ref?.name ?? nextClass.room ?? null,
                }
              : null,
            latestAttendance: attendanceRes.data
              ? {
                  status: attendanceRes.data.status,
                  markedAt: attendanceRes.data.marked_at,
                }
              : null,
            now,
          })
        : null;
    return {
      member,
      upcoming,
      nextBooking,
      recommended: (recentClassesRes.data ?? []).filter((c: any) => !hasTestClassRecord(c)),
      activePlan:
        activePlanRes.data && !hasTestPlanRecord(activePlanRes.data) ? activePlanRes.data : null,
      concierge,
    };
  });

export const listAvailableClasses = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((data) =>
    z.object({ days: z.number().min(1).max(60).default(14) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const start = new Date();
    const end = new Date(start.getTime() + data.days * 24 * 3600 * 1000);
    const { data: classes, error } = await supabase
      .from("classes")
      .select(classSelect)
      .eq("status", "scheduled")
      .eq("member_visible", true)
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at", { ascending: true });
    if (error) throw error;

    const ids = (classes ?? []).map((c) => c.id);
    const [bookingsRes, waitlistRes, memberRes, activePlansRes] = await Promise.all([
      ids.length && userId
        ? supabase
            .from("bookings")
            .select("id,class_id,status")
            .in("class_id", ids)
            .eq("member_id", userId)
        : Promise.resolve({ data: [] as any[] }),
      ids.length && userId
        ? supabase
            .from("waitlist_entries")
            .select("id,class_id,status")
            .in("class_id", ids)
            .eq("member_id", userId)
        : Promise.resolve({ data: [] as any[] }),
      userId
        ? supabase.from("members").select("remaining_credits").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase
            .from("member_plans")
            .select("expires_at")
            .eq("member_id", userId)
            .eq("status", "active")
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const bookingsByClass: Record<string, { id: string; status: string }> = {};
    for (const b of bookingsRes.data ?? []) {
      if (b.status === "booked")
        bookingsByClass[b.class_id as string] = { id: b.id as string, status: b.status as string };
    }
    const waitlistByClass: Record<string, { id: string; status: string }> = {};
    for (const w of waitlistRes.data ?? []) {
      if (w.status === "waiting" || w.status === "ready")
        waitlistByClass[w.class_id as string] = { id: w.id as string, status: w.status as string };
    }
    return {
      classes: (classes ?? []).filter((c: any) => !hasTestClassRecord(c)),
      bookingsByClass,
      waitlistByClass,
      member: memberRes.data,
      hasActivePackage: hasUsableActivePackage(
        activePlansRes.data as Array<{ expires_at?: string | null }> | null,
      ),
    };
  });

export const getClassDetail = createServerFn({ method: "GET" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cls, error } = await supabase
      .from("classes")
      .select(classSelect)
      .eq("id", data.classId)
      .eq("member_visible", true)
      .maybeSingle();
    if (error) throw error;

    const [bookingRes, waitlistRes, memberRes, activePlansRes] = await Promise.all([
      userId
        ? supabase
            .from("bookings")
            .select("id,status,credit_cost")
            .eq("class_id", data.classId)
            .eq("member_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase
            .from("waitlist_entries")
            .select("id,status,created_at")
            .eq("class_id", data.classId)
            .eq("member_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase.from("members").select("remaining_credits,name").eq("id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      userId
        ? supabase
            .from("member_plans")
            .select("expires_at")
            .eq("member_id", userId)
            .eq("status", "active")
        : Promise.resolve({ data: [] as any[] }),
    ]);
    return {
      cls,
      myBooking: bookingRes.data,
      myWaitlist: waitlistRes.data,
      member: memberRes.data,
      hasActivePackage: hasUsableActivePackage(
        activePlansRes.data as Array<{ expires_at?: string | null }> | null,
      ),
    };
  });

export const memberCancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("member_cancel_booking", {
      p_actor_id: context.userId,
      p_booking_id: data.bookingId,
    });
    if (error) return { status: "error", message: error.message } as const;
    const typedResult = result as { status: string; message?: string; deadline?: string };
    if (typedResult.status === "cancelled") {
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
              eventKey: "booking_cancelled_by_member",
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
        console.error("booking_cancelled_by_member_draft_prepare_failed", draftError);
      }
    }
    if (typedResult.status === "cancelled") await kickUnifiedMessagingAfterCommit();
    return typedResult;
  });

export const joinWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("member_join_waitlist", {
      p_actor_id: context.userId,
      p_class_id: data.classId,
    });
    if (error) return { status: "error", message: error.message } as const;
    const typedResult = result as { status: string; entry_id?: string; position?: number };
    if (typedResult.status === "waiting" && typedResult.entry_id) {
      try {
        const [entryRes, settingsRes] = await Promise.all([
          context.supabase
            .from("waitlist_entries")
            .select(
              "id,class_id,member:members(id,name,phone,email,preferred_language),class:classes(id,title,starts_at,instructor:instructors(name))",
            )
            .eq("id", typedResult.entry_id)
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
        console.error("waitlist_joined_draft_prepare_failed", draftError);
      }
    }
    if (typedResult.status === "waiting") await kickUnifiedMessagingAfterCommit();
    return typedResult;
  });

export const leaveWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("member_leave_waitlist", {
      p_actor_id: context.userId,
      p_entry_id: data.entryId,
    });
    if (error) return { status: "error", message: error.message } as const;
    const typedResult = result as { status: string };
    if (["left", "removed"].includes(typedResult.status)) await kickUnifiedMessagingAfterCommit();
    return typedResult;
  });

export const getMyBookingsAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [bookingsRes, waitlistRes, attendanceRes] = await Promise.all([
      supabase
        .from("bookings")
        .select(`id,status,credit_cost,created_at,class:classes(${classSelect})`)
        .eq("member_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("waitlist_entries")
        .select(`id,status,created_at,class:classes(${classSelect})`)
        .eq("member_id", userId)
        .in("status", ["waiting", "ready"])
        .order("created_at", { ascending: false }),
      supabase.from("attendance_records").select("booking_id,status,marked_at"),
    ]);
    const attMap: Record<string, { status: string; marked_at: string | null }> = {};
    for (const a of attendanceRes.data ?? []) {
      attMap[a.booking_id as string] = {
        status: a.status as string,
        marked_at: a.marked_at as string | null,
      };
    }
    return {
      bookings: (bookingsRes.data ?? []).filter((b: any) => !hasTestClassRecord(b)),
      waitlist: (waitlistRes.data ?? []).filter((w: any) => !hasTestClassRecord(w)),
      attendanceByBooking: attMap,
      hasAttended: (bookingsRes.data ?? []).some(
        (booking: any) => attMap[booking.id]?.status === "attended",
      ),
    };
  });

export const getMyPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.rpc("sweep_member_credits", { p_member_id: userId });
    const [memberRes, mineRes, plansRes, ledgerRes, paymentsRes, subscriptionsRes] =
      await Promise.all([
        supabase
          .from("members")
          .select(
            "remaining_credits,name,email,phone,status,preferred_language,emergency_contact,energy_preference,created_at",
          )
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("member_plans")
          .select(
            "id,credits_granted,starts_at,expires_at,status,notes,created_at,plan:plans(id,name,description,credits,duration_days,price_cents,currency)",
          )
          .eq("member_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("plans")
          .select("*")
          .eq("active", true)
          .order("price_cents", { ascending: true }),
        supabase
          .from("credit_transactions")
          .select("id,amount_delta,reason,created_at,related_booking_id")
          .eq("member_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("payments")
          .select(
            "id,amount,currency,method,status,provider,paid_at,created_at,notes,subscription_id,plan:plans(id,name,description,credits,duration_days,price_cents,currency),receipt:receipts(id,receipt_number)",
          )
          .eq("member_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("member_subscriptions")
          .select(
            "id,status,amount,currency,next_charge_at,current_period_end,card_mask,cancelled_at,created_at,plan:plans(id,name,description,credits,duration_days,price_cents,currency)",
          )
          .eq("member_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
    return {
      member: memberRes.data,
      mine: (mineRes.data ?? []).filter((p: any) => !hasTestPlanRecord(p)),
      plans: (plansRes.data ?? []).filter((p: any) => !hasTestPlanRecord(p)),
      ledger: (ledgerRes.data ?? []).filter((row: any) => !isTestRecord(row.reason)),
      payments: (paymentsRes.data ?? []).filter((p: any) => !hasTestPlanRecord(p)),
      subscriptions: (subscriptionsRes.data ?? []).filter((s: any) => !hasTestPlanRecord(s)),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(120).optional(),
        phone: z.string().max(40).nullable().optional(),
        preferred_language: z.enum(["en", "he", "ar"]).optional(),
        emergency_contact: z.string().max(200).nullable().optional(),
        energy_preference: z.string().max(40).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("members").update(data).eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const requestMyAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        reason: z.string().max(1000).nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("members")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const { data: existing, error: existingError } = await (supabase as any)
      .from("account_deletion_requests")
      .select("id,status")
      .eq("member_id", userId)
      .in("status", ["requested", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.id) return { ok: true, status: existing.status, duplicate: true };

    const { error } = await (supabase as any).from("account_deletion_requests").insert({
      member_id: userId,
      email: member?.email ?? null,
      reason: data.reason?.trim() || null,
      status: "requested",
    });
    if (error) throw error;
    return { ok: true, status: "requested", duplicate: false };
  });
