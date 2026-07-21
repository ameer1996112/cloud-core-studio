import { describe, expect, test } from "bun:test";
import {
  buildPremiumJourneyPreviews,
  buildPremiumJourneyTestOutbox,
} from "../../src/lib/premiumJourneyLab.ts";
import { applyStaffTestVariables } from "../../src/lib/messagingStaffTest.ts";

describe("premium notification Journey Lab", () => {
  test("renders every event in every supported language without unresolved variables", () => {
    for (const language of ["he", "ar", "en"]) {
      const previews = buildPremiumJourneyPreviews(language);
      expect(previews).toHaveLength(43);
      expect(previews.every((preview) => !/\{\{\d+\}\}/.test(preview.body))).toBe(true);
      expect(previews.every((preview) => preview.subject.trim().length > 0)).toBe(true);
    }
    expect(
      buildPremiumJourneyPreviews("en").find((preview) => preview.eventType === "member_welcome"),
    ).toMatchObject({
      subject: "Welcome to Cloud & Core",
      channels: ["in_app", "push", "email"],
      allowlistOnly: true,
    });
  });

  test("builds an isolated, expiring staff-test outbox event for one supported channel", () => {
    const row = buildPremiumJourneyTestOutbox({
      eventType: "waitlist_spot_available",
      channel: "whatsapp",
      memberId: "00000000-0000-0000-0000-000000000001",
      language: "en",
      runId: "run-1",
      now: new Date("2026-07-21T17:00:00.000Z"),
    });
    expect(row).toMatchObject({
      event_type: "waitlist_spot_available",
      aggregate_type: "notification_staff_test",
      member_id: "00000000-0000-0000-0000-000000000001",
      deduplication_key: "staff-test:run-1:waitlist_spot_available:whatsapp",
      payload: {
        staff_test: true,
        staff_test_force_now: true,
        test_channels: ["whatsapp"],
      },
    });
    expect(new Date(row.expires_at).getTime()).toBe(
      new Date(row.available_at).getTime() + 86400000,
    );
    expect(row.payload.test_variables.offer_expires_at).toBe("18:30");
  });

  test("rejects channels that the selected event does not support", () => {
    expect(() =>
      buildPremiumJourneyTestOutbox({
        eventType: "member_welcome",
        channel: "whatsapp",
        memberId: "00000000-0000-0000-0000-000000000001",
        language: "en",
        runId: "run-2",
        now: new Date("2026-07-21T17:00:00.000Z"),
      }),
    ).toThrow("event_channel_not_supported");
  });

  test("makes validated staff variables available before event-specific materialization", () => {
    const variables = applyStaffTestVariables(
      { member_name: "Real member" },
      {
        staff_test: true,
        test_variables: {
          member_name: "Preview name",
          spots_available: "3",
          unsafe_object: { nested: true },
        },
      },
    );

    expect(variables.member_name).toBe("Real member");
    expect(variables.spots_available).toBe("3");
    expect(variables.unsafe_object).toBeUndefined();
  });
});
