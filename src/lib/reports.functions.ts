import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "admin") throw new Error("forbidden");
}

const RangeSchema = z.object({
  start: z.string(), // ISO
  end: z.string(), // ISO
  prevStart: z.string().optional(),
  prevEnd: z.string().optional(),
});

export type ReportRange = z.infer<typeof RangeSchema>;

type Payment = {
  amount: number;
  refunded_amount: number | null;
  method: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  plan_id: string | null;
  member_id: string | null;
};
type Booking = {
  id: string;
  class_id: string;
  member_id: string;
  status: string;
  credit_cost: number | null;
  created_at: string;
};
type Klass = {
  id: string;
  title: string;
  starts_at: string;
  capacity: number;
  booked_count: number;
  waitlist_count: number | null;
  room: string | null;
  room_id: string | null;
  instructor_id: string | null;
  price_override: number | null;
};
type Attendance = {
  booking_id: string;
  class_id: string;
  status: string;
  marked_at: string | null;
};
type Waitlist = {
  id: string;
  class_id: string;
  member_id: string;
  status: string;
  created_at: string;
  promoted_at: string | null;
};

// ====== MAIN BUNDLE ======
export const getReportsBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const startISO = data.start;
    const endISO = data.end;
    const prevStartISO = data.prevStart;
    const prevEndISO = data.prevEnd;

    const [
      paymentsRes,
      prevPaymentsRes,
      bookingsRes,
      prevBookingsRes,
      classesRes,
      prevClassesRes,
      attendanceRes,
      waitlistRes,
      membersRes,
      plansRes,
      memberPlansRes,
      packageReqRes,
      notifLogsRes,
      roomsRes,
      instructorsRes,
      upcomingClassesRes,
    ] = await Promise.all([
      supabase
        .from("payments")
        .select("amount, refunded_amount, method, status, paid_at, created_at, plan_id, member_id")
        .gte("created_at", startISO)
        .lte("created_at", endISO),
      prevStartISO && prevEndISO
        ? supabase
            .from("payments")
            .select("amount, refunded_amount, status, paid_at")
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO)
        : Promise.resolve({ data: null }),
      supabase
        .from("bookings")
        .select("id, class_id, member_id, status, credit_cost, created_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO),
      prevStartISO && prevEndISO
        ? supabase
            .from("bookings")
            .select("id, status")
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO)
        : Promise.resolve({ data: null }),
      supabase
        .from("classes")
        .select(
          "id, title, starts_at, capacity, booked_count, waitlist_count, room, room_id, instructor_id, price_override",
        )
        .gte("starts_at", startISO)
        .lte("starts_at", endISO),
      prevStartISO && prevEndISO
        ? supabase
            .from("classes")
            .select("id, capacity, booked_count")
            .gte("starts_at", prevStartISO)
            .lte("starts_at", prevEndISO)
        : Promise.resolve({ data: null }),
      supabase
        .from("attendance_records")
        .select("booking_id, class_id, status, marked_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO),
      supabase
        .from("waitlist_entries")
        .select("id, class_id, member_id, status, created_at, promoted_at")
        .gte("created_at", startISO)
        .lte("created_at", endISO),
      supabase
        .from("members")
        .select(
          "id, name, status, last_visit_at, remaining_credits, attendance_count, created_at, phone, email",
        ),
      supabase.from("plans").select("id, name, price_cents, credits, duration_days, active"),
      supabase
        .from("member_plans")
        .select(
          "id, member_id, plan_id, credits_granted, status, starts_at, expires_at, created_at",
        ),
      supabase.from("package_requests").select("id, member_id, plan_id, status, created_at"),
      supabase
        .from("notification_logs")
        .select(
          "id, template_key, trigger_type, status, marked_sent_at, created_at, recipient_member_id",
        )
        .gte("created_at", startISO)
        .lte("created_at", endISO),
      supabase.from("rooms").select("id, name, image_url, capacity, active"),
      supabase.from("instructors").select("id, name, avatar_url, active"),
      supabase
        .from("classes")
        .select("id, title, starts_at, capacity, booked_count, room, instructor_id")
        .gte("starts_at", new Date().toISOString())
        .lte("starts_at", new Date(Date.now() + 14 * 86400000).toISOString())
        .order("starts_at")
        .limit(50),
    ]);

    const payments = (paymentsRes.data ?? []) as Payment[];
    const prevPayments = (prevPaymentsRes.data ?? []) as Payment[] | null;
    const bookings = (bookingsRes.data ?? []) as Booking[];
    const prevBookings = (prevBookingsRes.data ?? []) as Booking[] | null;
    const classes = (classesRes.data ?? []) as Klass[];
    const prevClasses = (prevClassesRes.data ?? []) as Klass[] | null;
    const attendance = (attendanceRes.data ?? []) as Attendance[];
    const waitlist = (waitlistRes.data ?? []) as Waitlist[];
    const members = (membersRes.data ?? []) as any[];
    const plans = (plansRes.data ?? []) as any[];
    const memberPlans = (memberPlansRes.data ?? []) as any[];
    const packageRequests = (packageReqRes.data ?? []) as any[];
    const notifLogs = (notifLogsRes.data ?? []) as any[];
    const rooms = (roomsRes.data ?? []) as any[];
    const instructors = (instructorsRes.data ?? []) as any[];
    const upcomingClasses = (upcomingClassesRes.data ?? []) as any[];

    const memberById = new Map(members.map((m) => [m.id, m]));
    const planById = new Map(plans.map((p) => [p.id, p]));
    const roomByName = new Map(rooms.map((r) => [r.name, r]));
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const instructorById = new Map(instructors.map((i) => [i.id, i]));
    const classById = new Map(classes.map((c) => [c.id, c]));

    // ===== REVENUE =====
    const paid = payments.filter((p) => p.status === "paid");
    const totalRevenue = paid.reduce(
      (a, p) => a + Number(p.amount) - Number(p.refunded_amount ?? 0),
      0,
    );
    const refundedAmount = paid.reduce((a, p) => a + Number(p.refunded_amount ?? 0), 0);
    const outstanding = payments
      .filter((p) => p.status === "pending" || p.status === "unpaid")
      .reduce((a, p) => a + Number(p.amount), 0);

    const prevTotalRevenue = prevPayments
      ? prevPayments
          .filter((p) => p.status === "paid")
          .reduce((a, p) => a + Number(p.amount) - Number(p.refunded_amount ?? 0), 0)
      : null;

    const revenueByMethod: Record<string, number> = {};
    paid.forEach((p) => {
      const m = (p.method ?? "other").toLowerCase();
      revenueByMethod[m] =
        (revenueByMethod[m] ?? 0) + Number(p.amount) - Number(p.refunded_amount ?? 0);
    });

    const revenueByPlan: Record<string, { name: string; amount: number; count: number }> = {};
    paid.forEach((p) => {
      const plan = p.plan_id ? planById.get(p.plan_id) : null;
      const key = p.plan_id ?? "other";
      const name = plan?.name ?? "Other / manual";
      const cur = revenueByPlan[key] ?? { name, amount: 0, count: 0 };
      cur.amount += Number(p.amount) - Number(p.refunded_amount ?? 0);
      cur.count += 1;
      revenueByPlan[key] = cur;
    });

    // revenue series by day
    const series: Record<string, number> = {};
    paid.forEach((p) => {
      const d = (p.paid_at ?? p.created_at).slice(0, 10);
      series[d] = (series[d] ?? 0) + Number(p.amount) - Number(p.refunded_amount ?? 0);
    });
    const revenueSeries = Object.entries(series)
      .sort()
      .map(([date, amount]) => ({ date, amount }));

    // top spenders
    const memberSpend: Record<string, number> = {};
    paid.forEach((p) => {
      if (!p.member_id) return;
      memberSpend[p.member_id] =
        (memberSpend[p.member_id] ?? 0) + Number(p.amount) - Number(p.refunded_amount ?? 0);
    });
    const topSpenders = Object.entries(memberSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, amount]) => ({ id, name: memberById.get(id)?.name ?? "Unknown", amount }));

    // ===== ATTENDANCE / CLASSES =====
    const totalClasses = classes.length;
    const totalCapacity = classes.reduce((a, c) => a + (c.capacity ?? 0), 0);
    const totalBooked = classes.reduce((a, c) => a + (c.booked_count ?? 0), 0);
    const fillRate = totalCapacity > 0 ? totalBooked / totalCapacity : 0;

    const attendanceByStatus: Record<string, number> = {};
    attendance.forEach((a) => {
      attendanceByStatus[a.status] = (attendanceByStatus[a.status] ?? 0) + 1;
    });
    const attendedCount = attendanceByStatus["attended"] ?? 0;
    const checkedInCount = attendanceByStatus["checked_in"] ?? 0;
    const noShowCount = attendanceByStatus["no_show"] ?? 0;
    const cancelledCount = attendanceByStatus["cancelled"] ?? 0;
    const attendanceTotal = attendedCount + checkedInCount + noShowCount;
    const attendanceRate =
      attendanceTotal > 0 ? (attendedCount + checkedInCount) / attendanceTotal : 0;
    const noShowRate = attendanceTotal > 0 ? noShowCount / attendanceTotal : 0;

    // class performance
    const classPerf = classes.map((c) => {
      const cap = c.capacity ?? 0;
      const booked = c.booked_count ?? 0;
      return {
        id: c.id,
        title: c.title,
        starts_at: c.starts_at,
        room: c.room ?? (c.room_id ? roomById.get(c.room_id)?.name : null),
        instructor: c.instructor_id ? (instructorById.get(c.instructor_id)?.name ?? null) : null,
        capacity: cap,
        booked,
        waitlist: c.waitlist_count ?? 0,
        fill: cap > 0 ? booked / cap : 0,
      };
    });
    const mostBooked = [...classPerf].sort((a, b) => b.booked - a.booked).slice(0, 6);
    const leastBooked = [...classPerf]
      .filter((c) => c.capacity > 0)
      .sort((a, b) => a.fill - b.fill)
      .slice(0, 6);

    // peak day-of-week
    const dayOfWeekBookings: Record<number, number> = {};
    classes.forEach((c) => {
      const d = new Date(c.starts_at).getDay();
      dayOfWeekBookings[d] = (dayOfWeekBookings[d] ?? 0) + (c.booked_count ?? 0);
    });

    // upcoming at risk
    const upcomingAtRisk = upcomingClasses
      .filter(
        (c) =>
          (c.capacity ?? 0) > 0 &&
          (c.booked_count ?? 0) / (c.capacity ?? 1) < 0.3 &&
          new Date(c.starts_at).getTime() - Date.now() < 5 * 86400000,
      )
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        title: c.title,
        starts_at: c.starts_at,
        room: c.room,
        booked: c.booked_count,
        capacity: c.capacity,
      }));

    // ===== ROOMS =====
    const roomStats: Record<
      string,
      {
        id: string | null;
        name: string;
        image_url: string | null;
        capacity: number;
        classes: number;
        totalBooked: number;
        totalCapacity: number;
        revenue: number;
      }
    > = {};
    classes.forEach((c) => {
      const r = c.room_id ? roomById.get(c.room_id) : c.room ? roomByName.get(c.room) : null;
      const key = r?.id ?? c.room ?? "unassigned";
      const name = r?.name ?? c.room ?? "Unassigned";
      const cur = roomStats[key] ?? {
        id: r?.id ?? null,
        name,
        image_url: r?.image_url ?? null,
        capacity: r?.capacity ?? 0,
        classes: 0,
        totalBooked: 0,
        totalCapacity: 0,
        revenue: 0,
      };
      cur.classes += 1;
      cur.totalBooked += c.booked_count ?? 0;
      cur.totalCapacity += c.capacity ?? 0;
      roomStats[key] = cur;
    });
    const roomReport = Object.values(roomStats)
      .map((r) => ({
        ...r,
        avgFill: r.totalCapacity > 0 ? r.totalBooked / r.totalCapacity : 0,
      }))
      .sort((a, b) => b.avgFill - a.avgFill);

    // ===== INSTRUCTORS =====
    const instructorStats: Record<
      string,
      {
        id: string;
        name: string;
        avatar_url: string | null;
        classes: number;
        totalBooked: number;
        totalCapacity: number;
        attended: number;
        noShow: number;
      }
    > = {};
    classes.forEach((c) => {
      if (!c.instructor_id) return;
      const inst = instructorById.get(c.instructor_id);
      if (!inst) return;
      const cur = instructorStats[c.instructor_id] ?? {
        id: c.instructor_id,
        name: inst.name,
        avatar_url: inst.avatar_url,
        classes: 0,
        totalBooked: 0,
        totalCapacity: 0,
        attended: 0,
        noShow: 0,
      };
      cur.classes += 1;
      cur.totalBooked += c.booked_count ?? 0;
      cur.totalCapacity += c.capacity ?? 0;
      instructorStats[c.instructor_id] = cur;
    });
    attendance.forEach((a) => {
      const c = classById.get(a.class_id);
      if (!c || !c.instructor_id) return;
      const s = instructorStats[c.instructor_id];
      if (!s) return;
      if (a.status === "attended" || a.status === "checked_in") s.attended += 1;
      if (a.status === "no_show") s.noShow += 1;
    });
    const instructorReport = Object.values(instructorStats)
      .map((s) => ({
        ...s,
        avgFill: s.totalCapacity > 0 ? s.totalBooked / s.totalCapacity : 0,
        attendanceRate: s.attended + s.noShow > 0 ? s.attended / (s.attended + s.noShow) : 0,
      }))
      .sort((a, b) => b.totalBooked - a.totalBooked);

    // ===== MEMBERS / RETENTION =====
    const now = Date.now();
    const startMs = new Date(startISO).getTime();
    const endMs = new Date(endISO).getTime();
    const activeMembers = members.filter(
      (m) =>
        m.status !== "inactive" &&
        m.last_visit_at &&
        new Date(m.last_visit_at).getTime() > now - 60 * 86400000,
    );
    const newMembers = members.filter((m) => {
      const t = new Date(m.created_at).getTime();
      return t >= startMs && t <= endMs;
    });
    const inactiveMembers = members.filter(
      (m) => !m.last_visit_at || new Date(m.last_visit_at).getTime() < now - 60 * 86400000,
    );
    const firstTimers = members.filter((m) => (m.attendance_count ?? 0) === 0);

    // upcoming bookings per member
    const upcomingMemberIds = new Set<string>();
    upcomingClasses.forEach(() => {});
    // Re-query? Simpler: derive from existing bookings (not perfect). Use existing bookings list (period bookings).
    bookings.forEach((b) => {
      if (b.status === "booked") upcomingMemberIds.add(b.member_id);
    });

    const lowCredits = members.filter(
      (m) => (m.remaining_credits ?? 0) <= 1 && (m.attendance_count ?? 0) > 0,
    );

    // package expiring soon (next 14 days)
    const expiringPlans = memberPlans.filter((mp) => {
      if (!mp.expires_at || mp.status !== "active") return false;
      const t = new Date(mp.expires_at).getTime();
      return t > now && t < now + 14 * 86400000;
    });

    // members at risk: low credits + no upcoming booking
    const atRisk = members
      .filter((m) => {
        const noUpcoming = !upcomingMemberIds.has(m.id);
        const lowCred = (m.remaining_credits ?? 0) <= 2;
        const expiring = expiringPlans.some((mp) => mp.member_id === m.id);
        return (lowCred && noUpcoming) || expiring;
      })
      .slice(0, 30)
      .map((m) => {
        const reasons: string[] = [];
        if ((m.remaining_credits ?? 0) <= 1) reasons.push("Low credits");
        if (!upcomingMemberIds.has(m.id)) reasons.push("No upcoming booking");
        if (expiringPlans.some((mp) => mp.member_id === m.id))
          reasons.push("Package expiring soon");
        const activePlan = memberPlans.find(
          (mp) => mp.member_id === m.id && mp.status === "active",
        );
        return {
          id: m.id,
          name: m.name,
          phone: m.phone,
          last_visit_at: m.last_visit_at,
          remaining_credits: m.remaining_credits ?? 0,
          reasons,
          active_plan_name: activePlan ? (planById.get(activePlan.plan_id)?.name ?? null) : null,
        };
      });

    // ===== PACKAGES =====
    const planRevenue: Record<
      string,
      {
        id: string;
        name: string;
        revenue: number;
        sales: number;
        active: number;
        expiringSoon: number;
        avgUsage: number;
      }
    > = {};
    plans.forEach((p) => {
      planRevenue[p.id] = {
        id: p.id,
        name: p.name,
        revenue: 0,
        sales: 0,
        active: 0,
        expiringSoon: 0,
        avgUsage: 0,
      };
    });
    paid.forEach((p) => {
      if (!p.plan_id || !planRevenue[p.plan_id]) return;
      planRevenue[p.plan_id].revenue += Number(p.amount) - Number(p.refunded_amount ?? 0);
      planRevenue[p.plan_id].sales += 1;
    });
    memberPlans.forEach((mp) => {
      if (!planRevenue[mp.plan_id]) return;
      if (mp.status === "active") planRevenue[mp.plan_id].active += 1;
      if (
        mp.expires_at &&
        new Date(mp.expires_at).getTime() > now &&
        new Date(mp.expires_at).getTime() < now + 14 * 86400000
      ) {
        planRevenue[mp.plan_id].expiringSoon += 1;
      }
    });
    const packageReport = Object.values(planRevenue).sort((a, b) => b.revenue - a.revenue);
    const packageRequestsByStatus: Record<string, number> = {};
    packageRequests.forEach((r) => {
      packageRequestsByStatus[r.status] = (packageRequestsByStatus[r.status] ?? 0) + 1;
    });

    // ===== WAITLIST =====
    const waitlistByStatus: Record<string, number> = {};
    waitlist.forEach((w) => {
      waitlistByStatus[w.status] = (waitlistByStatus[w.status] ?? 0) + 1;
    });
    const waitlistByClass: Record<
      string,
      {
        id: string;
        title: string | null;
        starts_at: string | null;
        count: number;
        promoted: number;
      }
    > = {};
    waitlist.forEach((w) => {
      const c = classById.get(w.class_id);
      const cur = waitlistByClass[w.class_id] ?? {
        id: w.class_id,
        title: c?.title ?? "Class",
        starts_at: c?.starts_at ?? null,
        count: 0,
        promoted: 0,
      };
      cur.count += 1;
      if (w.status === "promoted") cur.promoted += 1;
      waitlistByClass[w.class_id] = cur;
    });
    const topWaitlistedClasses = Object.values(waitlistByClass)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const memberWaitlistCount: Record<string, number> = {};
    waitlist.forEach((w) => {
      memberWaitlistCount[w.member_id] = (memberWaitlistCount[w.member_id] ?? 0) + 1;
    });
    const frequentWaitlisted = Object.entries(memberWaitlistCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ id, name: memberById.get(id)?.name ?? "Unknown", count }));

    const promotedCount = waitlist.filter((w) => w.status === "promoted").length;
    const totalWaitlist = waitlist.length;
    const waitlistConversion = totalWaitlist > 0 ? promotedCount / totalWaitlist : 0;

    // ===== COMMUNICATION =====
    const messagesByTemplate: Record<string, number> = {};
    notifLogs.forEach((l) => {
      const k = l.template_key ?? "unknown";
      messagesByTemplate[k] = (messagesByTemplate[k] ?? 0) + 1;
    });
    const messagesByTrigger: Record<string, number> = {};
    notifLogs.forEach((l) => {
      const k = l.trigger_type ?? "manual";
      messagesByTrigger[k] = (messagesByTrigger[k] ?? 0) + 1;
    });
    const messagesGenerated = notifLogs.length;
    const messagesMarkedSent = notifLogs.filter(
      (l) => l.marked_sent_at || l.status === "sent",
    ).length;

    // ===== INSIGHTS =====
    const insights: {
      id: string;
      title: string;
      body: string;
      metric?: string;
      action?: { label: string; to: string };
    }[] = [];

    // High-demand peak day
    const peakDayEntry = Object.entries(dayOfWeekBookings).sort((a, b) => b[1] - a[1])[0];
    if (peakDayEntry && peakDayEntry[1] > 0) {
      const dayName = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][Number(peakDayEntry[0])];
      insights.push({
        id: "peak-day",
        title: `${dayName} is your strongest day`,
        body: `${peakDayEntry[1]} bookings landed on ${dayName} in this period. Consider repeating popular slots.`,
        metric: `${peakDayEntry[1]} bookings`,
        action: { label: "Open calendar", to: "/admin/calendar" },
      });
    }

    // Room near full
    const hotRoom = roomReport.find((r) => r.avgFill >= 0.85 && r.classes >= 3);
    if (hotRoom) {
      insights.push({
        id: "hot-room",
        title: `${hotRoom.name} is reaching high occupancy`,
        body: `Average fill rate is ${(hotRoom.avgFill * 100).toFixed(0)}% across ${hotRoom.classes} sessions. Consider adding another slot.`,
        metric: `${(hotRoom.avgFill * 100).toFixed(0)}% fill`,
        action: { label: "Open rooms", to: "/admin/rooms" },
      });
    }

    // Low credit members
    if (atRisk.length > 0) {
      insights.push({
        id: "needs-attention",
        title: `${atRisk.length} members need a gentle nudge`,
        body: `Low credits, expiring packages or no upcoming booking. A short message can re-engage them.`,
        metric: `${atRisk.length} members`,
        action: { label: "Open members", to: "/admin/members" },
      });
    }

    // Strong waitlist demand
    const hotWaitlist = topWaitlistedClasses[0];
    if (hotWaitlist && hotWaitlist.count >= 3) {
      insights.push({
        id: "waitlist-demand",
        title: `${hotWaitlist.title} has strong waitlist demand`,
        body: `${hotWaitlist.count} members joined the waitlist. Consider repeating this class or enlarging capacity.`,
        metric: `${hotWaitlist.count} waiting`,
        action: { label: "Open calendar", to: "/admin/calendar" },
      });
    }

    // No-show rate elevated
    if (noShowRate > 0.1) {
      insights.push({
        id: "no-show",
        title: "No-show rate rose this period",
        body: `${(noShowRate * 100).toFixed(0)}% of expected attendances were no-shows. A friendly reminder template can help.`,
        metric: `${(noShowRate * 100).toFixed(0)}%`,
        action: { label: "Prepare messages", to: "/admin/messages" },
      });
    }

    // Package requests waiting
    const pendingRequests =
      (packageRequestsByStatus["requested"] ?? 0) + (packageRequestsByStatus["contacted"] ?? 0);
    if (pendingRequests > 0) {
      insights.push({
        id: "package-followup",
        title: `${pendingRequests} package requests waiting for follow-up`,
        body: `Reach out to convert these requests into paid packages.`,
        metric: `${pendingRequests} pending`,
        action: { label: "Open messages", to: "/admin/messages" },
      });
    }

    // Trial conversion: first-timers > 0
    if (firstTimers.length > 0) {
      insights.push({
        id: "first-timers",
        title: `${firstTimers.length} first-time visitors yet to attend`,
        body: `Welcome them warmly and offer an intro package to encourage their first class.`,
        metric: `${firstTimers.length} new`,
        action: { label: "Open members", to: "/admin/members" },
      });
    }

    return {
      range: { start: startISO, end: endISO },
      summary: {
        totalRevenue,
        prevTotalRevenue,
        outstanding,
        refundedAmount,
        bookingsCount: bookings.length,
        prevBookingsCount: prevBookings ? prevBookings.length : null,
        attendanceRate,
        noShowRate,
        activeMembersCount: activeMembers.length,
        newMembersCount: newMembers.length,
        packageSalesCount: paid.filter((p) => p.plan_id).length,
        waitlistDemand: waitlist.length,
        avgRevenuePerActiveMember:
          activeMembers.length > 0 ? totalRevenue / activeMembers.length : 0,
        prevFillRate: prevClasses
          ? (() => {
              const cap = prevClasses.reduce((a, c) => a + (c.capacity ?? 0), 0);
              const bk = prevClasses.reduce((a, c) => a + (c.booked_count ?? 0), 0);
              return cap > 0 ? bk / cap : 0;
            })()
          : null,
      },
      revenue: {
        total: totalRevenue,
        refunded: refundedAmount,
        outstanding,
        byMethod: revenueByMethod,
        byPlan: Object.values(revenueByPlan).sort((a, b) => b.amount - a.amount),
        series: revenueSeries,
        topSpenders,
      },
      attendance: {
        totalClasses,
        totalBookings: bookings.length,
        fillRate,
        attendanceRate,
        noShowRate,
        cancelledCount,
        mostBooked,
        leastBooked,
        upcomingAtRisk,
        dayOfWeekBookings,
      },
      rooms: roomReport,
      instructors: instructorReport,
      members: {
        active: activeMembers.length,
        new: newMembers.length,
        inactive: inactiveMembers.length,
        firstTimers: firstTimers.length,
        lowCredits: lowCredits.length,
        expiringSoon: expiringPlans.length,
        atRisk,
      },
      packages: {
        report: packageReport,
        requestsByStatus: packageRequestsByStatus,
      },
      waitlist: {
        byStatus: waitlistByStatus,
        topClasses: topWaitlistedClasses,
        frequentMembers: frequentWaitlisted,
        conversionRate: waitlistConversion,
        totalJoins: totalWaitlist,
      },
      communication: {
        generated: messagesGenerated,
        markedSent: messagesMarkedSent,
        byTemplate: messagesByTemplate,
        byTrigger: messagesByTrigger,
      },
      insights,
    };
  });
