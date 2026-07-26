import { describe, expect, test } from "bun:test";
import { buildConciergeEventVariables } from "../../src/lib/conciergeEngagement.server.ts";

describe("Concierge delivery facts", () => {
  test("uses canonical class, payment, waitlist, and recommendation context", () => {
    expect(
      buildConciergeEventVariables({
        memberName: "Noa",
        locale: "en",
        event: {
          payload: {
            offer_expires_at: "2026-07-28T15:30:00Z",
            recommendation_summary: "Mat Pilates or Yoga",
            ignored_private_value: "must-not-leak",
          },
        },
        studioClass: {
          title: "Mat Pilates",
          starts_at: "2026-07-28T15:00:00Z",
        },
        payment: {
          amount: 350,
          currency: "ILS",
          paid_at: "2026-07-26T09:00:00Z",
          created_at: "2026-07-26T08:00:00Z",
        },
      }),
    ).toEqual({
      member_name: "Noa",
      class_name: "Mat Pilates",
      class_date: "28/07/2026",
      class_time: "18:00",
      amount: "₪350.00",
      payment_date: "26/07/2026",
      offer_expires_at: "18:30",
      recommendation_summary: "Mat Pilates or Yoga",
    });
  });

  test("drops invalid optional timestamps instead of inventing facts", () => {
    expect(
      buildConciergeEventVariables({
        memberName: "נועה",
        locale: "he",
        event: { payload: { offer_expires_at: "not-a-date", week_of: "" } },
      }),
    ).toEqual({ member_name: "נועה" });
  });
});
