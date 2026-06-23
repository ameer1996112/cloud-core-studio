import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BookingStatus = "booked" | "already_booked" | "full" | "insufficient_credits" | "error";

export const getNextClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cls, error } = await supabase
      .from("classes")
      .select("*, instructor:instructors(id,name,bio_short,avatar_url)")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const { data: member } = await supabase
      .from("members")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    let myBooking = null as null | { id: string; status: string };
    if (cls) {
      const { data: b } = await supabase
        .from("bookings")
        .select("id,status")
        .eq("class_id", cls.id)
        .eq("member_id", userId)
        .eq("status", "booked")
        .maybeSingle();
      myBooking = b ?? null;
    }

    return { cls, member, myBooking };
  });

export const getMemberSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    const { data: classes, error } = await supabase
      .from("classes")
      .select(
        "*, instructor:instructors(id,name,bio_short), program_type:program_types(id,name_en,color_tag,level)",
      )
      .eq("status", "scheduled")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at", { ascending: true });
    if (error) throw error;

    const { data: member } = await supabase
      .from("members")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const ids = (classes ?? []).map((c) => c.id);
    const myBookingsByClass: Record<string, { id: string; status: string }> = {};
    if (ids.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id,status,class_id")
        .in("class_id", ids)
        .eq("member_id", userId)
        .eq("status", "booked");
      for (const b of bookings ?? [])
        myBookingsByClass[b.class_id as string] = {
          id: b.id as string,
          status: b.status as string,
        };
    }

    return { classes: classes ?? [], member, myBookingsByClass };
  });

export const bookClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ classId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("book_class_v2", {
      p_actor_id: context.userId,
      p_class_id: data.classId,
    });
    if (error) return { status: "error" as const, message: error.message };
    return result as {
      status: BookingStatus;
      booking_id?: string;
      remaining_credits?: number;
      message?: string;
    };
  });

export const getMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select("id,status,created_at,credit_cost,class:classes(*, instructor:instructors(id,name))")
      .eq("member_id", userId)
      .eq("status", "booked")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getCloudCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, class:classes(*, instructor:instructors(id,name,bio_short,avatar_url))")
      .eq("id", data.bookingId)
      .eq("member_id", userId)
      .maybeSingle();
    if (error) throw error;
    const { data: member } = await supabase
      .from("members")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return { booking, member };
  });

export const getStudioPulse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = profile?.role;
    if (role !== "instructor" && role !== "admin") {
      throw new Error("forbidden");
    }

    const { data: cls } = await supabase
      .from("classes")
      .select("*, instructor:instructors(id,name)")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!cls) return { cls: null, roster: [] };

    const { data: bookings } = await supabase
      .from("bookings")
      .select(
        "id,status,member:members(id,name,remaining_credits,attendance_count,last_visit_at,energy_preference,preferred_language)",
      )
      .eq("class_id", cls.id)
      .eq("status", "booked");

    return { cls, roster: bookings ?? [] };
  });
