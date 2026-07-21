export const OPEN_CLASS_ALERT_MIN_LEAD_HOURS = 2;
export const OPEN_CLASS_ALERT_MAX_LEAD_HOURS = 24;
export const OPEN_CLASS_ALERT_MAX_FILL_RATIO = 0.7;
export const OPEN_CLASS_ALERT_DAILY_LIMIT = 1;
export const OPEN_CLASS_ALERT_WEEKLY_LIMIT = 2;

export type OpenClassAlertClass = {
  id: string;
  startsAt: string;
  status: string;
  memberVisible: boolean;
  capacity: number;
  bookedCount: number;
};

export type OpenClassAlertMember = {
  id: string;
  status: string;
  remainingCredits: number;
  scheduleUpdates: boolean;
  hasActivePushToken: boolean;
  bookedClassIds: ReadonlySet<string>;
  waitlistedClassIds: ReadonlySet<string>;
  alertedClassIds: ReadonlySet<string>;
  alertsLast24Hours: number;
  alertsLast7Days: number;
};

export type OpenClassAlertPlan = {
  classId: string;
  memberId: string;
  startsAt: string;
  spotsAvailable: number;
  deduplicationKey: string;
};

export function shouldCancelOpenClassAlert(input: {
  classStatus: string | null | undefined;
  capacity: number | null | undefined;
  bookedCount: number | null | undefined;
  memberBooked: boolean;
  memberWaitlisted: boolean;
  memberStatus: string | null | undefined;
  remainingCredits: number | null | undefined;
  scheduleUpdates: boolean;
  hasActivePushToken: boolean;
}) {
  return (
    input.classStatus !== "scheduled" ||
    Number(input.bookedCount ?? 0) >= Number(input.capacity ?? 0) ||
    input.memberBooked ||
    input.memberWaitlisted ||
    input.memberStatus !== "active" ||
    Number(input.remainingCredits ?? 0) <= 0 ||
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
    member.remainingCredits > 0 &&
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
  const members = input.members
    .filter(eligibleMember)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  const plans: OpenClassAlertPlan[] = [];

  for (const member of members) {
    const studioClass = classes.find(
      (candidate) =>
        !member.bookedClassIds.has(candidate.id) &&
        !member.waitlistedClassIds.has(candidate.id) &&
        !member.alertedClassIds.has(candidate.id),
    );
    if (!studioClass) continue;
    plans.push({
      classId: studioClass.id,
      memberId: member.id,
      startsAt: studioClass.startsAt,
      spotsAvailable: Math.max(0, studioClass.capacity - studioClass.bookedCount),
      deduplicationKey: `class:${studioClass.id}:class_open_spots:member:${member.id}`,
    });
    if (plans.length >= limit) break;
  }

  return plans;
}
