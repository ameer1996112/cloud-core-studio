import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureStaff(supabase: any, userId: string, level: "admin" | "staff" = "staff") {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = data?.role;
  if (level === "admin" && role !== "admin") throw new Error("forbidden");
  if (level === "staff" && role !== "admin" && role !== "instructor") throw new Error("forbidden");
  return role as "admin" | "instructor";
}

const FilterSchema = z.object({
  search: z.string().optional(),
  filter: z
    .enum([
      "all",
      "active",
      "inactive",
      "first_timer",
      "low_credits",
      "expiring_soon",
      "no_upcoming",
    ])
    .optional(),
});

/** Premium members list with filters + enrichment (active plan, upcoming booking, last visit, total spend). */
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FilterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { supabase } = context;

    let q = supabase.from("members").select("*").order("name").limit(500);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }
    if (data.filter === "active") q = q.eq("status", "active");
    if (data.filter === "inactive") q = q.eq("status", "inactive");
    if (data.filter === "first_timer") q = q.eq("attendance_count", 0);
    if (data.filter === "low_credits") q = q.lte("remaining_credits", 1);

    const { data: members, error } = await q;
    if (error) throw error;
    const ids = (members ?? []).map((m: any) => m.id);
    if (ids.length === 0) return [];

    const nowIso = new Date().toISOString();
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString();

    const [plans, upcoming, spend] = await Promise.all([
      supabase
        .from("member_plans")
        .select("member_id, expires_at, status, plan:plans(name,credits)")
        .in("member_id", ids)
        .eq("status", "active"),
      supabase
        .from("bookings")
        .select("member_id, class:classes!inner(starts_at,title)")
        .in("member_id", ids)
        .eq("status", "booked")
        .gte("class.starts_at", nowIso),
      supabase
        .from("payments")
        .select("member_id, amount, refunded_amount")
        .in("member_id", ids)
        .eq("status", "paid"),
    ]);

    const planByMember = new Map<string, any>();
    (plans.data ?? []).forEach((p: any) => {
      const cur = planByMember.get(p.member_id);
      if (!cur || (p.expires_at && (!cur.expires_at || p.expires_at > cur.expires_at)))
        planByMember.set(p.member_id, p);
    });
    const nextByMember = new Map<string, any>();
    (upcoming.data ?? []).forEach((b: any) => {
      const cur = nextByMember.get(b.member_id);
      const t = b.class?.starts_at;
      if (!cur || (t && t < cur.class?.starts_at)) nextByMember.set(b.member_id, b);
    });
    const spendByMember = new Map<string, number>();
    (spend.data ?? []).forEach((p: any) => {
      const v = Number(p.amount) - Number(p.refunded_amount ?? 0);
      spendByMember.set(p.member_id, (spendByMember.get(p.member_id) ?? 0) + v);
    });

    let enriched = (members ?? []).map((m: any) => {
      const plan = planByMember.get(m.id);
      const next = nextByMember.get(m.id);
      return {
        ...m,
        active_plan: plan ? { name: plan.plan?.name, expires_at: plan.expires_at } : null,
        next_booking: next ? { title: next.class?.title, starts_at: next.class?.starts_at } : null,
        total_spend: Number((spendByMember.get(m.id) ?? 0).toFixed(2)),
        is_first_timer: (m.attendance_count ?? 0) === 0,
        has_care_notes: !!m.care_notes,
      };
    });

    if (data.filter === "expiring_soon") {
      enriched = enriched.filter(
        (m: any) => m.active_plan?.expires_at && m.active_plan.expires_at <= in14,
      );
    }
    if (data.filter === "no_upcoming") {
      enriched = enriched.filter((m: any) => !m.next_booking);
    }
    return enriched;
  });

