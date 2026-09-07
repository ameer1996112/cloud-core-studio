import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatStudioDateTimeInput, studioDateTimeInputToIso } from "@/lib/studio-time";

const KIDS_WEEKDAY = 1;
const KIDS_START_TIME = "18:00";
const KIDS_START_TIME_DB = "18:00:00";
const KIDS_CAPACITY = 7;
const KIDS_START_SESSION = 9;
const KIDS_TOTAL_SESSIONS = 35;
const KIDS_GENERATION_WEEKS = KIDS_TOTAL_SESSIONS - KIDS_START_SESSION + 1;

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data?.role !== "admin") throw new Error("forbidden");
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function currentBillingMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function addDaysToLocalDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function localWeekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function nextMondayFrom(date: string) {
  const delta = (KIDS_WEEKDAY - localWeekday(date) + 7) % 7;
  return addDaysToLocalDate(date, delta);
}

function classStudioInput(startsAt: string) {
  return formatStudioDateTimeInput(startsAt);
}

function isMondayKidsClass(startsAt: string) {
  const input = classStudioInput(startsAt);
  const [date, time] = input.split("T");
  return localWeekday(date) === KIDS_WEEKDAY && time === KIDS_START_TIME;
}

function assignmentMatchesClass(assignment: any, cls: any) {
  if (assignment.class_id && assignment.class_id === cls.id) return true;
  const input = classStudioInput(cls.starts_at);
  const [date, time] = input.split("T");
  const assignmentTime = String(assignment.start_time ?? KIDS_START_TIME_DB).slice(0, 5);
  return (
    Number(assignment.weekday ?? KIDS_WEEKDAY) === localWeekday(date) && assignmentTime === time
  );
}

