import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildNotificationDraftRows,
  type NotificationLogInsertRow,
} from "@/lib/notificationDrafts";
import type { NotificationEventKey } from "@/lib/notificationTemplates";

type Member = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  preferred_language?: string | null;
  created_at?: string | null;
  last_visit_at?: string | null;
  remaining_credits?: number | null;
};

type StudioSettings = {
  default_language?: string | null;
  studio_name?: string | null;
  public_phone?: string | null;
  whatsapp_number?: string | null;
  timezone?: string | null;
};

type MemberPlan = {
  id: string;
  created_at: string;
  starts_at: string;
  expires_at: string | null;
  credits_granted: number;
  member_id: string;
  plan: { name: string | null } | null;
};

type AttendedBooking = {
  id: string;
  member_id: string;
  class_id: string;
  member: Member | null;
  class: {
    id: string;
    title: string;
    starts_at: string;
    instructor: { name: string | null } | null;
  } | null;
};

export type LifecycleNotificationSweepResult = {
  dryRun: boolean;
  paused: boolean;
  scanned: Record<string, number>;
  prepared: Record<string, number>;
  inserted: number;
};

type LifecycleSweepInput = {
  now?: Date;
  limitPerEvent?: number;
  dryRun?: boolean;
};

const LIFECYCLE_EVENT_TYPES: NotificationEventKey[] = [
  "registered_no_action",
  "package_approved_no_booking",
  "first_lesson_followup",
  "low_credits",
  "package_expiring_soon",
  "no_upcoming_booking_14d",
];

function eventCounts() {
  return Object.fromEntries(LIFECYCLE_EVENT_TYPES.map((eventType) => [eventType, 0])) as Record<
    string,
    number
  >;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function formatClassDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB");
}

function formatClassTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB");
}

function compactRows(rows: Array<NotificationLogInsertRow | null>) {
  return rows.filter((row): row is NotificationLogInsertRow => row != null);
}

function isDeliverableMember(member: Member | null | undefined) {
  return Boolean(member?.id && member.phone?.trim());
}

function buildRows(input: {
  eventKey: NotificationEventKey;
  member: Member;
  studioSettings: StudioSettings | null;
  relatedIds?: Parameters<typeof buildNotificationDraftRows>[0]["relatedIds"];
  variables?: Parameters<typeof buildNotificationDraftRows>[0]["variables"];
  scheduledFor?: Date;
}) {
  return buildNotificationDraftRows({
    eventKey: input.eventKey,
    channels: ["whatsapp"],
    audience: "member",
    member: {
      id: input.member.id,
      name: input.member.name,
      phone: input.member.phone,
      email: input.member.email,
      preferred_language: input.member.preferred_language,
    },
    appLanguage: null,
    studioSettings: input.studioSettings,
    relatedIds: input.relatedIds ?? {},
    variables: input.variables ?? {},
    delivery: {
      scheduledFor: input.scheduledFor,
    },
  });
}

