import { strict as assert } from "node:assert";
import {
  computeRetrySchedule,
  getIsraelNowParts,
  getNextAllowedSendTime,
  isWithinQuietHours,
  shouldSkipNotification,
} from "../../src/lib/notificationDelivery.ts";

const beforeWindowSummer = new Date("2026-07-01T03:30:00.000Z");
assert.deepEqual(getIsraelNowParts(beforeWindowSummer), {
  date: "2026-07-01",
  hour: 6,
  minute: 30,
});
assert.equal(isWithinQuietHours(beforeWindowSummer), true);

assert.deepEqual(
  getIsraelNowParts(
    getNextAllowedSendTime({
      now: beforeWindowSummer,
      timezone: "Asia/Jerusalem",
      startHour: 8,
      startMinute: 0,
      endHour: 20,
      endMinute: 30,
    }),
  ),
  {
    date: "2026-07-01",
    hour: 8,
    minute: 0,
  },
);

const duringWindow = new Date("2026-07-01T09:15:00.000Z");
assert.equal(isWithinQuietHours(duringWindow), false);
assert.equal(
  getNextAllowedSendTime({
    now: duringWindow,
    timezone: "Asia/Jerusalem",
    startHour: 8,
    startMinute: 0,
    endHour: 20,
    endMinute: 30,
  }).toISOString(),
  duringWindow.toISOString(),
);

const closingBoundary = new Date("2026-07-01T17:30:00.000Z");
assert.equal(isWithinQuietHours(closingBoundary), false);

const afterWindow = new Date("2026-07-01T18:00:00.000Z");
assert.equal(isWithinQuietHours(afterWindow), true);
assert.deepEqual(
  getIsraelNowParts(
    getNextAllowedSendTime({
      now: afterWindow,
      timezone: "Asia/Jerusalem",
      startHour: 8,
      startMinute: 0,
      endHour: 20,
      endMinute: 30,
    }),
  ),
  {
    date: "2026-07-02",
    hour: 8,
    minute: 0,
  },
);

const beforeWindowWinter = new Date("2026-12-01T04:30:00.000Z");
assert.deepEqual(
  getIsraelNowParts(
    getNextAllowedSendTime({
      now: beforeWindowWinter,
      timezone: "Asia/Jerusalem",
      startHour: 8,
      startMinute: 0,
      endHour: 20,
      endMinute: 30,
    }),
  ),
  {
    date: "2026-12-01",
    hour: 8,
    minute: 0,
  },
);

const failedAt = new Date("2026-07-01T10:00:00.000Z");
assert.equal(
  computeRetrySchedule({ attemptCount: 1, failedAt })?.toISOString(),
  "2026-07-01T10:05:00.000Z",
);
assert.equal(
  computeRetrySchedule({ attemptCount: 2, failedAt })?.toISOString(),
  "2026-07-01T10:15:00.000Z",
);
assert.equal(
  computeRetrySchedule({ attemptCount: 3, failedAt })?.toISOString(),
  "2026-07-01T10:30:00.000Z",
);
assert.equal(computeRetrySchedule({ attemptCount: 4, failedAt }), null);

assert.equal(
  shouldSkipNotification({
    eventType: "class_reminder_2h",
    scheduledFor: new Date("2026-07-01T15:00:00.000Z"),
    classStartsAt: new Date("2026-07-01T14:30:00.000Z"),
  }),
  true,
);
assert.equal(
  shouldSkipNotification({
    eventType: "waitlist_spot_available",
    scheduledFor: new Date("2026-07-01T12:01:00.000Z"),
    waitlistExpiresAt: new Date("2026-07-01T12:00:00.000Z"),
  }),
  true,
);
assert.equal(
  shouldSkipNotification({
    eventType: "class_cancelled_by_admin",
    scheduledFor: new Date("2026-07-01T12:01:00.000Z"),
    classStartsAt: new Date("2026-07-01T12:00:00.000Z"),
  }),
  false,
);

console.log("notification delivery helpers OK");