export const kidsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        billingMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const now = new Date();
    const selectedBillingMonth = data.billingMonth
      ? `${data.billingMonth}-01`
      : currentBillingMonth(now);
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();
    const next60 = new Date(now);
    next60.setDate(next60.getDate() + 60);

    const [
      children,
      packages,
      enrollments,
      payments,
      subscriptions,
      assignments,
      classes,
      attendance,
    ] = await Promise.all([
      (context.supabase as any).from("kid_aerial_children").select("*").order("child_name"),
      (context.supabase as any)
        .from("kid_aerial_packages")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
      (context.supabase as any)
        .from("kid_aerial_enrollments")
        .select("*, package:kid_aerial_packages(*)")
        .in("status", ["active", "past_due"])
        .order("created_at", { ascending: false }),
      (context.supabase as any)
        .from("kid_aerial_payments")
        .select(
          "*, child:kid_aerial_children(id,child_name), package:kid_aerial_packages(id,code,name)",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      (context.supabase as any)
        .from("kid_aerial_subscriptions")
        .select("*")
        .in("status", ["active", "past_due", "incomplete"])
        .order("created_at", { ascending: false }),
      (context.supabase as any)
        .from("kid_aerial_class_assignments")
        .select(
          "*, child:kid_aerial_children(id,child_name), class:classes(id,title,starts_at,capacity,room,status,program_type:program_types(slug,name_he,name_en))",
        )
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      (context.supabase as any)
        .from("classes")
        .select(
          "id,title,starts_at,duration_minutes,capacity,booked_count,room,status,member_visible,kid_session_number,program_type:program_types(slug,name_he,name_en)",
        )
        .gte("starts_at", now.toISOString())
        .lte("starts_at", next60.toISOString())
        .eq("status", "scheduled")
        .order("starts_at", { ascending: true }),
      (context.supabase as any)
        .from("kid_aerial_attendance")
        .select("*, child:kid_aerial_children(id,child_name), class:classes(id,title,starts_at)")
        .gte("marked_at", monthStart)
        .lte("marked_at", monthEnd)
        .order("marked_at", { ascending: false }),
    ]);

    for (const res of [
      children,
      packages,
      enrollments,
      payments,
      subscriptions,
      assignments,
      classes,
      attendance,
    ]) {
      if (res.error) throw res.error;
    }

    const kidsClasses = (classes.data ?? []).filter(
      (cls: any) => cls.program_type?.slug === "kids-aerial-yoga",
    );
    const activeAssignments = assignments.data ?? [];
    const classCounts = kidsClasses.reduce((acc: Record<string, number>, cls: any) => {
      acc[cls.id] = activeAssignments.filter((row: any) => assignmentMatchesClass(row, cls)).length;
      return acc;
    }, {});
    const paidThisMonth = (payments.data ?? []).filter(
      (payment: any) =>
        payment.status === "paid" &&
        (payment.billing_month
          ? String(payment.billing_month).slice(0, 7) === selectedBillingMonth.slice(0, 7)
          : payment.paid_at &&
            String(payment.paid_at).slice(0, 7) === selectedBillingMonth.slice(0, 7)),
    );
    const overdue = (enrollments.data ?? []).filter(
      (enrollment: any) => enrollment.status === "past_due",
    );
    const present = (attendance.data ?? []).filter((row: any) => row.status === "present").length;
    const absent = (attendance.data ?? []).filter((row: any) => row.status === "absent").length;
    const excused = (attendance.data ?? []).filter((row: any) => row.status === "excused").length;
    const enrollmentByChild = new Map(
      (enrollments.data ?? []).map((enrollment: any) => [enrollment.child_id, enrollment]),
    );
    const defaultMonthlyPackage = (packages.data ?? []).find((pkg: any) => pkg.code === "monthly");
    const paymentByChild = new Map<string, any>();
    for (const payment of paidThisMonth) {
      if (!paymentByChild.has(payment.child_id)) paymentByChild.set(payment.child_id, payment);
    }
    const activeChildren = (children.data ?? []).filter((child: any) => child.status === "active");
    const paymentLedger = activeChildren.map((child: any) => {
      const enrollment = enrollmentByChild.get(child.id);
      const payment = paymentByChild.get(child.id);
      return {
        child_id: child.id,
        child_name: child.child_name,
        guardian_name: child.guardian_name,
        amount_due: enrollment?.price ?? defaultMonthlyPackage?.price ?? null,
        amount_paid: payment?.amount ?? 0,
        method: payment?.method ?? null,
        payment_id: payment?.id ?? null,
        status: payment ? "paid" : enrollment?.status === "past_due" ? "overdue" : "pending",
      };
    });

    return {
      children: children.data ?? [],
      packages: packages.data ?? [],
      enrollments: enrollments.data ?? [],
      payments: payments.data ?? [],
      subscriptions: subscriptions.data ?? [],
      assignments: activeAssignments,
      classes: kidsClasses.map((cls: any) => ({
        ...cls,
        kids_assigned_count: classCounts[cls.id] ?? 0,
      })),
      weeklyGroup: {
        weekday: KIDS_WEEKDAY,
        startTime: KIDS_START_TIME,
        capacity: KIDS_CAPACITY,
        startSession: KIDS_START_SESSION,
        totalSessions: KIDS_TOTAL_SESSIONS,
      },
      billingMonth: selectedBillingMonth.slice(0, 7),
      paymentLedger,
      attendance: attendance.data ?? [],
      report: {
        activeChildren: activeChildren.length,
        overdueCount: overdue.length,
        paidThisMonthIls: paidThisMonth.reduce(
          (sum: number, payment: any) => sum + Number(payment.amount ?? 0),
          0,
        ),
        paidThisMonthCount: paidThisMonth.length,
        pendingCount: paymentLedger.filter((row: any) => row.status !== "paid").length,
        present,
        absent,
        excused,
      },
    };
  });