async function getStudioSettings() {
  const { data, error } = await supabaseAdmin
    .from("studio_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as StudioSettings | null;
}

async function hasAnyBooking(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("member_id", memberId)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function hasAnyPackageRequest(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("package_requests")
    .select("id")
    .eq("member_id", memberId)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function hasActiveMemberPlan(memberId: string, now: Date) {
  const { data, error } = await supabaseAdmin
    .from("member_plans")
    .select("id,expires_at")
    .eq("member_id", memberId)
    .eq("status", "active")
    .limit(20);
  if (error) throw error;
  return (data ?? []).some((row) => !row.expires_at || new Date(row.expires_at) > now);
}

async function hasUpcomingBooking(memberId: string, now: Date) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id,status,class:classes(starts_at,status)")
    .eq("member_id", memberId)
    .in("status", ["booked", "checked_in"])
    .limit(50);
  if (error) throw error;
  return (data ?? []).some((row) => {
    const cls = Array.isArray(row.class) ? row.class[0] : row.class;
    return cls?.starts_at && new Date(cls.starts_at) >= now && cls.status !== "cancelled";
  });
}

async function getMember(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id,name,phone,email,preferred_language,status")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Member | null;
}

async function listRegisteredNoActionCandidates(input: { now: Date; limit: number }) {
  const after = addDays(input.now, -7).toISOString();
  const before = addDays(input.now, -1).toISOString();
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id,name,phone,email,preferred_language,created_at,remaining_credits,status")
    .eq("status", "active")
    .gte("created_at", after)
    .lte("created_at", before)
    .order("created_at", { ascending: true })
    .limit(input.limit);
  if (error) throw error;
  return (data ?? []) as Member[];
}

async function listPackageNoBookingCandidates(input: { now: Date; limit: number }) {
  const after = addDays(input.now, -14).toISOString();
  const before = addDays(input.now, -2).toISOString();
  const { data, error } = await supabaseAdmin
    .from("member_plans")
    .select("id,created_at,starts_at,expires_at,credits_granted,member_id,plan:plans(name)")
    .eq("status", "active")
    .gte("created_at", after)
    .lte("created_at", before)
    .order("created_at", { ascending: true })
    .limit(input.limit);
  if (error) throw error;
  return (data ?? []) as MemberPlan[];
}

async function listFirstLessonCandidates(input: { now: Date; limit: number }) {
  const after = addDays(input.now, -2).toISOString();
  const before = new Date(input.now.getTime() - 2 * 60 * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id,member_id,class_id,member:members(id,name,phone,email,preferred_language,attendance_count,status),class:classes(id,title,starts_at,instructor:instructors(name))",
    )
    .eq("status", "attended")
    .gte("class.starts_at", after)
    .lte("class.starts_at", before)
    .order("created_at", { ascending: true })
    .limit(input.limit);
  if (error) throw error;
  return (data ?? []) as AttendedBooking[];
}

async function listLowCreditCandidates(input: { limit: number }) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id,name,phone,email,preferred_language,remaining_credits,status,last_visit_at")
    .eq("status", "active")
    .gte("remaining_credits", 1)
    .lte("remaining_credits", 2)
    .not("last_visit_at", "is", null)
    .order("last_visit_at", { ascending: false })
    .limit(input.limit);
  if (error) throw error;
  return (data ?? []) as Member[];
}

async function listPackageExpiringCandidates(input: { now: Date; limit: number }) {
  const { data, error } = await supabaseAdmin
    .from("member_plans")
    .select("id,created_at,starts_at,expires_at,credits_granted,member_id,plan:plans(name)")
    .eq("status", "active")
    .gte("expires_at", input.now.toISOString())
    .lte("expires_at", addDays(input.now, 7).toISOString())
    .order("expires_at", { ascending: true })
    .limit(input.limit);
  if (error) throw error;
  return (data ?? []) as MemberPlan[];
}

async function listNoUpcomingCandidates(input: { now: Date; limit: number }) {
  const after = addDays(input.now, -21).toISOString();
  const before = addDays(input.now, -14).toISOString();
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id,name,phone,email,preferred_language,remaining_credits,status,last_visit_at")
    .eq("status", "active")
    .gte("last_visit_at", after)
    .lte("last_visit_at", before)
    .order("last_visit_at", { ascending: true })
    .limit(input.limit);
  if (error) throw error;
  return (data ?? []) as Member[];
}

async function prepareRegisteredNoAction(input: {
  now: Date;
  limit: number;
  settings: StudioSettings | null;
}) {
  const candidates = await listRegisteredNoActionCandidates(input);
  const rows = await Promise.all(
    candidates.map(async (member) => {
      if (!isDeliverableMember(member)) return null;
      if (member.remaining_credits && member.remaining_credits > 0) return null;
      if (await hasAnyBooking(member.id)) return null;
      if (await hasAnyPackageRequest(member.id)) return null;
      if (await hasActiveMemberPlan(member.id, input.now)) return null;
      return buildRows({
        eventKey: "registered_no_action",
        member,
        studioSettings: input.settings,
        relatedIds: { memberId: member.id },
        scheduledFor: input.now,
      })[0];
    }),
  );
  return compactRows(rows);
}

async function preparePackageNoBooking(input: {
  now: Date;
  limit: number;
  settings: StudioSettings | null;
}) {
  const candidates = await listPackageNoBookingCandidates(input);
  const rows = await Promise.all(
    candidates.map(async (plan) => {
      const member = await getMember(plan.member_id);
      if (!isDeliverableMember(member) || member?.status !== "active") return null;
      if (await hasUpcomingBooking(plan.member_id, input.now)) return null;
      return buildRows({
        eventKey: "package_approved_no_booking",
        member,
        studioSettings: input.settings,
        relatedIds: { memberId: plan.member_id, memberPlanId: plan.id },
        variables: { package_name: plan.plan?.name ?? "החבילה שלך" },
        scheduledFor: input.now,
      })[0];
    }),
  );
  return compactRows(rows);
}

async function prepareFirstLessonFollowup(input: {
  now: Date;
  limit: number;
  settings: StudioSettings | null;
}) {
  const candidates = await listFirstLessonCandidates(input);
  const rows = candidates
    .filter((booking) => isDeliverableMember(booking.member) && booking.member?.status === "active")
    .filter((booking) => Number(booking.member?.attendance_count ?? 0) <= 1)
    .map(
      (booking) =>
        buildRows({
          eventKey: "first_lesson_followup",
          member: booking.member as Member,
          studioSettings: input.settings,
          relatedIds: {
            memberId: booking.member_id,
            bookingId: booking.id,
            classId: booking.class_id,
          },
          variables: {
            class_name: booking.class?.title ?? "",
            class_date: formatClassDate(booking.class?.starts_at),
            class_time: formatClassTime(booking.class?.starts_at),
            instructor_name: booking.class?.instructor?.name ?? "",
          },
          scheduledFor: input.now,
        })[0],
    );
  return compactRows(rows);
}

async function prepareLowCredits(input: {
  now: Date;
  limit: number;
  settings: StudioSettings | null;
}) {
  const candidates = await listLowCreditCandidates(input);
  const rows = candidates
    .filter((member) => isDeliverableMember(member))
    .map(
      (member) =>
        buildRows({
          eventKey: "low_credits",
          member,
          studioSettings: input.settings,
          relatedIds: { memberId: member.id },
          variables: { credits_remaining: member.remaining_credits ?? 0 },
          scheduledFor: input.now,
        })[0],
    );
  return compactRows(rows);
}

async function preparePackageExpiring(input: {
  now: Date;
  limit: number;
  settings: StudioSettings | null;
}) {
  const candidates = await listPackageExpiringCandidates(input);
  const rows = await Promise.all(
    candidates.map(async (plan) => {
      const member = await getMember(plan.member_id);
      if (!isDeliverableMember(member) || member?.status !== "active") return null;
      return buildRows({
        eventKey: "package_expiring_soon",
        member,
        studioSettings: input.settings,
        relatedIds: { memberId: plan.member_id, memberPlanId: plan.id },
        variables: {
          package_name: plan.plan?.name ?? "החבילה שלך",
          expires_on: formatDate(plan.expires_at),
        },
        scheduledFor: input.now,
      })[0];
    }),
  );
  return compactRows(rows);
}

async function prepareNoUpcoming(input: {
  now: Date;
  limit: number;
  settings: StudioSettings | null;
}) {
  const candidates = await listNoUpcomingCandidates(input);
  const rows = await Promise.all(
    candidates.map(async (member) => {
      if (!isDeliverableMember(member)) return null;
      if (await hasUpcomingBooking(member.id, input.now)) return null;
      return buildRows({
        eventKey: "no_upcoming_booking_14d",
        member,
        studioSettings: input.settings,
        relatedIds: { memberId: member.id },
        scheduledFor: input.now,
      })[0];
    }),
  );
  return compactRows(rows);
}

async function insertRows(rows: NotificationLogInsertRow[]) {
  if (!rows.length) return 0;
  const keys = Array.from(new Set(rows.map((row) => row.idempotency_key).filter(Boolean)));
  const existingKeys = new Set<string>();

  if (keys.length) {
    const { data, error } = await supabaseAdmin
      .from("notification_logs")
      .select("idempotency_key")
      .in("idempotency_key", keys);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.idempotency_key) existingKeys.add(row.idempotency_key);
    }
  }

  const newRows = rows.filter((row) => !existingKeys.has(row.idempotency_key));
  if (!newRows.length) return 0;

  const { error } = await supabaseAdmin
    .from("notification_logs")
    .upsert(newRows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
  return newRows.length;
}

