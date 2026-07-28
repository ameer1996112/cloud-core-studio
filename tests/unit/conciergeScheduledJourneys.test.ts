import { describe, expect, test } from "bun:test";
import {
  dailyBriefingEligible,
  jerusalemDayKey,
  jerusalemWeekKey,
  nextDayKey,
} from "@/lib/conciergeScheduledJourneys";

describe("scheduled Concierge journeys", () => {
  test("uses studio-local day and week keys across UTC boundaries", () => {
    const lateSundayUtc = new Date("2026-08-02T21:30:00.000Z");

    expect(jerusalemDayKey(lateSundayUtc)).toBe("2026-08-03");
    expect(jerusalemWeekKey(lateSundayUtc)).toBe("2026-W32");
    expect(nextDayKey("2026-10-24")).toBe("2026-10-25");
  });

  test("creates a daily briefing only when it aggregates more than one relevant item", () => {
    expect(dailyBriefingEligible({ bookingCount: 1, waitlistCount: 0 })).toBe(false);
    expect(dailyBriefingEligible({ bookingCount: 2, waitlistCount: 0 })).toBe(true);
    expect(dailyBriefingEligible({ bookingCount: 1, waitlistCount: 1 })).toBe(true);
  });
});
