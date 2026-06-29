import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";
import { hasTestClassRecord, hasTestPlanRecord, isTestRecord } from "@/lib/test-records";

const classSelect =
  "id,title,starts_at,duration_minutes,capacity,booked_count,waitlist_count,room,energy,credit_cost,cancellation_window_hours,status,image_url,image_card_url,image_hero_url,image_thumb_url,room_id,instructor:instructors(id,name,bio_short,avatar_url),program_type:program_types(id,name_en,name_he,name_ar,color_tag,level,description_en,description_he,description_ar,image_url,image_card_url,image_hero_url,image_thumb_url,cover_image_url),room_ref:rooms(id,name,image_url,capacity)";

async function insertNotificationDraftRows(supabase: any, rows: any[]) {
  if (!rows.length) return;
  const { error } = await supabase
    .from("notification_logs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error("notification_draft_insert_failed", error.message);
}

function buildClassVariables(cls: any) {
  return {
    class_name: cls.title,
    class_date: new Date(cls.starts_at).toLocaleDateString("en-GB"),
    class_time: new Date(cls.starts_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    instructor_name: cls.instructor?.name ?? "",
  };
}

export const getMemberHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const [memberRes, nextBookingRes, recentClassesRes, activePlanRes] = await Promise.all([
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
    ]);

    const upcoming = (nextBookingRes.data ?? []).filter(
      (b: any) => b.class && !hasTestClassRecord(b),
    ) as any[];
    return {
      member: memberRes.data,
      upcoming,
      nextBooking: upcoming[0] ?? null,
      recommended: (recentClassesRes.data ?? []).filter((c: any) => !hasTestClassRecord(c)),
      activePlan:
        activePlanRes.data && !hasTestPlanRecord(activePlanRes.data) ? activePlanRes.data : null,
    };
  });

export const listAvailableClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at", { ascending: true });
    if (error) throw error;

    const ids = (classes ?? []).map((c) => c.id);
    const [bookingsRes, waitlistRes, memberRes] = await Promise.all([
      ids.length
        ? supabase
            .from("bookings")
            .select("id,class_id,status")
            .in("class_id", ids)
            .eq("member_id", userId)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase
            .from("waitlist_entries")
            .select("id,class_id,status")
            .in("class_id", ids)
            .eq("member_id", userId)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("members").select("remaining_credits").eq("id", userId).maybeSingle(),
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
    };
  });

export const getClassDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cls, error } = await supabase
      .from("classes")
      .select(classSelect)
      .eq("id", data.classId)
      .maybeSingle();
    if (error) throw error;

    const [bookingRes, waitlistRes, memberRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,status,credit_cost")
        .eq("class_id", data.classId)
        .eq("member_id", userId)
        .maybeSingle(),
      supabase
        .from("waitlist_entries")
        .select("id,status,created_at")
        .eq("class_id", data.classId)
        .eq("member_id", userId)
        .maybeSingle(),
      supabase.from("members").select("remaining_credits,name").eq("id", userId).maybeSingle(),
    ]);
    return {
      cls,
      myBooking: bookingRes.data,
      myWaitlist: waitlistRes.data,
      member: memberRes.data,
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
        console.error("booking_cancelled_draft_prepare_failed", draftError);
      }
    }
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
    return result as { status: string };
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
    };
  });

export const getMyPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [memberRes, mineRes, plansRes, ledgerRes, paymentsRes] = await Promise.all([
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
          "id,amount,currency,method,status,provider,paid_at,created_at,notes,plan:plans(id,name,description,credits,duration_days,price_cents,currency),receipt:receipts(id,receipt_number)",
        )
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      member: memberRes.data,
      mine: (mineRes.data ?? []).filter((p: any) => !hasTestPlanRecord(p)),
      plans: (plansRes.data ?? []).filter((p: any) => !hasTestPlanRecord(p)),
      ledger: (ledgerRes.data ?? []).filter((row: any) => !isTestRecord(row.reason)),
      payments: (paymentsRes.data ?? []).filter((p: any) => !hasTestPlanRecord(p)),
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
