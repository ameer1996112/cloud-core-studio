import { describe, expect, test } from "bun:test";
import {
  resolvePersonalConciergeExperience,
  resolvePersonalConciergeVisibility,
} from "../../src/lib/personalConciergeExperience.ts";

const firstBooking = {
  id: "booking-1",
  className: "Mat Pilates",
  startsAt: "2026-07-30T15:00:00.000Z",
  instructorName: "Yareen",
  locationName: "Main studio",
};

describe("personal Concierge experience resolver", () => {
  test("defaults off and requires an allowlisted member until explicitly live", () => {
    expect(resolvePersonalConciergeVisibility({}, "member-1")).toBe(false);
    expect(
      resolvePersonalConciergeVisibility(
        {
          PERSONAL_CONCIERGE_MODE: "test_only",
          PERSONAL_CONCIERGE_TEST_MEMBER_IDS: "member-1,member-2",
        },
        "member-1",
      ),
    ).toBe(true);
    expect(
      resolvePersonalConciergeVisibility(
        {
          PERSONAL_CONCIERGE_MODE: "test_only",
          PERSONAL_CONCIERGE_TEST_MEMBER_IDS: "member-2",
        },
        "member-1",
      ),
    ).toBe(false);
    expect(
      resolvePersonalConciergeVisibility({ PERSONAL_CONCIERGE_MODE: "live" }, "member-1"),
    ).toBe(true);
  });

  test("welcomes a first-time member with one preparation moment", () => {
    expect(
      resolvePersonalConciergeExperience({
        member: {
          firstName: "נועה",
          locale: "he",
          attendanceCount: 0,
          personalizationPaused: false,
        },
        nextBooking: firstBooking,
        latestAttendance: null,
        now: "2026-07-27T12:00:00.000Z",
      }),
    ).toEqual({
      state: "first_visit_preparation",
      priority: 4,
      eyebrow: "בינינו",
      title: "מחכה לך בסטודיו",
      note: "נועה, כל מה שכדאי לדעת לפני השיעור הראשון כבר מחכה לך.",
      primaryAction: {
        label: "להכנה לשיעור",
        to: "/member/bookings?concierge=first-visit",
      },
      booking: firstBooking,
      reason: "first_booking_before_first_attendance",
    });
  });

  test("acknowledges verified first attendance without pretending before check-in", () => {
    expect(
      resolvePersonalConciergeExperience({
        member: {
          firstName: "Noa",
          locale: "en",
          attendanceCount: 1,
          personalizationPaused: false,
        },
        nextBooking: null,
        latestAttendance: {
          status: "attended",
          markedAt: "2026-07-27T10:00:00.000Z",
        },
        now: "2026-07-27T12:00:00.000Z",
      }),
    ).toMatchObject({
      state: "first_visit_reflection",
      title: "It was lovely having you",
      reason: "verified_first_attendance",
      primaryAction: {
        label: "Tell me what suits you",
        to: "/member/account#between-us",
      },
    });
  });

  test("does not repeat the first-visit reflection after its care window", () => {
    expect(
      resolvePersonalConciergeExperience({
        member: {
          firstName: "Noa",
          locale: "en",
          attendanceCount: 1,
          personalizationPaused: false,
        },
        nextBooking: null,
        latestAttendance: {
          status: "attended",
          markedAt: "2026-07-20T10:00:00.000Z",
        },
        now: "2026-07-27T12:00:00.000Z",
      }),
    ).toEqual({
      state: "quiet",
      priority: 9,
      reason: "no_meaningful_moment",
    });
  });

  test("offers a gentle path after a verified first no-show", () => {
    expect(
      resolvePersonalConciergeExperience({
        member: {
          firstName: "Noa",
          locale: "en",
          attendanceCount: 0,
          personalizationPaused: false,
        },
        nextBooking: null,
        latestAttendance: {
          status: "no_show",
          markedAt: "2026-07-27T10:00:00.000Z",
        },
        now: "2026-07-27T12:00:00.000Z",
      }),
    ).toMatchObject({
      state: "first_visit_missed",
      title: "Return at your own pace",
      reason: "verified_first_no_show",
      primaryAction: { to: "/member/schedule" },
    });
  });

  test("chooses deliberate quiet for established members without an urgent moment", () => {
    expect(
      resolvePersonalConciergeExperience({
        member: {
          firstName: "Noa",
          locale: "en",
          attendanceCount: 8,
          personalizationPaused: false,
        },
        nextBooking: null,
        latestAttendance: null,
        now: "2026-07-27T12:00:00.000Z",
      }),
    ).toEqual({
      state: "quiet",
      priority: 9,
      reason: "no_meaningful_moment",
    });
  });

  test("does not personalize when the member pauses the relationship memory", () => {
    expect(
      resolvePersonalConciergeExperience({
        member: {
          firstName: "Noa",
          locale: "en",
          attendanceCount: 0,
          personalizationPaused: true,
        },
        nextBooking: firstBooking,
        latestAttendance: null,
        now: "2026-07-27T12:00:00.000Z",
      }),
    ).toEqual({
      state: "next_class",
      priority: 3,
      eyebrow: "Your next class",
      title: "Mat Pilates",
      note: "Thursday 30 July at 18:00",
      primaryAction: {
        label: "View booking",
        to: "/member/bookings",
      },
      booking: firstBooking,
      reason: "personalization_paused",
    });
  });
});
