import { describe, expect, test } from "bun:test";
import {
  chooseNextRecipientAction,
  closeInactivityEpisode,
  decideBookingChannels,
  decidePaymentOutcome,
  filterSuitableClasses,
  isQuietHours,
  resolveCommunicationRecipient,
  weeklyScheduleKey,
} from "../../src/lib/conciergePolicy.ts";

const recipient = {
  id: "adult-1",
  locale: "ar",
  isAdult: true,
  consents: {
    push: new Set(["transactional", "operational", "promotional"]),
    whatsapp: new Set(["transactional", "operational", "promotional"]),
    email: new Set(["transactional", "operational", "receipt"]),
  },
  hasPush: true,
};

describe("recipient resolution", () => {
  test("routes a child participant only to an authorized adult", () => {
    expect(
      resolveCommunicationRecipient({
        participantId: "child-1",
        participantIsMinor: true,
        relationships: [
          {
            participantId: "child-1",
            recipientId: "adult-1",
            relationshipType: "guardian",
            recipientIsAdult: true,
            authorized: true,
          },
        ],
      }),
    ).toBe("adult-1");
  });

  test("refuses a child self-recipient and an unauthorized guardian", () => {
    expect(() =>
      resolveCommunicationRecipient({
        participantId: "child-1",
        participantIsMinor: true,
        relationships: [
          {
            participantId: "child-1",
            recipientId: "child-1",
            relationshipType: "self",
            recipientIsAdult: false,
            authorized: true,
          },
        ],
      }),
    ).toThrow("authorized_adult_recipient_required");
  });
});

describe("channel and time policy", () => {
  test("uses WhatsApp for a consented first booking but push for a repeat booking", () => {
    expect(decideBookingChannels({ firstBooking: true, recipient })).toEqual([
      "in_app",
      "whatsapp",
    ]);
    expect(decideBookingChannels({ firstBooking: false, recipient })).toEqual(["in_app", "push"]);
  });

  test("respects Jerusalem quiet hours including payment failures", () => {
    expect(isQuietHours(new Date("2026-07-26T19:00:00Z"))).toBe(true);
    expect(
      chooseNextRecipientAction({
        now: new Date("2026-07-26T19:00:00Z"),
        recipient,
        recentContacts: [],
        actions: [
          {
            id: "payment-1",
            kind: "payment_requires_action",
            purpose: "transactional",
            priority: 2,
            eligibleAt: new Date("2026-07-26T18:00:00Z"),
          },
        ],
      }),
    ).toMatchObject({ selected: null, suppressionReason: "quiet_hours", postponed: true });
  });

  test("urgent class changes win arbitration and may bypass quiet hours", () => {
    const decision = chooseNextRecipientAction({
      now: new Date("2026-07-26T19:00:00Z"),
      recipient,
      recentContacts: [],
      actions: [
        {
          id: "promo",
          kind: "retention",
          purpose: "promotional",
          priority: 6,
          eligibleAt: new Date("2026-07-26T18:00:00Z"),
        },
        {
          id: "urgent",
          kind: "class_cancelled",
          purpose: "operational",
          priority: 1,
          urgent: true,
          eligibleAt: new Date("2026-07-26T18:00:00Z"),
        },
      ],
    });
    expect(decision.selected?.id).toBe("urgent");
    expect(decision.suppressionReason).toBeNull();
  });

  test("urgent priority never bypasses channel-purpose consent", () => {
    expect(
      chooseNextRecipientAction({
        now: new Date("2026-07-26T19:00:00Z"),
        recipient: {
          ...recipient,
          consents: {
            push: new Set(),
            whatsapp: new Set(),
            email: new Set(),
            in_app: new Set(),
          },
        },
        recentContacts: [],
        actions: [
          {
            id: "urgent",
            kind: "class_cancelled",
            purpose: "operational",
            priority: 1,
            urgent: true,
            eligibleAt: new Date("2026-07-26T18:00:00Z"),
          },
        ],
      }),
    ).toMatchObject({ selected: null, suppressionReason: "missing_consent" });
  });

  test("enforces total-contact and promotional caps across competing events", () => {
    const now = new Date("2026-07-26T12:00:00Z");
    const action = {
      id: "retention",
      kind: "retention",
      purpose: "promotional",
      priority: 6,
      eligibleAt: new Date("2026-07-26T10:00:00Z"),
    };
    expect(
      chooseNextRecipientAction({
        now: new Date("2026-07-26T15:00:00Z"),
        recipient,
        actions: [action],
        recentContacts: [{ sentAt: new Date("2026-07-26T10:00:00Z"), promotional: false }],
      }),
    ).toMatchObject({ selected: null, suppressionReason: "six_hour_contact_cap" });
    expect(
      chooseNextRecipientAction({
        now: new Date("2026-07-26T15:00:00Z"),
        recipient,
        actions: [action],
        recentContacts: [
          { sentAt: new Date("2026-07-26T08:00:00Z"), promotional: true },
          { sentAt: new Date("2026-07-24T08:00:00Z"), promotional: true },
          { sentAt: new Date("2026-07-22T08:00:00Z"), promotional: true },
        ],
      }),
    ).toMatchObject({ selected: null, suppressionReason: "daily_promotional_cap" });
  });
});

describe("payment consolidation", () => {
  test("consolidates renewal success and avoids routine WhatsApp", () => {
    expect(decidePaymentOutcome("subscription_renewal_succeeded")).toEqual({
      memberChannels: ["in_app", "push", "email"],
      adminNotification: "combined_renewal_payment_success",
      cancelPendingFailureActions: true,
    });
    expect(decidePaymentOutcome("payment_retry_scheduled").memberChannels).toEqual([]);
  });
});

describe("schedule, recommendations, and retention", () => {
  test("uses deterministic initial and explicit correction keys", () => {
    expect(weeklyScheduleKey("studio", "2026-W31")).toBe("weekly_schedule:studio:2026-W31:initial");
    expect(weeklyScheduleKey("studio", "2026-W31", 2)).toBe(
      "weekly_schedule:studio:2026-W31:update:2",
    );
    expect(() => weeklyScheduleKey("studio", "2026-W31", 0)).toThrow();
  });

  test("returns only suitable classes and puts member fit before fill", () => {
    const classes = [
      {
        id: "wrong-child",
        published: true,
        bookable: true,
        cancelled: false,
        eligible: false,
        capacityAvailable: true,
        planCovered: true,
        overlaps: false,
        startsAt: new Date("2026-07-28T10:00:00Z"),
        fitScore: 100,
        fillScore: 100,
      },
      {
        id: "fit",
        published: true,
        bookable: true,
        cancelled: false,
        eligible: true,
        capacityAvailable: true,
        planCovered: true,
        overlaps: false,
        startsAt: new Date("2026-07-28T10:00:00Z"),
        fitScore: 8,
        fillScore: 1,
      },
      {
        id: "fill",
        published: true,
        bookable: true,
        cancelled: false,
        eligible: true,
        capacityAvailable: true,
        planCovered: true,
        overlaps: false,
        startsAt: new Date("2026-07-28T11:00:00Z"),
        fitScore: 5,
        fillScore: 10,
      },
    ];
    expect(
      filterSuitableClasses(classes, new Date("2026-07-26T10:00:00Z")).map((item) => item.id),
    ).toEqual(["fit", "fill"]);
  });

  test("activity closes an inactivity episode and cancels pending retention", () => {
    expect(closeInactivityEpisode({ status: "open", whatsappSentAt: null }, "booking")).toEqual({
      status: "closed",
      closedReason: "booking",
      cancelPendingRetention: true,
    });
  });
});