export const upsertKidChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        child_name: z.string().trim().min(1),
        guardian_name: z.string().trim().min(1),
        guardian_phone: z.string().trim().nullable().optional(),
        guardian_email: z.string().trim().email().nullable().or(z.literal("")).optional(),
        notes: z.string().trim().nullable().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const payload = {
      ...data,
      guardian_email: data.guardian_email || null,
      guardian_phone: data.guardian_phone || null,
      notes: data.notes || null,
      status: data.status ?? "active",
      created_by: context.userId,
    };
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await (context.supabase as any)
        .from("kid_aerial_children")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
      return { id };
    }
    const { data: row, error } = await (context.supabase as any)
      .from("kid_aerial_children")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const createKidCardPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        childId: z.string().uuid(),
        packageId: z.string().uuid(),
        amount: z.number().positive().nullable().optional(),
        billingMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { createKidsHypPaymentLink } = await import("@/lib/kids.server");
    return createKidsHypPaymentLink({
      childId: data.childId,
      packageId: data.packageId,
      amount: data.amount ?? null,
      billingMonth: data.billingMonth ?? undefined,
      notes: data.notes ?? null,
      actorId: context.userId,
    });
  });

export const recordKidManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        childId: z.string().uuid(),
        packageId: z.string().uuid(),
        method: z.enum(["cash", "bit", "other"]),
        amount: z.number().positive().nullable().optional(),
        billingMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
        reference: z.string().trim().nullable().optional(),
        notes: z.string().trim().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: pkg, error: packageError } = await (context.supabase as any)
      .from("kid_aerial_packages")
      .select("*")
      .eq("id", data.packageId)
      .maybeSingle();
    if (packageError) throw packageError;
    if (!pkg) throw new Error("kid_package_not_found");
    const amount = Number(data.amount ?? pkg.price);
    const { data: payment, error } = await (context.supabase as any)
      .from("kid_aerial_payments")
      .insert({
        child_id: data.childId,
        package_id: data.packageId,
        amount,
        billing_month: data.billingMonth ? `${data.billingMonth}-01` : currentBillingMonth(),
        currency: pkg.currency ?? "ILS",
        method: data.method,
        status: "pending",
        reference: data.reference || null,
        notes: data.notes || null,
        recorded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { activateKidsPaymentPeriod } = await import("@/lib/kids.server");
    return activateKidsPaymentPeriod({ paymentId: payment.id, actorId: context.userId });
  });

