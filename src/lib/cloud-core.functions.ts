import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNotificationDraftRows } from "@/lib/notificationDrafts";

export type BookingStatus = "booked" | "already_booked" | "full" | "insufficient_credits" | "error";

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
    const { data: result, error } = await context.supabase.rpc("book_class_v2", {
      p_actor_id: context.userId,
      p_class_id: data.classId,
    });
    if (error) return { status: "error" as const, message: error.message };
    const typedResult = result as {
      status: BookingStatus;
      booking_id?: string;
      remaining_credits?: number;
      message?: string;
    };
    const bookingId = (typedResult as any)?.booking_id;
    if ((typedResult as any)?.status === "booked" && bookingId) {
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
        console.error("booking_confirmed_draft_prepare_failed", draftError);
      }
    }
    return typedResult;
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
