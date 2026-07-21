import { describe, expect, test } from "bun:test";
import { planOpenClassAlerts, shouldCancelOpenClassAlert } from "../../src/lib/openClassAlerts.ts";

const now = new Date("2026-07-21T08:00:00.000Z");

function studioClass(overrides = {}) {
  return {
    id: "class-1",
    startsAt: "2026-07-22T04:00:00.000Z",
    status: "scheduled",
    memberVisible: true,
    capacity: 10,
    bookedCount: 6,
    ...overrides,
  };
}

function member(overrides = {}) {
  return {
    id: "member-1",
    status: "active",
    remainingCredits: 2,
    scheduleUpdates: true,
    hasActivePushToken: true,
    bookedClassIds: new Set(),
    waitlistedClassIds: new Set(),
    alertedClassIds: new Set(),
    alertsLast24Hours: 0,
    alertsLast7Days: 0,
    ...overrides,
  };
}

function deliveryState(overrides = {}) {
  return {
    classStatus: "scheduled",
    capacity: 10,
    bookedCount: 5,
    memberBooked: false,
    memberWaitlisted: false,
    memberStatus: "active",
    remainingCredits: 2,
    scheduleUpdates: true,
    hasActivePushToken: true,
    ...overrides,
  };
}

describe("open-class alert planning", () => {
  test("plans one deduplicated alert for an underfilled class starting within 24 hours", () => {
    expect(
      planOpenClassAlerts({ now, classes: [studioClass()], members: [member()], limit: 50 }),
    ).toEqual([
      {
        classId: "class-1",
        memberId: "member-1",
        startsAt: "2026-07-22T04:00:00.000Z",
        spotsAvailable: 4,
        deduplicationKey: "class:class-1:class_open_spots:member:member-1",
      },
    ]);
  });

  test("does not alert for full, sufficiently filled, hidden, cancelled, or out-of-window classes", () => {
    const classes = [
      studioClass({ id: "full", bookedCount: 10 }),
      studioClass({ id: "healthy", bookedCount: 8 }),
      studioClass({ id: "hidden", memberVisible: false }),
      studioClass({ id: "cancelled", status: "cancelled" }),
      studioClass({ id: "too-soon", startsAt: "2026-07-21T09:00:00.000Z" }),
      studioClass({ id: "too-late", startsAt: "2026-07-22T09:00:01.000Z" }),
    ];
    expect(planOpenClassAlerts({ now, classes, members: [member()], limit: 50 })).toEqual([]);
  });

  test("requires an active push member with credits and schedule-opening consent", () => {
    const members = [
      member({ id: "inactive", status: "inactive" }),
      member({ id: "no-credit", remainingCredits: 0 }),
      member({ id: "no-consent", scheduleUpdates: false }),
      member({ id: "no-device", hasActivePushToken: false }),
    ];
    expect(planOpenClassAlerts({ now, classes: [studioClass()], members, limit: 50 })).toEqual([]);
  });

  test("excludes booked, waitlisted, duplicate, and frequency-capped members", () => {
    const members = [
      member({ id: "booked", bookedClassIds: new Set(["class-1"]) }),
      member({ id: "waitlisted", waitlistedClassIds: new Set(["class-1"]) }),
      member({ id: "duplicate", alertedClassIds: new Set(["class-1"]) }),
      member({ id: "daily-cap", alertsLast24Hours: 1 }),
      member({ id: "weekly-cap", alertsLast7Days: 2 }),
    ];
    expect(planOpenClassAlerts({ now, classes: [studioClass()], members, limit: 50 })).toEqual([]);
  });

  test("selects at most one upcoming class per member in a sweep", () => {
    const plans = planOpenClassAlerts({
      now,
      classes: [
        studioClass({ id: "later", startsAt: "2026-07-22T06:00:00.000Z" }),
        studioClass({ id: "sooner", startsAt: "2026-07-22T03:00:00.000Z" }),
      ],
      members: [member()],
      limit: 50,
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].classId).toBe("sooner");
  });

  test("cancels a delayed push if the class closes or the member already joined", () => {
    expect(shouldCancelOpenClassAlert(deliveryState({ bookedCount: 9 }))).toBe(false);
    expect(shouldCancelOpenClassAlert(deliveryState({ bookedCount: 10 }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ classStatus: "cancelled" }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ memberBooked: true }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ memberWaitlisted: true }))).toBe(true);
  });

  test("rechecks member, consent, and device eligibility before a delayed delivery", () => {
    expect(shouldCancelOpenClassAlert(deliveryState({ memberStatus: "inactive" }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ remainingCredits: 0 }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ scheduleUpdates: false }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ hasActivePushToken: false }))).toBe(true);
  });
});