export const assignKidToClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        childId: z.string().uuid(),
        classId: z.string().uuid().optional(),
        notes: z.string().trim().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { count, error: countError } = await (context.supabase as any)
      .from("kid_aerial_class_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("weekday", KIDS_WEEKDAY)
      .eq("start_time", KIDS_START_TIME_DB);
    if (countError) throw countError;
    if ((count ?? 0) >= KIDS_CAPACITY) throw new Error("class_full");

    const { error: endError } = await (context.supabase as any)
      .from("kid_aerial_class_assignments")
      .update({ status: "transferred", ends_on: new Date().toISOString().slice(0, 10) })
      .eq("child_id", data.childId)
      .eq("status", "active");
    if (endError) throw endError;

    const { data: row, error } = await (context.supabase as any)
      .from("kid_aerial_class_assignments")
      .insert({
        child_id: data.childId,
        class_id: data.classId ?? null,
        weekday: KIDS_WEEKDAY,
        start_time: KIDS_START_TIME_DB,
        capacity: KIDS_CAPACITY,
        notes: data.notes || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const markKidAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        childId: z.string().uuid(),
        classId: z.string().uuid(),
        status: z.enum(["present", "absent", "excused"]),
        notes: z.string().trim().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: cls, error: classError } = await (context.supabase as any)
      .from("classes")
      .select("id,starts_at,program_type:program_types(slug)")
      .eq("id", data.classId)
      .maybeSingle();
    if (classError) throw classError;
    if (!cls) throw new Error("class_not_found");
    if (cls.program_type?.slug !== "kids-aerial-yoga") throw new Error("not_kids_aerial_class");

    const { data: assignmentRows, error: assignmentError } = await (context.supabase as any)
      .from("kid_aerial_class_assignments")
      .select("id,class_id,weekday,start_time")
      .eq("child_id", data.childId)
      .eq("status", "active");
    if (assignmentError) throw assignmentError;
    const assignment = (assignmentRows ?? []).find((row: any) => assignmentMatchesClass(row, cls));
    if (!assignment) throw new Error("kid_not_assigned_to_weekly_class");

    const { data: previous, error: previousError } = await (context.supabase as any)
      .from("kid_aerial_attendance")
      .select("id,status,credit_delta,enrollment_id")
      .eq("child_id", data.childId)
      .eq("class_id", data.classId)
      .maybeSingle();
    if (previousError) throw previousError;

    const { data: enrollment, error: enrollmentError } = await (context.supabase as any)
      .from("kid_aerial_enrollments")
      .select("id,credits_remaining")
      .eq("child_id", data.childId)
      .in("status", ["active", "past_due"])
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;

    const previousDelta = Number(previous?.credit_delta ?? 0);
    const nextDelta = data.status === "present" ? -1 : 0;
    const creditChange = nextDelta - previousDelta;
    if (creditChange < 0 && !enrollment) throw new Error("no_active_kids_package");
    if (creditChange < 0 && Number(enrollment.credits_remaining ?? 0) < Math.abs(creditChange)) {
      throw new Error("not_enough_kids_credits");
    }

    const payload = {
      child_id: data.childId,
      class_id: data.classId,
      assignment_id: assignment?.id ?? null,
      enrollment_id: enrollment?.id ?? previous?.enrollment_id ?? null,
      status: data.status,
      credit_delta: nextDelta,
      notes: data.notes || null,
      marked_by: context.userId,
      marked_at: new Date().toISOString(),
    };
    const { error } = await (context.supabase as any)
      .from("kid_aerial_attendance")
      .upsert(payload, { onConflict: "child_id,class_id" });
    if (error) throw error;

    if (creditChange !== 0 && enrollment) {
      const { error: creditError } = await (context.supabase as any)
        .from("kid_aerial_enrollments")
        .update({
          credits_remaining: Number(enrollment.credits_remaining ?? 0) + creditChange,
        })
        .eq("id", enrollment.id);
      if (creditError) throw creditError;
    }
    return { ok: true };
  });

