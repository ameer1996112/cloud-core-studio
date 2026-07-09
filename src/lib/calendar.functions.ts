import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasTestClassRecord, isTestRecord } from "@/lib/test-records";

async function ensureStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "admin" && data?.role !== "instructor") throw new Error("forbidden");
}

/** Returns classes within a date range with joined room + instructor for the multi-lane calendar. */
export const calendarRange = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fromIso: z.string(), toIso: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    const [classesRes, roomsRes] = await Promise.all([
      context.supabase
        .from("classes")
        .select(
          "id, title, starts_at, duration_minutes, capacity, booked_count, waitlist_count, status, member_visible, room, room_id, image_url, instructor:instructors(id,name,avatar_url), room_ref:rooms(id,name,color,capacity), program:program_types(id,name_en,name_he,name_ar,color:color_tag)",
        )
        .gte("starts_at", data.fromIso)
        .lte("starts_at", data.toIso)
        .order("starts_at"),
      (context.supabase as any).from("rooms").select("*").eq("active", true).order("name"),
    ]);
    if (classesRes.error) throw classesRes.error;
    if (roomsRes.error) throw roomsRes.error;
    return {
      classes: (classesRes.data ?? []).filter((c: any) => !hasTestClassRecord(c)),
      rooms: (roomsRes.data ?? []).filter((r: any) => !isTestRecord(r.name)),
    };
  });
