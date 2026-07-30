import { describe, expect, test } from "bun:test";
import {
  isSupersededPendingPaymentReminder,
  LEGACY_PAYMENT_AUTOMATION_STATUSES,
  selectDuePendingPaymentReminders,
} from "../../src/lib/paymentReminderCandidates.ts";

describe("pending payment reminder candidates", () => {
  test("keeps pending reminders owned by unified messaging only", () => {
    expect(LEGACY_PAYMENT_AUTOMATION_STATUSES).toEqual(["failed", "paid"]);
    expect(LEGACY_PAYMENT_AUTOMATION_STATUSES).not.toContain("pending");
  });

  test("sends one reminder for only the latest checkout attempt per member", () => {
    const candidates = selectDuePendingPaymentReminders(
      [
        {
          id: "payment-2",
          member_id: "member-1",
          created_at: "2026-07-29T09:16:49.000Z",
        },
        {
          id: "payment-1",
          member_id: "member-1",
          created_at: "2026-07-29T09:14:30.000Z",
        },
        {
          id: "payment-3",
          member_id: "member-1",
          created_at: "2026-07-29T09:17:43.000Z",
        },
      ],
      {
        dueBefore: new Date("2026-07-29T12:00:00.000Z"),
        limit: 50,
      },
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(["payment-3"]);
  });

  test("does not revive an older attempt while the latest checkout is still fresh", () => {
    const candidates = selectDuePendingPaymentReminders(
      [
        {
          id: "old-payment",
          member_id: "member-1",
          created_at: "2026-07-28T09:00:00.000Z",
        },
        {
          id: "fresh-payment",
          member_id: "member-1",
          created_at: "2026-07-30T11:30:00.000Z",
        },
      ],
      {
        dueBefore: new Date("2026-07-30T11:00:00.000Z"),
        limit: 50,
      },
    );

    expect(candidates).toEqual([]);
  });

  test("keeps one due reminder per member and respects the batch limit", () => {
    const candidates = selectDuePendingPaymentReminders(
      [
        {
          id: "member-2-latest",
          member_id: "member-2",
          created_at: "2026-07-28T11:00:00.000Z",
        },
        {
          id: "member-1-latest",
          member_id: "member-1",
          created_at: "2026-07-28T10:00:00.000Z",
        },
      ],
      {
        dueBefore: new Date("2026-07-29T12:00:00.000Z"),
        limit: 1,
      },
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(["member-1-latest"]);
  });

  test("cancels a prepared reminder when a newer pending checkout now exists", () => {
    expect(isSupersededPendingPaymentReminder("old-payment", "latest-payment")).toBe(true);
    expect(isSupersededPendingPaymentReminder("latest-payment", "latest-payment")).toBe(false);
    expect(isSupersededPendingPaymentReminder("old-payment", null)).toBe(false);
  });
});
