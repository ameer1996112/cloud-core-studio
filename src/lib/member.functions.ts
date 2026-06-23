import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const classSelect =
  "id,title,starts_at,duration_minutes,capacity,booked_count,waitlist_count,room,energy,credit_cost,cancellation_window_hours,status,image_url,image_card_url,image_hero_url,image_thumb_url,room_id,instructor:instructors(id,name,bio_short,avatar_url),program_type:program_types(id,name_en,name_he,name_ar,color_tag,level,description_en,description_he,description_ar,image_url,image_card_url,image_hero_url,image_thumb_url,cover_image_url),room_ref:rooms(id,name,image_url,capacity)";

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

    const upcoming = (nextBookingRes.data ?? []).filter((b: any) => b.class) as any[];
    return {
      member: memberRes.data,
      upcoming,
      nextBooking: upcoming[0] ?? null,
      recommended: recentClassesRes.data ?? [],
      activePlan: activePlanRes.data,
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
      classes: classes ?? [],
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
    return result as { status: string; message?: string; deadline?: string };
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
    return result as { status: string; entry_id?: string; position?: number };
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
      bookings: bookingsRes.data ?? [],
      waitlist: waitlistRes.data ?? [],
      attendanceByBooking: attMap,
    };
  });

export const getMyPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [memberRes, mineRes, plansRes, ledgerRes, paymentsRes] = await Promise.all([
      supabase.from("members").select("remaining_credits,name").eq("id", userId).maybeSingle(),
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
          "id,amount,currency,method,status,provider,paid_at,notes,plan:plans(name),receipt:receipts(id,receipt_number)",
        )
        .eq("member_id", userId)
        .order("paid_at", { ascending: false })
        .limit(50),
    ]);
    return {
      member: memberRes.data,
      mine: mineRes.data ?? [],
      plans: plansRes.data ?? [],
      ledger: ledgerRes.data ?? [],
      payments: paymentsRes.data ?? [],
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
