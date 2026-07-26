import { describe, expect, test } from "bun:test";
import {
  buildConciergeEventVariables,
  paymentEvidenceForRecipient,
} from "../../src/lib/conciergeEngagement.server.ts";
import { buildConciergeRecommendationSummary } from "../../src/lib/conciergeRecommendation.ts";

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

  test("fails closed when an event points at another member's payment", () => {
    const payment = {
      id: "payment-private",
      member_id: "member-b",
      amount: 999,
      currency: "ILS",
      paid_at: "2026-07-26T09:00:00Z",
    };
    const malformedEvent = {
      participant_id: "member-a",
      payload: { payment_id: payment.id },
    };

    expect(
      paymentEvidenceForRecipient({
        event: malformedEvent,
        recipientMemberId: "member-a",
        payments: [payment],
      }),
    ).toBeNull();
    expect(
      paymentEvidenceForRecipient({
        event: malformedEvent,
        recipientMemberId: "member-b",
        payments: [payment],
      }),
    ).toBeNull();
  });

  test("accepts payment facts only when participant, recipient, and payment owner all match", () => {
    const payment = {
      id: "payment-owned",
      member_id: "member-a",
      amount: 350,
      currency: "ILS",
    };
    expect(
      paymentEvidenceForRecipient({
        event: { participant_id: "member-a", payload: { payment_id: payment.id } },
        recipientMemberId: "member-a",
        payments: [payment],
      }),
    ).toEqual(payment);
  });

  test("builds recommendation event evidence from member-facing class titles, never ids", () => {
    expect(
      buildConciergeRecommendationSummary([
        { id: "class-uuid-1", title: "Mat Pilates" },
        { id: "class-uuid-2", title: "Aerial Yoga" },
      ]),
    ).toBe("Mat Pilates · Aerial Yoga");
    expect(buildConciergeRecommendationSummary([{ id: "class-uuid-1", title: "  " }])).toBeNull();
  });
});
