const ISRAEL_TIMEZONE = "Asia/Jerusalem";
const SEND_WINDOW_START_MINUTES = 8 * 60;
const SEND_WINDOW_END_MINUTES = 20 * 60 + 30;
const RETRY_DELAYS_MINUTES = [5, 15, 30] as const;
const AUTOMATED_OPENWA_EVENT_TYPES = new Set([
  "payment_confirmed",
  "booking_confirmed",
  "class_reminder_24h",
  "waitlist_spot_available",
  "class_cancelled_by_admin",
  "class_time_changed",
  "registered_no_action",
  "package_approved_no_booking",
  "first_lesson_followup",
  "low_credits",
  "package_expiring_soon",
  "no_upcoming_booking_14d",
  "payment_pending_reminder",
  "payment_failed",
]);

const AUTOMATED_OFFICIAL_WHATSAPP_EVENT_TYPES = new Set([
  "payment_confirmed",
  "booking_confirmed",
  "class_reminder_24h",
  "waitlist_spot_available",
  "class_cancelled_by_admin",
  "class_time_changed",
]);

const formatterCache = new Map<string, Intl.DateTimeFormat>();

type TimezoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type LocalDateTimeTarget = {
  date: string;
  hour: number;
  minute: number;
  timezone: "Asia/Jerusalem";
};

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  formatterCache.set(timezone, formatter);
  return formatter;
}

function getTimezoneParts(now: Date, timezone: string): TimezoneParts {
  const values = getFormatter(timezone)
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function formatDateParts(parts: Pick<TimezoneParts, "year" | "month" | "day">): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return formatDateParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

function getMinutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function isAllowedSendTime(hour: number, minute: number): boolean {
  const minutes = getMinutesSinceMidnight(hour, minute);
  return minutes >= SEND_WINDOW_START_MINUTES && minutes <= SEND_WINDOW_END_MINUTES;
}

function buildDateInTimezone(target: LocalDateTimeTarget): Date {
  const [year, month, day] = target.date.split("-").map(Number);
  const desiredUtcMs = Date.UTC(year, month - 1, day, target.hour, target.minute, 0, 0);

  let guess = new Date(desiredUtcMs);
  for (let step = 0; step < 4; step += 1) {
    const current = getTimezoneParts(guess, target.timezone);
    const currentUtcMs = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
      0,
    );
    const diff = desiredUtcMs - currentUtcMs;
    if (diff === 0) {
      return new Date(guess.getTime());
    }
    guess = new Date(guess.getTime() + diff);
  }

  return new Date(guess.getTime());
}

export function getIsraelNowParts(now: Date): { date: string; hour: number; minute: number } {
  const parts = getTimezoneParts(now, ISRAEL_TIMEZONE);
  return {
    date: formatDateParts(parts),
    hour: parts.hour,
    minute: parts.minute,
  };
}

export function isWithinQuietHours(now: Date): boolean {
  const parts = getIsraelNowParts(now);
  return !isAllowedSendTime(parts.hour, parts.minute);
}

export function getNextAllowedSendTime(input: {
  now: Date;
  timezone: "Asia/Jerusalem";
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}): Date {
  const parts = getTimezoneParts(input.now, input.timezone);
  const currentMinutes = getMinutesSinceMidnight(parts.hour, parts.minute);
  const startMinutes = getMinutesSinceMidnight(input.startHour, input.startMinute);
  const endMinutes = getMinutesSinceMidnight(input.endHour, input.endMinute);

  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    return new Date(input.now.getTime());
  }

  const targetDate =
    currentMinutes < startMinutes ? formatDateParts(parts) : addDays(formatDateParts(parts), 1);

  return buildDateInTimezone({
    date: targetDate,
    hour: input.startHour,
    minute: input.startMinute,
    timezone: input.timezone,
  });
}

export function computeRetrySchedule(input: {
  attemptCount: number;
  failedAt: Date;
  eventType?: string | null;
}): Date | null {
  const retryDelayMinutes = RETRY_DELAYS_MINUTES[Math.trunc(input.attemptCount) - 1];
  if (retryDelayMinutes == null) return null;

  const delayedRetry = new Date(input.failedAt.getTime() + retryDelayMinutes * 60_000);
  if (input.eventType && shouldBypassQuietHoursForOpenwaNotification(input.eventType)) {
    return delayedRetry;
  }

  return getNextAllowedSendTime({
    now: delayedRetry,
    timezone: "Asia/Jerusalem",
    startHour: 8,
    startMinute: 0,
    endHour: 20,
    endMinute: 30,
  });
}

export function shouldAutoQueueOpenwaNotification(eventType: string): boolean {
  return AUTOMATED_OPENWA_EVENT_TYPES.has(eventType.trim().toLowerCase());
}

export function shouldAutoQueueOfficialWhatsappNotification(eventType: string): boolean {
  return AUTOMATED_OFFICIAL_WHATSAPP_EVENT_TYPES.has(eventType.trim().toLowerCase());
}

export function shouldBypassQuietHoursForOpenwaNotification(eventType: string): boolean {
  return eventType.trim().toLowerCase() === "booking_confirmed";
}

export function resolveNotificationTimingState(input: {
  eventType: string;
  scheduledFor: Date;
  classStartsAt?: Date | null;
  waitlistExpiresAt?: Date | null;
}): "queued" | "skipped" | "cancelled" {
  const eventType = input.eventType.trim().toLowerCase();

  if (
    (eventType === "waitlist_spot_available" ||
      eventType === "waitlist_spot_opened" ||
      eventType === "waitlist_offer") &&
    input.waitlistExpiresAt &&
    input.scheduledFor.getTime() >= input.waitlistExpiresAt.getTime()
  ) {
    return "cancelled";
  }

  if (
    (eventType === "class_reminder_24h" || eventType === "class_reminder_2h") &&
    input.classStartsAt &&
    input.scheduledFor.getTime() >= input.classStartsAt.getTime()
  ) {
    return "skipped";
  }

  return "queued";
}

export function shouldSkipNotification(input: {
  eventType: string;
  scheduledFor: Date;
  classStartsAt?: Date | null;
  waitlistExpiresAt?: Date | null;
}): boolean {
  return resolveNotificationTimingState(input) !== "queued";
}