export async function runLifecycleNotificationSweep(
  input: LifecycleSweepInput = {},
): Promise<LifecycleNotificationSweepResult> {
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(25, Math.trunc(input.limitPerEvent ?? 5)));
  const dryRun = input.dryRun === true;
  const paused = process.env.OPENWA_WORKER_LIFECYCLE_PAUSED === "1";
  const settings = await getStudioSettings();
  const prepared = eventCounts();
  const scanned = eventCounts();

  const groups: Array<{ eventKey: NotificationEventKey; rows: NotificationLogInsertRow[] }> = [
    {
      eventKey: "registered_no_action",
      rows: await prepareRegisteredNoAction({ now, limit, settings }),
    },
    {
      eventKey: "package_approved_no_booking",
      rows: await preparePackageNoBooking({ now, limit, settings }),
    },
    {
      eventKey: "first_lesson_followup",
      rows: await prepareFirstLessonFollowup({ now, limit, settings }),
    },
    {
      eventKey: "low_credits",
      rows: await prepareLowCredits({ now, limit, settings }),
    },
    {
      eventKey: "package_expiring_soon",
      rows: await preparePackageExpiring({ now, limit, settings }),
    },
    {
      eventKey: "no_upcoming_booking_14d",
      rows: await prepareNoUpcoming({ now, limit, settings }),
    },
  ];

  for (const group of groups) {
    scanned[group.eventKey] = group.rows.length;
    prepared[group.eventKey] = group.rows.filter((row) => row.status === "queued").length;
  }

  const rows = groups.flatMap((group) => group.rows);
  const inserted = dryRun || paused ? 0 : await insertRows(rows);

  return {
    dryRun,
    paused,
    scanned,
    prepared,
    inserted,
  };
}