/** Single-member detail with everything the profile drawer needs. */
export const getMemberDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { supabase } = context;
    const [member, bookings, ledger, attendance, notes, payments, plans] = await Promise.all([
      supabase.from("members").select("*").eq("id", data.memberId).maybeSingle(),
      supabase
        .from("bookings")
        .select("*, class:classes(id,title,starts_at,room)")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("credit_transactions")
        .select("*")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("attendance_records")
        .select("*, class:classes(title,starts_at)")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("member_notes")
        .select("*")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*, plan:plans(name)")
        .eq("member_id", data.memberId)
        .order("paid_at", { ascending: false })
        .limit(40),
      supabase
        .from("member_plans")
        .select("*, plan:plans(name, credits, duration_days)")
        .eq("member_id", data.memberId)
        .order("created_at", { ascending: false }),
    ]);
    const totalSpend = (payments.data ?? [])
      .filter((p: any) => p.status === "paid")
      .reduce((a: number, p: any) => a + Number(p.amount) - Number(p.refunded_amount ?? 0), 0);
    return {
      member: member.data,
      bookings: bookings.data ?? [],
      ledger: ledger.data ?? [],
      attendance: attendance.data ?? [],
      notes: notes.data ?? [],
      payments: payments.data ?? [],
      plans: plans.data ?? [],
      total_spend: Number(totalSpend.toFixed(2)),
    };
  });

export const updateMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        memberId: z.string().uuid(),
        name: z.string().min(1).optional(),
        phone: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        tags: z.array(z.string()).optional(),
        care_notes: z.string().nullable().optional(),
        emergency_contact: z.string().nullable().optional(),
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

export const addMemberNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        memberId: z.string().uuid(),
        body: z.string().min(1).max(2000),
        important: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase.from("member_notes").insert({
      member_id: data.memberId,
      body: data.body,
      important: data.important ?? false,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteMemberNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ noteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "admin");
    const { error } = await context.supabase.from("member_notes").delete().eq("id", data.noteId);
    if (error) throw error;
    return { ok: true };
  });

/** Rich roster for the class roster drawer — adds credits, first-time flag, note flag, attendance state. */
export const getClassRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { supabase } = context;
    const [cls, bookings, waitlist] = await Promise.all([
      supabase
        .from("classes")
        .select("*, instructor:instructors(id,name), room_obj:rooms(id,name,color,capacity)")
        .eq("id", data.classId)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select(
          `
        id, status, credit_cost, created_at,
        member:members(id, name, phone, remaining_credits, attendance_count, care_notes, status),
        attendance:attendance_records(status)
      `,
        )
        .eq("class_id", data.classId)
        .order("created_at"),
      supabase
        .from("waitlist_entries")
        .select("id, status, created_at, member:members(id,name,phone,remaining_credits)")
        .eq("class_id", data.classId)
        .order("created_at"),
    ]);

    const memberIds = (bookings.data ?? []).map((b: any) => b.member?.id).filter(Boolean);
    const activePlanByMember = new Map<string, any>();
    if (memberIds.length > 0) {
      const { data: plans } = await supabase
        .from("member_plans")
        .select("member_id, plan:plans(name)")
        .in("member_id", memberIds)
        .eq("status", "active");
      (plans ?? []).forEach((p: any) => activePlanByMember.set(p.member_id, p.plan));
    }

    const roster = (bookings.data ?? []).map((b: any) => ({
      id: b.id,
      status: b.status,
      credit_cost: b.credit_cost,
      created_at: b.created_at,
      attendance_state: b.attendance?.[0]?.status ?? b.status,
      member: b.member && {
        ...b.member,
        is_first_timer: (b.member.attendance_count ?? 0) <= 1,
        has_care_notes: !!b.member.care_notes,
        active_plan: activePlanByMember.get(b.member.id) ?? null,
      },
    }));

    return {
      class: cls.data,
      bookings: roster,
      waitlist: waitlist.data ?? [],
      checked_in_count: roster.filter(
        (b) => b.attendance_state === "checked_in" || b.attendance_state === "attended",
      ).length,
    };
  });

/** Search members for the "add to class" picker. */
export const searchMembersForClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ query: z.string().optional(), classId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId, "staff");
    const { supabase } = context;
    // exclude members already booked
    const { data: booked } = await supabase
      .from("bookings")
      .select("member_id")
      .eq("class_id", data.classId)
      .eq("status", "booked");
    const excluded = (booked ?? []).map((b: any) => b.member_id);
    let q = supabase
      .from("members")
      .select("id, name, phone, remaining_credits, attendance_count")
      .eq("status", "active")
      .order("name")
      .limit(30);
    if (data.query) {
      const s = `%${data.query}%`;
      q = q.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
    }
    if (excluded.length) q = q.not("id", "in", `(${excluded.join(",")})`);
    const { data: rows } = await q;
    return rows ?? [];
  });
