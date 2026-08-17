import { describe, expect, test } from "bun:test";
import {
  planOpenClassAlerts,
  rankClassRecommendations,
  scoreOpenClassAffinity,
  shouldCancelOpenClassAlert,
} from "../../src/lib/openClassAlerts.ts";

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
    zeroCreditUpsellConsent: false,
    hasActivePushToken: true,
    bookedClassIds: new Set(),
    waitlistedClassIds: new Set(),
    alertedClassIds: new Set(),
    alertsLast24Hours: 0,
    alertsLast7Days: 0,
    classMatchScores: new Map(),
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
    zeroCreditUpsellConsent: false,
    hasActivePushToken: true,
    ...overrides,
  };
}

describe("open-class alert planning", () => {
  test("scores instructor, weekday and time-of-day attendance affinity", () => {
    const candidate = {
      startsAt: "2026-07-22T15:00:00.000Z",
      instructorId: "instructor-a",
    };
    const strong = scoreOpenClassAffinity(candidate, [
      { startsAt: "2026-07-15T15:30:00.000Z", instructorId: "instructor-a" },
      { startsAt: "2026-07-08T15:00:00.000Z", instructorId: "instructor-a" },
    ]);
    const weak = scoreOpenClassAffinity(candidate, [
      { startsAt: "2026-07-13T05:00:00.000Z", instructorId: "instructor-b" },
    ]);
    expect(strong).toBeGreaterThan(weak);
  });

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

  test("allows zero-credit members only with the additional package or marketing consent", () => {
    expect(
      planOpenClassAlerts({
        now,
        classes: [studioClass()],
        members: [member({ remainingCredits: 0, zeroCreditUpsellConsent: true })],
        limit: 50,
      }),
    ).toHaveLength(1);
    expect(
      planOpenClassAlerts({
        now,
        classes: [studioClass()],
        members: [member({ remainingCredits: 0, zeroCreditUpsellConsent: false })],
        limit: 50,
      }),
    ).toEqual([]);
  });

  test("excludes booked, waitlisted, duplicate, and frequency-capped members", () => {
    const members = [
      member({ id: "booked", bookedClassIds: new Set(["class-1"]) }),
      member({ id: "waitlisted", waitlistedClassIds: new Set(["class-1"]) }),
      member({ id: "duplicate", alertedClassIds: new Set(["class-1"]) }),
      member({ id: "daily-cap", alertsLast24Hours: 1 }),
      member({ id: "weekly-cap", alertsLast7Days: 3 }),
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
    expect(shouldCancelOpenClassAlert(deliveryState({ bookedCount: 8 }))).toBe(false);
    expect(shouldCancelOpenClassAlert(deliveryState({ bookedCount: 17, capacity: 20 }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ bookedCount: 10 }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ classStatus: "cancelled" }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ memberBooked: true }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ memberWaitlisted: true }))).toBe(true);
  });

  test("offers each class to at most ten best-matching members", () => {
    const members = Array.from({ length: 14 }, (_, index) =>
      member({
        id: `member-${String(index).padStart(2, "0")}`,
        classMatchScores: new Map([["class-1", index]]),
      }),
    );
    const plans = planOpenClassAlerts({ now, classes: [studioClass()], members, limit: 50 });
    expect(plans).toHaveLength(10);
    expect(plans.map((plan) => plan.memberId)).toEqual([
      "member-13",
      "member-12",
      "member-11",
      "member-10",
      "member-09",
      "member-08",
      "member-07",
      "member-06",
      "member-05",
      "member-04",
    ]);
  });

  test("subtracts previously prepared recipients from the durable per-class cap", () => {
    const members = Array.from({ length: 14 }, (_, index) =>
      member({ id: `member-${String(index).padStart(2, "0")}` }),
    );
    const plans = planOpenClassAlerts({
      now,
      classes: [studioClass({ priorAlertCount: 7 })],
      members,
      limit: 50,
    });
    expect(plans).toHaveLength(3);
  });

  test("ranks and returns at most two recommendations by attendance affinity", () => {
    const attendance = [{ startsAt: "2026-07-15T15:00:00.000Z", instructorId: "preferred" }];
    const ranked = rankClassRecommendations(
      [
        { id: "early-weak", startsAt: "2026-07-22T06:00:00.000Z", instructorId: "other" },
        { id: "best", startsAt: "2026-07-22T15:00:00.000Z", instructorId: "preferred" },
        { id: "second", startsAt: "2026-07-22T14:30:00.000Z", instructorId: "other" },
      ],
      attendance,
    );
    expect(ranked.map((candidate) => candidate.id)).toEqual(["best", "second"]);
  });

  test("ignores invalid recommendation dates instead of aborting the sweep", () => {
    const ranked = rankClassRecommendations(
      [
        { id: "invalid", startsAt: "", instructorId: "preferred" },
        { id: "valid", startsAt: "2026-07-22T15:00:00.000Z", instructorId: "preferred" },
      ],
      [
        { startsAt: "not-a-date", instructorId: "preferred" },
        { startsAt: "2026-07-15T15:00:00.000Z", instructorId: "preferred" },
      ],
    );

    expect(ranked.map((candidate) => candidate.id)).toEqual(["valid"]);
  });

  test("rechecks member, consent, and device eligibility before a delayed delivery", () => {
    expect(shouldCancelOpenClassAlert(deliveryState({ memberStatus: "inactive" }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ remainingCredits: 0 }))).toBe(true);
    expect(
      shouldCancelOpenClassAlert(
        deliveryState({ remainingCredits: 0, zeroCreditUpsellConsent: true }),
      ),
    ).toBe(false);
    expect(shouldCancelOpenClassAlert(deliveryState({ scheduleUpdates: false }))).toBe(true);
    expect(shouldCancelOpenClassAlert(deliveryState({ hasActivePushToken: false }))).toBe(true);
  });
});
