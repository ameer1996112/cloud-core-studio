import { describe, expect, test } from "bun:test";
import { adultInquiryQueue } from "../../src/lib/adultTrialPresentation";

describe("adult inquiry queue", () => {
  test("prioritizes unresolved past attendance over a generic booked state", () => {
    expect(
      adultInquiryQueue(
        {
          reservationState: "booked",
          classStartsAt: "2026-09-01T10:00:00.000Z",
          attendanceStatus: null,
          paymentStatus: "pending",
          continuationOutcome: null,
        },
        new Date("2026-09-03T10:00:00.000Z"),
      ),
    ).toBe("attendance_unresolved");
  });

  test("never treats a requested manual payment as paid", () => {
    expect(
      adultInquiryQueue(
        {
          reservationState: "booked",
          classStartsAt: "2026-09-04T10:00:00.000Z",
          attendanceStatus: null,
          paymentStatus: "pending",
          continuationOutcome: null,
        },
        new Date("2026-09-03T10:00:00.000Z"),
      ),
    ).toBe("payment_pending");
  });

  test("puts an attended trial with no recorded decision into continuation", () => {
    expect(
      adultInquiryQueue(
        {
          reservationState: "booked",
          classStartsAt: "2026-09-01T10:00:00.000Z",
          attendanceStatus: "attended",
          paymentStatus: "paid",
          continuationOutcome: null,
        },
        new Date("2026-09-03T10:00:00.000Z"),
      ),
    ).toBe("continuation_needed");
  });
});
