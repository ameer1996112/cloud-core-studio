export const OPEN_CLASS_ALERT_MIN_LEAD_HOURS = 2;
export const OPEN_CLASS_ALERT_MAX_LEAD_HOURS = 24;
export const OPEN_CLASS_ALERT_MAX_FILL_RATIO = 0.7;
export const OPEN_CLASS_ALERT_STOP_FILL_RATIO = 0.85;
export const OPEN_CLASS_ALERT_MAX_RECIPIENTS_PER_CLASS = 10;
export const OPEN_CLASS_ALERT_DAILY_LIMIT = 1;
export const OPEN_CLASS_ALERT_WEEKLY_LIMIT = 3;

export type OpenClassAlertClass = {
  id: string;
  startsAt: string;
  status: string;
  memberVisible: boolean;
  capacity: number;
  bookedCount: number;
  instructorId?: string | null;
  priorAlertCount?: number;
};

export type ClassRecommendationCandidate = {
  id: string;
  startsAt: string;
  instructorId?: string | null;
};

export type OpenClassAlertMember = {
  id: string;
  status: string;
  remainingCredits: number;
  scheduleUpdates: boolean;
  zeroCreditUpsellConsent: boolean;
  hasActivePushToken: boolean;
  bookedClassIds: ReadonlySet<string>;
  waitlistedClassIds: ReadonlySet<string>;
  alertedClassIds: ReadonlySet<string>;
  alertsLast24Hours: number;
  alertsLast7Days: number;
  classMatchScores?: ReadonlyMap<string, number>;
};

export type OpenClassAlertPlan = {
  classId: string;
  memberId: string;
  startsAt: string;
  spotsAvailable: number;
  deduplicationKey: string;
};

type OpenClassAffinityPoint = {
  startsAt: string;
  instructorId: string | null;
};

function timeValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function israelClassSignature(startsAt: string) {
  const timestamp = timeValue(startsAt);
  if (timestamp === null) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: value("weekday"),
    minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

export function scoreOpenClassAffinity(
  candidate: OpenClassAffinityPoint,
  attendance: readonly OpenClassAffinityPoint[],
) {
  const target = israelClassSignature(candidate.startsAt);
  if (!target) return 0;
  const score = attendance.reduce((total, visit) => {
    const previous = israelClassSignature(visit.startsAt);
    if (!previous) return total;
    const instructor =
      candidate.instructorId && visit.instructorId === candidate.instructorId ? 6 : 0;
    const weekday = previous.weekday === target.weekday ? 3 : 0;
    const timeDistance = Math.abs(previous.minuteOfDay - target.minuteOfDay);
    const time = timeDistance <= 90 ? 2 : timeDistance <= 180 ? 1 : 0;
    return total + instructor + weekday + time;
  }, 0);
  return Math.min(50, score);
}

export function rankClassRecommendations(
  candidates: readonly ClassRecommendationCandidate[],
  attendance: readonly OpenClassAffinityPoint[],
  limit = 2,
) {
  return [...candidates]
    .filter((candidate) => timeValue(candidate.startsAt) !== null)
    .sort(
      (left, right) =>
        scoreOpenClassAffinity(
          { startsAt: right.startsAt, instructorId: right.instructorId ?? null },
          attendance,
        ) -
          scoreOpenClassAffinity(
            { startsAt: left.startsAt, instructorId: left.instructorId ?? null },
            attendance,
          ) ||
        timeValue(left.startsAt)! - timeValue(right.startsAt)! ||
        left.id.localeCompare(right.id),
    )
    .slice(0, Math.max(0, Math.min(2, Math.trunc(limit))));
}

export function shouldCancelOpenClassAlert(input: {
  classStatus: string | null | undefined;
  capacity: number | null | undefined;
  bookedCount: number | null | undefined;
  memberBooked: boolean;
  memberWaitlisted: boolean;
  memberStatus: string | null | undefined;
  remainingCredits: number | null | undefined;
  scheduleUpdates: boolean;
  zeroCreditUpsellConsent: boolean;
  hasActivePushToken: boolean;
}) {
  return (
    input.classStatus !== "scheduled" ||
    Number(input.bookedCount ?? 0) >= Number(input.capacity ?? 0) ||
    (Number(input.capacity ?? 0) > 0 &&
      Number(input.bookedCount ?? 0) / Number(input.capacity) >=
        OPEN_CLASS_ALERT_STOP_FILL_RATIO) ||
    input.memberBooked ||
    input.memberWaitlisted ||
    input.memberStatus !== "active" ||
    (Number(input.remainingCredits ?? 0) <= 0 && !input.zeroCreditUpsellConsent) ||
    !input.scheduleUpdates ||
    !input.hasActivePushToken
  );
}

function eligibleClass(studioClass: OpenClassAlertClass, now: Date) {
  const startsAt = new Date(studioClass.startsAt).getTime();
  const leadHours = (startsAt - now.getTime()) / 3_600_000;
  const capacity = Math.max(0, Number(studioClass.capacity));
  const bookedCount = Math.max(0, Number(studioClass.bookedCount));
  return (
    studioClass.status === "scheduled" &&
    studioClass.memberVisible &&
    capacity > 0 &&
    bookedCount < capacity &&
    bookedCount / capacity <= OPEN_CLASS_ALERT_MAX_FILL_RATIO &&
    leadHours >= OPEN_CLASS_ALERT_MIN_LEAD_HOURS &&
    leadHours <= OPEN_CLASS_ALERT_MAX_LEAD_HOURS
  );
}

function eligibleMember(member: OpenClassAlertMember) {
  return (
    member.status === "active" &&
    (member.remainingCredits > 0 || member.zeroCreditUpsellConsent) &&
    member.scheduleUpdates &&
    member.hasActivePushToken &&
    member.alertsLast24Hours < OPEN_CLASS_ALERT_DAILY_LIMIT &&
    member.alertsLast7Days < OPEN_CLASS_ALERT_WEEKLY_LIMIT
  );
}

export function planOpenClassAlerts(input: {
  now: Date;
  classes: readonly OpenClassAlertClass[];
  members: readonly OpenClassAlertMember[];
  limit: number;
}): OpenClassAlertPlan[] {
  const limit = Math.max(0, Math.trunc(input.limit));
  if (!limit) return [];

  const classes = input.classes
    .filter((studioClass) => eligibleClass(studioClass, input.now))
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() ||
        left.bookedCount / left.capacity - right.bookedCount / right.capacity ||
        left.id.localeCompare(right.id),
    );
  const members = input.members.filter(eligibleMember);
  const plans: OpenClassAlertPlan[] = [];
  const assignedMembers = new Set<string>();

  for (const studioClass of classes) {
    const remainingClassRecipients = Math.max(
      0,
      OPEN_CLASS_ALERT_MAX_RECIPIENTS_PER_CLASS -
        Math.max(0, Math.trunc(studioClass.priorAlertCount ?? 0)),
    );
    if (!remainingClassRecipients) continue;
    const candidates = members
      .filter(
        (member) =>
          !assignedMembers.has(member.id) &&
          !member.bookedClassIds.has(studioClass.id) &&
          !member.waitlistedClassIds.has(studioClass.id) &&
          !member.alertedClassIds.has(studioClass.id),
      )
      .sort(
        (left, right) =>
          Number(right.classMatchScores?.get(studioClass.id) ?? 0) -
            Number(left.classMatchScores?.get(studioClass.id) ?? 0) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, remainingClassRecipients);

    for (const member of candidates) {
      plans.push({
        classId: studioClass.id,
        memberId: member.id,
        startsAt: studioClass.startsAt,
        spotsAvailable: Math.max(0, studioClass.capacity - studioClass.bookedCount),
        deduplicationKey: `class:${studioClass.id}:class_open_spots:member:${member.id}`,
      });
      assignedMembers.add(member.id);
      if (plans.length >= limit) return plans;
    }
  }

  return plans;
}