export const setupKidsWeeklyClasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const today = formatStudioDateTimeInput(new Date()).slice(0, 10);
    const firstMonday = nextMondayFrom(today);
    const targetDates = Array.from({ length: KIDS_GENERATION_WEEKS }, (_, index) =>
      addDaysToLocalDate(firstMonday, index * 7),
    );
    const firstStartsAt = studioDateTimeInputToIso(`${targetDates[0]}T${KIDS_START_TIME}`);
    const lastStartsAt = studioDateTimeInputToIso(
      `${targetDates[targetDates.length - 1]}T${KIDS_START_TIME}`,
    );

    const [
      { data: program, error: programError },
      { data: instructors, error: instructorError },
      { data: rooms, error: roomError },
    ] = await Promise.all([
      (context.supabase as any)
        .from("program_types")
        .select("id,name_he,default_duration_minutes")
        .eq("slug", "kids-aerial-yoga")
        .maybeSingle(),
      (context.supabase as any).from("instructors").select("id,name").eq("active", true),
      (context.supabase as any)
        .from("rooms")
        .select("id,name")
        .eq("active", true)
        .order("created_at"),
    ]);
    if (programError) throw programError;
    if (instructorError) throw instructorError;
    if (roomError) throw roomError;
    if (!program) throw new Error("kids_program_not_found");

    const instructor =
      (instructors ?? []).find((item: any) =>
        String(item.name ?? "")
          .toLowerCase()
          .includes("yareen"),
      ) ?? (instructors ?? [])[0];
    const room = (rooms ?? [])[0];
    if (!instructor) throw new Error("no_active_instructor");
    if (!room) throw new Error("no_active_room");

    const { data: existing, error: existingError } = await (context.supabase as any)
      .from("classes")
      .select("id,starts_at,kid_session_number")
      .eq("program_type_id", program.id)
      .gte("starts_at", firstStartsAt)
      .lte("starts_at", lastStartsAt);
    if (existingError) throw existingError;

    const existingByInput = new Map(
      (existing ?? []).map((cls: any) => [classStudioInput(cls.starts_at), cls.id]),
    );
    const toInsert = targetDates
      .filter((date) => !existingByInput.has(`${date}T${KIDS_START_TIME}`))
      .map((date, index) => ({
        title: program.name_he ?? "יוגה אווירית לילדים",
        kid_session_number: KIDS_START_SESSION + index,
        starts_at: studioDateTimeInputToIso(`${date}T${KIDS_START_TIME}`),
        duration_minutes: Number(program.default_duration_minutes ?? 60),
        capacity: KIDS_CAPACITY,
        room: room.name,
        room_id: room.id,
        energy: "kids",
        cancellation_window_hours: 0,
        credit_cost: 0,
        instructor_id: instructor.id,
        program_type_id: program.id,
        member_visible: false,
        status: "scheduled",
      }));

    if (toInsert.length) {
      const { error: insertError } = await (context.supabase as any)
        .from("classes")
        .insert(toInsert);
      if (insertError) throw insertError;
    }

    const { data: upcomingKids, error: upcomingError } = await (context.supabase as any)
      .from("classes")
      .select("id,starts_at")
      .eq("program_type_id", program.id)
      .gte("starts_at", new Date().toISOString())
      .lte("starts_at", lastStartsAt)
      .eq("status", "scheduled");
    if (upcomingError) throw upcomingError;

    const targetInputs = new Set(targetDates.map((date) => `${date}T${KIDS_START_TIME}`));
    const wrongClassIds = (upcomingKids ?? [])
      .filter((cls: any) => !targetInputs.has(classStudioInput(cls.starts_at)))
      .map((cls: any) => cls.id);
    if (wrongClassIds.length) {
      const { error: archiveError } = await (context.supabase as any)
        .from("classes")
        .update({ status: "archived", member_visible: false })
        .in("id", wrongClassIds);
      if (archiveError) throw archiveError;
    }

    const normalizedIds = (upcomingKids ?? [])
      .filter((cls: any) => targetInputs.has(classStudioInput(cls.starts_at)))
      .map((cls: any) => cls.id);
    if (normalizedIds.length) {
      const { error: updateError } = await (context.supabase as any)
        .from("classes")
        .update({ capacity: KIDS_CAPACITY, credit_cost: 0, member_visible: false })
        .in("id", normalizedIds);
      if (updateError) throw updateError;
    }

    const { data: numberingClasses, error: numberingError } = await (context.supabase as any)
      .from("classes")
      .select("id,starts_at")
      .eq("program_type_id", program.id)
      .gte("starts_at", firstStartsAt)
      .lte("starts_at", lastStartsAt)
      .eq("status", "scheduled");
    if (numberingError) throw numberingError;

    const classByInput = new Map(
      (numberingClasses ?? []).map((cls: any) => [classStudioInput(cls.starts_at), cls]),
    );
    await Promise.all(
      targetDates.map(async (date, index) => {
        const cls = classByInput.get(`${date}T${KIDS_START_TIME}`);
        if (!cls) return;
        const { error } = await (context.supabase as any)
          .from("classes")
          .update({ kid_session_number: KIDS_START_SESSION + index })
          .eq("id", cls.id);
        if (error) throw error;
      }),
    );

    return {
      created: toInsert.length,
      archived: wrongClassIds.length,
      ensuredWeeks: KIDS_GENERATION_WEEKS,
      firstSession: KIDS_START_SESSION,
      lastSession: KIDS_TOTAL_SESSIONS,
    };
  });

export const cancelKidSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subscriptionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { cancelKidsHypSubscription } = await import("@/lib/kids.server");
    return cancelKidsHypSubscription({
      subscriptionId: data.subscriptionId,
      actorId: context.userId,
    });
  });
